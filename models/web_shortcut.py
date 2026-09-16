import logging
import re

from odoo import _, api, fields, models, release
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)

# Keys accepted by Odoo's own hotkey service (AUTHORIZED_KEYS).
# "escape" and "tab" are deliberately left out: they are needed by the UI.
NAV_KEYS = (
    "arrowleft", "arrowright", "arrowup", "arrowdown",
    "pageup", "pagedown", "home", "end",
    "backspace", "enter", "delete", "space",
)

HOTKEY_RE = re.compile(
    r"^(alt|control|shift)(\+(alt|control|shift))*\+(?:%s|[a-z0-9])$"
    % "|".join(NAV_KEYS)
)

# Odoo's hotkey service builds the pressed combination in this exact order,
# and matches registrations with a plain string comparison. Any other order
# simply never fires.
MODIFIER_ORDER = ("alt", "control", "shift")

RESERVED_HOTKEYS = {
    "alt+s", "alt+a", "alt+j", "alt+n", "alt+p", "alt+c", "alt+h", "alt+q",
    "control+k", "alt+1", "alt+2", "alt+3", "alt+4", "alt+5",
}

COMMANDS = [
    ("new", "New record"),
    ("save", "Save"),
    ("discard", "Discard"),
    ("delete", "Delete"),
    ("duplicate", "Duplicate"),
    ("archive", "Archive"),
    ("unarchive", "Unarchive"),
    ("export", "Export"),
    ("view_next", "Next view"),
    ("view_previous", "Previous view"),
    ("record_next", "Next record / page"),
    ("record_previous", "Previous record / page"),
    ("focus_search", "Focus search bar"),
    ("back", "Back (breadcrumb)"),
    ("home", "Home / apps menu"),
]

VIEW_TYPES = [
    ("list", "List"),
    ("kanban", "Kanban"),
    ("form", "Form"),
    ("calendar", "Calendar"),
    ("pivot", "Pivot"),
    ("graph", "Graph"),
    ("activity", "Activity"),
    ("map", "Map"),
    ("gantt", "Gantt"),
    ("cohort", "Cohort"),
    ("hierarchy", "Hierarchy"),
]

# Shortcuts created once, on first install only. Users stay free to edit,
# archive or delete them afterwards.
DEFAULT_SHORTCUTS = [
    ("New record", "alt+shift+n", "new", 1),
    ("Save", "alt+shift+s", "save", 2),
    ("Discard", "alt+shift+z", "discard", 3),
    ("Delete", "alt+shift+delete", "delete", 4),
    ("Duplicate", "alt+shift+u", "duplicate", 5),
    ("Next view", "alt+shift+arrowright", "view_next", 6),
    ("Previous view", "alt+shift+arrowleft", "view_previous", 7),
    ("Next record", "alt+shift+arrowdown", "record_next", 8),
    ("Previous record", "alt+shift+arrowup", "record_previous", 9),
    ("Focus search", "alt+shift+f", "focus_search", 10),
    ("Back", "alt+shift+backspace", "back", 11),
]

# Odoo 17 -> <tree>, Odoo 18/19 -> <list>. The tag is injected at load time.
LIST_ARCH = """<{tag}>
    <field name="sequence" widget="handle"/>
    <field name="name"/>
    <field name="hotkey"/>
    <field name="target_type"/>
    <field name="command" optional="show"/>
    <field name="view_type" optional="hide"/>
    <field name="action_id" optional="show"/>
    <field name="menu_id" optional="hide"/>
    <field name="url" optional="hide"/>
    <field name="company_id" groups="base.group_multi_company" optional="hide"/>
</{tag}>"""


