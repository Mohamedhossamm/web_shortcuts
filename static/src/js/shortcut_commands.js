/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { getActiveController } from "./current_controller";

/**
 * Built-in commands, run against whatever view is on screen.
 *
 * Every command goes through the public controller methods first and falls
 * back to a DOM click on the matching control-panel button, so views without
 * a patched controller (calendar, pivot, gantt, ...) keep working.
 */

function isVisible(el) {
    return Boolean(el) && !el.disabled && el.getClientRects().length > 0;
}

function clickFirst(selectors) {
    for (const selector of selectors) {
        for (const el of document.querySelectorAll(selector)) {
            if (isVisible(el)) {
                el.click();
                return true;
            }
        }
    }
    return false;
}

function focusFirst(selectors) {
    for (const selector of selectors) {
        for (const el of document.querySelectorAll(selector)) {
            if (isVisible(el)) {
                el.focus();
                if (typeof el.select === "function") {
                    el.select();
                }
                return true;
            }
        }
    }
    return false;
}

export function makeCommandRunner(services) {
    const { action, notification } = services;

    function warn(message) {
        notification.add(message, { type: "warning" });
    }

    function controller() {
        return getActiveController();
    }

    function viewTypeOf(ctrl) {
        return ctrl ? ctrl.__shortcutViewType : null;
    }

    /**
     * Grab an entry of the cog menu ("delete", "duplicate", "archive",
     * "unarchive", "export"). Same shape and same keys on 17 / 18 / 19, and
     * it already honours create="0" / delete="0" through isAvailable().
     */
    function staticItem(key) {
        const ctrl = controller();
        if (!ctrl || typeof ctrl.getStaticActionMenuItems !== "function") {
            return null;
        }
        let items;
        try {
            items = ctrl.getStaticActionMenuItems();
        } catch (e) {
            return null;
        }
        const item = items && items[key];
        if (!item || typeof item.callback !== "function") {
            return null;
        }
        if (typeof item.isAvailable === "function" && !item.isAvailable()) {
            return null;
        }
        return item;
    }

    function hasSelection(ctrl) {
        const root = ctrl && ctrl.model && ctrl.model.root;
        if (!root) {
            return true;
        }
        if (root.isDomainSelected || !root.selection) {
            // Views without a selection mechanism (kanban on 17/18) are left
            // to the availability check of the cog menu entry instead.
            return true;
        }
        return Boolean(root.selection.length);
    }

    // ------------------------------------------------------------------
    // View switching
    // ------------------------------------------------------------------
    function currentViews() {
        const ctrl = action.currentController;
        return (ctrl && ctrl.views) || [];
    }

    function currentViewType() {
        const ctrl = action.currentController;
        return (ctrl && ctrl.view && ctrl.view.type) || null;
    }

    async function switchToView(viewType) {
        if (!viewType) {
            return;
        }
        if (currentViewType() === viewType) {
            return;
        }
        if (!currentViews().some((view) => view.type === viewType)) {
            warn(_t("The %s view is not available here.", viewType));
            return;
        }
        try {
            await action.switchView(viewType);
        } catch (e) {
            warn(_t("The %s view is not available here.", viewType));
        }
    }

    /**
     * Cycle through the views of the view switcher. Only multi-record views
     * are listed there, which is exactly what makes kanban -> list -> calendar
     * feel natural. From a form view, the first (or last) one is picked.
     */
    async function cycleView(delta) {
        const views = currentViews().filter((view) => view.multiRecord);
        if (views.length < 2) {
            warn(_t("No other view is available here."));
            return;
        }
        const current = currentViewType();
        let index = views.findIndex((view) => view.type === current);
        if (index === -1) {
            index = delta > 0 ? -1 : 0;
        }
        const next = views[(index + delta + views.length) % views.length];
        try {
            await action.switchView(next.type);
        } catch (e) {
            warn(_t("No other view is available here."));
        }
    }

    // ------------------------------------------------------------------
    // Commands
    // ------------------------------------------------------------------
    const COMMANDS = {
        async new() {
            const ctrl = controller();
            if (ctrl) {
                if (typeof ctrl.onClickCreate === "function") {
                    return ctrl.onClickCreate(); // list
                }
                if (typeof ctrl.createRecord === "function") {
                    return ctrl.createRecord(); // kanban
                }
                if (typeof ctrl.create === "function") {
                    return ctrl.create(); // form
                }
            }
            if (!clickFirst([".o_list_button_add", ".o-kanban-button-new", "[data-hotkey='c']"])) {
                warn(_t("Creating a record is not possible here."));
            }
        },

        async save() {
            const ctrl = controller();
            if (ctrl) {
                if (typeof ctrl.onClickSave === "function") {
                    return ctrl.onClickSave(); // list
                }
                if (typeof ctrl.saveButtonClicked === "function") {
                    return ctrl.saveButtonClicked(); // form
                }
            }
            if (!clickFirst([".o_form_button_save", ".o_list_button_save", "[data-hotkey='s']"])) {
                warn(_t("Nothing to save here."));
            }
        },

        async discard() {
            const ctrl = controller();
            if (ctrl) {
                if (typeof ctrl.onClickDiscard === "function") {
                    return ctrl.onClickDiscard(); // list
                }
                if (typeof ctrl.discard === "function") {
                    return ctrl.discard(); // form
                }
            }
            if (!clickFirst([".o_form_button_cancel", ".o_list_button_discard", "[data-hotkey='j']"])) {
                warn(_t("Nothing to discard here."));
            }
        },

        async delete() {
            const ctrl = controller();
            if (ctrl && viewTypeOf(ctrl) !== "form" && !hasSelection(ctrl)) {
                warn(_t("Select at least one record first."));
                return;
            }
            const item = staticItem("delete");
            if (item) {
                return item.callback();
            }
            if (ctrl && viewTypeOf(ctrl) === "form" && typeof ctrl.deleteRecord === "function") {
                return ctrl.deleteRecord();
            }
            warn(_t("Deleting is not allowed here."));
        },

        async duplicate() {
            const ctrl = controller();
            if (ctrl && viewTypeOf(ctrl) !== "form" && !hasSelection(ctrl)) {
                warn(_t("Select at least one record first."));
                return;
            }
            const item = staticItem("duplicate");
            if (item) {
                return item.callback();
            }
            if (ctrl && typeof ctrl.duplicateRecord === "function") {
                return ctrl.duplicateRecord();
            }
            warn(_t("Duplicating is not allowed here."));
        },

        async archive() {
            const item = staticItem("archive");
            if (item) {
                return item.callback();
            }
            warn(_t("Archiving is not available here."));
        },

        async unarchive() {
            const item = staticItem("unarchive");
            if (item) {
                return item.callback();
            }
            warn(_t("Unarchiving is not available here."));
        },

        async export() {
            const item = staticItem("export");
            if (item) {
                return item.callback();
            }
            warn(_t("Exporting is not available here."));
        },

        async view_next() {
            return cycleView(1);
        },

        async view_previous() {
            return cycleView(-1);
        },

        async record_next() {
            if (!clickFirst([".o_pager_next"])) {
                warn(_t("There is no pager on this screen."));
            }
        },

        async record_previous() {
            if (!clickFirst([".o_pager_previous"])) {
                warn(_t("There is no pager on this screen."));
            }
        },

        async focus_search() {
            if (focusFirst([".o_searchview_input", ".o_searchview input"])) {
                return;
            }
            // Small screens hide the search view behind a toggler.
            clickFirst([".o_searchview_dropdown_toggler", ".o_enable_searchview"]);
            setTimeout(() => focusFirst([".o_searchview_input"]), 150);
        },

        async back() {
            const breadcrumbs = [
                ...document.querySelectorAll(
                    ".o_control_panel .o_back_button, " +
                        ".o_control_panel .breadcrumb-item a, " +
                        ".o_control_panel .o_breadcrumb a"
                ),
            ].filter(isVisible);
            if (breadcrumbs.length) {
                breadcrumbs[breadcrumbs.length - 1].click();
                return;
            }
            warn(_t("There is nothing to go back to."));
        },

        async home() {
            if (!clickFirst([".o_menu_toggle", ".o_navbar_apps_menu > button", ".o_menu_brand"])) {
                warn(_t("The apps menu is not reachable from here."));
            }
        },
    };

    return {
        /** @returns {Promise<void>} */
        async runCommand(command) {
            const fn = COMMANDS[command];
            if (!fn) {
                warn(_t("Unknown command: %s", command));
                return;
            }
            return fn();
        },
        switchToView,
        get availableCommands() {
            return Object.keys(COMMANDS);
        },
    };
}
