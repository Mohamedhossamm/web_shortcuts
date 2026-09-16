# Web Keyboard Shortcuts

Configurable keyboard shortcuts for the Odoo backend.
Tested against **Odoo 17.0, 18.0 and 19.0** (Community & Enterprise).

## Features

- Define shortcuts from the UI: **Settings → Shortcuts → Keyboard Shortcuts**
- Bind a hotkey to a **UI Command**, a **View**, an **Action**, a **Menu** item,
  or an external **URL**
- **UI Commands** act on whatever view is on screen: New, Save, Discard, Delete,
  Duplicate, Archive, Unarchive, Export, next/previous record, next/previous
  view, focus the search bar, go back, open the apps menu
- **View switching**: cycle through the views of the current action
  (kanban → list → calendar → …) or jump straight to a given view type
- A ready-to-use set of shortcuts is seeded on first install
- Restrict per **user**, per **group**, per **company**
- **Key-capture widget**: focus the Hotkey field and press the combination, no typing
- Systray button listing all your active shortcuts (with a reload button)
- Duplicate / reserved hotkey validation

## Install

```bash
cp -r web_shortcuts /path/to/addons/
# then
./odoo-bin -u web_shortcuts -d <db>
```

Or, in Docker:

```bash
docker cp web_shortcuts <container>:/mnt/extra-addons/
docker exec -it <container> odoo -u web_shortcuts -d <db> --stop-after-init
docker restart <container>
```

Then **Apps → Update Apps List → install "Web Keyboard Shortcuts"**.

## Usage

| Field | Meaning |
|---|---|
| Hotkey | Click the field and press the combination (e.g. Alt+Shift+C). Esc cancels, the x clears it |
| Target Type | UI Command / Switch View / Action / Menu / URL |
| Command | Built-in action applied to the current view (only for *UI Command*) |
| View Type | Target view type of the current action (only for *Switch View*) |
| Works While Typing | Keep the shortcut live while the cursor is in a field (on by default) |
| Users | empty = everyone |
| Groups | empty = all groups |
| Company | empty = all companies |

Prefer `alt+shift+<key>`: single-modifier combos like `alt+s` or `alt+n` are
already taken by Odoo itself and are rejected by the module. Every hotkey must
contain **Alt or Ctrl** — a Shift-only combination would fire while typing.

Beyond letters and digits, these keys are accepted (they are the ones Odoo's own
hotkey service dispatches): arrow keys, `pageup`, `pagedown`, `home`, `end`,
`backspace`, `enter`, `delete`, `space`. `escape` and `tab` are deliberately
excluded, the UI needs them.

### Shortcuts created on first install

| Hotkey | Command |
|---|---|
| Alt+Shift+N | New record |
| Alt+Shift+S | Save |
| Alt+Shift+Z | Discard |
| Alt+Shift+Delete | Delete |
| Alt+Shift+U | Duplicate |
| Alt+Shift+→ | Next view |
| Alt+Shift+← | Previous view |
| Alt+Shift+↓ | Next record / page |
| Alt+Shift+↑ | Previous record / page |
| Alt+Shift+F | Focus search bar |
| Alt+Shift+Backspace | Back |

They are ordinary records: edit, archive or delete them freely. A hotkey already
in use is skipped instead of blocking the install, and the seeding runs once
(guarded by the `web_shortcuts.defaults_installed` system parameter), so deleted
defaults never come back on the next update.

After creating or editing a shortcut, either refresh the page or click the
reload icon in the systray panel.

## Version compatibility notes

| Concern | Handling |
|---|---|
| `<tree>` (17) vs `<list>` (18/19) | No list tag in XML at all. `<function name="_install_version_views"/>` runs during data loading and builds the list view + `view_mode` with the tag the running version accepts |
| `res.users.groups_id` renamed in 19 | `_current_user_group_ids()` resolves `all_group_ids` / `groups_id` / `group_ids` dynamically |
| `rpc` service removed in 18 | uses the `orm` service only |
| `_sql_constraints` API changes in 19 | uniqueness enforced with a Python `@api.constrains` |
| XML ids created from Python | registered via `ir.model.data._update_xmlids()` so `_process_end()` does not delete them |
| `Dropdown` slot API changed in 18 | systray uses plain OWL state, no core Dropdown |
| `attrs="..."` removed in 17 | views use direct `invisible=` / `required=` expressions |
| No public API for the current controller | `current_controller.js` patches `FormController` / `ListController` / `KanbanController` and keeps a mount stack. Only methods stable across 17/18/19 are used: `create` / `onClickCreate` / `createRecord`, `saveButtonClicked` / `onClickSave`, `discard` / `onClickDiscard`, `getStaticActionMenuItems()` |
| Cog-menu actions differ per version (`duplicateRecords` dropped from the 19 list controller) | Delete / Duplicate / Archive / Unarchive / Export go through `getStaticActionMenuItems()`, which exists on all three and already honours `create="0"` / `delete="0"` via `isAvailable()` |
| Views without a patched controller (calendar, pivot, gantt) | each command falls back to a DOM click on the matching control-panel button |
| Modifier order | Odoo builds the pressed combination as `alt+control+shift+key` and matches registrations with a plain string compare. Hotkeys are normalized to that order on write, and `_renormalize_hotkeys()` repairs records stored by v1.0.0 |

## Changelog

### 1.1.0
- New target types: **UI Command** and **Switch View**
- 15 built-in commands, default shortcuts seeded on install
- Fixed: hotkeys mixing Ctrl and Alt were stored as `control+alt+x` and never
  fired (Odoo expects `alt+control+x`); existing records are repaired on update
- Fixed: the capture widget accepted keys Odoo never dispatches (F-keys, Escape)
- Shortcuts now keep working while the cursor is inside a field (configurable)

### 1.0.0
- Initial release

## License

LGPL-3