class WebShortcut(models.Model):
    _name = "web.shortcut"
    _description = "UI Keyboard Shortcut"
    _order = "sequence, id"

    name = fields.Char(required=True, translate=True)
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    hotkey = fields.Char(
        required=True,
        help="Format: modifier(+modifier)+key - e.g. alt+shift+c\n"
             "Allowed modifiers: alt, control, shift.",
    )
    target_type = fields.Selection(
        [
            ("command", "UI Command"),
            ("view", "Switch View"),
            ("action", "Action"),
            ("menu", "Menu"),
            ("url", "URL"),
        ],
        default="command",
        required=True,
    )
    command = fields.Selection(
        COMMANDS,
        string="Command",
        help="Built-in action applied to the view currently on screen.",
    )
    view_type = fields.Selection(
        VIEW_TYPES,
        string="View Type",
        help="Switch the current action to this view type, when available.",
    )
    action_id = fields.Many2one(
        "ir.actions.actions", string="Action", ondelete="cascade")
    menu_id = fields.Many2one(
        "ir.ui.menu", string="Menu", ondelete="cascade")
    url = fields.Char()
    bypass_editable = fields.Boolean(
        string="Works While Typing",
        default=True,
        help="Keep the shortcut active while the cursor sits in an input or a "
             "text area. Disable it if you would rather have the shortcut "
             "ignored while typing.",
    )
    user_ids = fields.Many2many(
        "res.users", "web_shortcut_users_rel", "shortcut_id", "user_id",
        string="Users", help="Leave empty to make it available to all users.")
    group_ids = fields.Many2many(
        "res.groups", "web_shortcut_groups_rel", "shortcut_id", "group_id",
        string="Groups", help="Leave empty to make it available to all groups.")
    company_id = fields.Many2one(
        "res.company", string="Company",
        help="Leave empty to make it available in all companies.")

    # ------------------------------------------------------------------
    # Normalization & constraints
    # ------------------------------------------------------------------
    @staticmethod
    def _normalize_hotkey(value):
        if not value:
            return value
        parts = [p for p in value.strip().lower().replace(" ", "").split("+") if p]
        mods = [m for m in MODIFIER_ORDER if m in parts]
        keys = [p for p in parts if p not in MODIFIER_ORDER]
        return "+".join(mods + keys)

    @api.constrains("hotkey")
    def _check_hotkey(self):
        for rec in self:
            if not HOTKEY_RE.match(rec.hotkey or ""):
                raise ValidationError(_(
                    "Invalid hotkey '%s'.\n"
                    "Use a format like: alt+shift+c "
                    "(modifiers: alt, control, shift)."
                ) % (rec.hotkey or ""))
            parts = (rec.hotkey or "").split("+")
            if "alt" not in parts and "control" not in parts:
                raise ValidationError(_(
                    "'%s' needs Alt or Ctrl. A Shift-only combination would "
                    "fire while typing."
                ) % rec.hotkey)
            if rec.hotkey in RESERVED_HOTKEYS:
                raise ValidationError(_(
                    "'%s' is reserved by Odoo. Please pick another combination "
                    "(alt+shift+<key> is usually safe)."
                ) % rec.hotkey)

    @api.constrains("hotkey", "company_id", "active")
    def _check_hotkey_unique(self):
        """Python-level uniqueness: avoids _sql_constraints API differences
        between Odoo 17/18 and 19."""
        for rec in self:
            if not rec.active:
                continue
            domain = [
                ("id", "!=", rec.id),
                ("hotkey", "=", rec.hotkey),
                ("company_id", "=", rec.company_id.id),
            ]
            if self.sudo().search_count(domain):
                raise ValidationError(
                    _("The hotkey '%s' is already used.") % rec.hotkey)

    @api.constrains("target_type", "action_id", "menu_id", "url", "command", "view_type")
    def _check_target(self):
        for rec in self:
            if rec.target_type == "action" and not rec.action_id:
                raise ValidationError(_("An action is required for this target type."))
            if rec.target_type == "menu" and not rec.menu_id:
                raise ValidationError(_("A menu is required for this target type."))
            if rec.target_type == "url" and not rec.url:
                raise ValidationError(_("A URL is required for this target type."))
            if rec.target_type == "command" and not rec.command:
                raise ValidationError(_("A command is required for this target type."))
            if rec.target_type == "view" and not rec.view_type:
                raise ValidationError(_("A view type is required for this target type."))

    @api.onchange("target_type")
    def _onchange_target_type(self):
        if self.target_type != "action":
            self.action_id = False
        if self.target_type != "menu":
            self.menu_id = False
        if self.target_type != "url":
            self.url = False
        if self.target_type != "command":
            self.command = False
        if self.target_type != "view":
            self.view_type = False

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("hotkey"):
                vals["hotkey"] = self._normalize_hotkey(vals["hotkey"])
        return super().create(vals_list)

    def write(self, vals):
        if vals.get("hotkey"):
            vals["hotkey"] = self._normalize_hotkey(vals["hotkey"])
        return super().write(vals)

    # ------------------------------------------------------------------
    # RPC entry point
    # ------------------------------------------------------------------
    @api.model
    def _current_user_group_ids(self):
        """Odoo 19 renamed res.users.groups_id -> all_group_ids / group_ids."""
        user = self.env.user
        for fname in ("all_group_ids", "groups_id", "group_ids"):
            if fname in user._fields:
                return set(user[fname].ids)
        return set()

    @api.model
    def get_user_shortcuts(self):
        user = self.env.user
        user_groups = self._current_user_group_ids()
        company_ids = self.env.companies.ids or [self.env.company.id]
        domain = [
            "|", ("user_ids", "=", False), ("user_ids", "in", user.id),
            "|", ("company_id", "=", False), ("company_id", "in", company_ids),
        ]
        result = []
        for rec in self.sudo().search(domain):
            if rec.group_ids and not (set(rec.group_ids.ids) & user_groups):
                continue
            result.append({
                "id": rec.id,
                "name": rec.name,
                "hotkey": rec.hotkey,
                "target_type": rec.target_type,
                "command": rec.command or False,
                "view_type": rec.view_type or False,
                "action_id": rec.action_id.id or False,
                "menu_id": rec.menu_id.id or False,
                "url": rec.url or "",
                "bypass_editable": rec.bypass_editable,
            })
        return result

    # ------------------------------------------------------------------
    # Version-dependent view creation.
    # Called from views/web_shortcut_views.xml via <function> so that it runs
    # DURING data loading (a _register_hook would run too late, and shipping a
    # hard-coded <tree> arch in XML breaks the parser on Odoo 18/19).
    # ------------------------------------------------------------------
    @api.model
    def _list_tag(self):
        return "tree" if release.version_info[0] < 18 else "list"

    @api.model
    def _ensure_xmlid(self, record, xml_name):
        """Register the external ID through _update_xmlids().

        Creating an ir.model.data row directly is NOT enough: the loader keeps
        the set of XML ids seen during the update in registry.loaded_xmlids,
        and _process_end() deletes every ir.model.data row of the module that
        is missing from that set - taking the linked record with it. So a
        hand-made row is created and then dropped in the same transaction.
        _update_xmlids() feeds loaded_xmlids, which is what makes it survive.
        """
        self.env["ir.model.data"].sudo()._update_xmlids([{
            "xml_id": "web_shortcuts.%s" % xml_name,
            "record": record,
            "noupdate": False,
        }], update=True)

    @api.model
    def _install_version_views(self):
        """Create/update the list view and the window action using the view tag
        supported by the running Odoo version."""
        tag = self._list_tag()
        arch = LIST_ARCH.format(tag=tag)

        # --- list view -------------------------------------------------
        view = self.env.ref(
            "web_shortcuts.view_web_shortcut_list", raise_if_not_found=False)
        view_vals = {
            "name": "web.shortcut.%s" % tag,
            "model": "web.shortcut",
            "type": tag,
            "priority": 16,
            "arch": arch,
        }
        if view:
            view.sudo().write(view_vals)
        else:
            view = self.env["ir.ui.view"].sudo().create(view_vals)
        self._ensure_xmlid(view, "view_web_shortcut_list")

        # --- window action --------------------------------------------
        action = self.env.ref(
            "web_shortcuts.action_web_shortcut", raise_if_not_found=False)
        action_vals = {
            "name": "Keyboard Shortcuts",
            "res_model": "web.shortcut",
            "view_mode": "%s,form" % tag,
            "help": (
                '<p class="o_view_nocontent_smiling_face">'
                "Create your first shortcut</p>"
                "<p>Bind a key combination to a UI command, a view, an action, "
                "a menu or a URL.</p>"
            ),
        }
        if action:
            action.sudo().write(action_vals)
        else:
            action = self.env["ir.actions.act_window"].sudo().create(action_vals)
        self._ensure_xmlid(action, "action_web_shortcut")

        self.env.flush_all() if hasattr(self.env, "flush_all") else self.env.cr.flush()
        _logger.info("web_shortcuts: views installed using <%s> tag", tag)
        return True

    @api.model
    def _renormalize_hotkeys(self):
        """Re-apply the modifier order on records written by an older version
        of this module (control+alt+x never matched Odoo's alt+control+x)."""
        for rec in self.sudo().with_context(active_test=False).search([]):
            normalized = self._normalize_hotkey(rec.hotkey)
            if normalized and normalized != rec.hotkey:
                try:
                    rec.hotkey = normalized
                except ValidationError:
                    _logger.warning(
                        "web_shortcuts: could not normalize hotkey %s (id=%s)",
                        rec.hotkey, rec.id)
        return True

    @api.model
    def _install_default_shortcuts(self):
        """Seed a usable set of shortcuts on first install only.

        Records are created one by one and conflicts are skipped, so an
        existing hotkey never blocks the installation. The flag makes sure
        deleted defaults are not recreated on the next module update.
        """
        params = self.env["ir.config_parameter"].sudo()
        if params.get_param("web_shortcuts.defaults_installed"):
            return True
        for name, hotkey, command, sequence in DEFAULT_SHORTCUTS:
            if self.sudo().with_context(active_test=False).search_count(
                    [("hotkey", "=", hotkey)]):
                continue
            try:
                with self.env.cr.savepoint():
                    self.sudo().create({
                        "name": name,
                        "hotkey": hotkey,
                        "sequence": sequence,
                        "target_type": "command",
                        "command": command,
                    })
            except ValidationError as err:
                _logger.info(
                    "web_shortcuts: default shortcut %s skipped (%s)", hotkey, err)
        params.set_param("web_shortcuts.defaults_installed", "1")
        return True
