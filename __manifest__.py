{
    "name": "Web Keyboard Shortcuts",
    "version": "1.1.0",
    "summary": "Configurable keyboard shortcuts (Odoo 17 / 18 / 19)",
    "description": """
Web Keyboard Shortcuts
======================

Define your own keyboard shortcuts from the UI and bind them to:

* a **UI Command** applied to the view on screen: New, Save, Discard, Delete,
  Duplicate, Archive, Unarchive, Export, next/previous record, focus the search
  bar, go back, open the apps menu
* a **View switch**: cycle through the views of the current action
  (kanban -> list -> calendar -> ...) or jump straight to one of them
* an **Action** (ir.actions.*)
* a **Menu** item
* an external **URL**

A ready-to-use set of shortcuts is created on first install (alt+shift+n for
New, alt+shift+arrow-right for the next view, and so on).

Shortcuts can be restricted per user, per group and per company.

Compatible with Odoo 17.0, 18.0 and 19.0 (Community & Enterprise).
    """,
    "author": "Ahmed Farouk",
    "category": "Extra Tools",
    "license": "LGPL-3",
    "images": ["static/description/banner.png"],
    "depends": ["web"],
    "data": [
        "security/ir.model.access.csv",
        "views/web_shortcut_views.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "web_shortcuts/static/src/js/current_controller.js",
            "web_shortcuts/static/src/js/shortcut_commands.js",
            "web_shortcuts/static/src/js/shortcut_service.js",
            "web_shortcuts/static/src/js/shortcut_systray.js",
            "web_shortcuts/static/src/js/hotkey_capture_field.js",
            "web_shortcuts/static/src/scss/shortcut_systray.scss",
            "web_shortcuts/static/src/xml/shortcut_systray.xml",
            "web_shortcuts/static/src/xml/hotkey_capture_field.xml",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
