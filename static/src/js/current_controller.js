/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { onMounted, onWillUnmount } from "@odoo/owl";
import { FormController } from "@web/views/form/form_controller";
import { ListController } from "@web/views/list/list_controller";
import { KanbanController } from "@web/views/kanban/kanban_controller";

/**
 * Stack of the view controllers currently mounted. A form opened in a dialog
 * sits on top of the list that opened it, so the last entry is always the
 * controller the user is actually looking at.
 *
 * Odoo does not expose the controller instance anywhere (actionService only
 * hands out a descriptor), and the small set of methods used by the commands
 * - create / save / discard / getStaticActionMenuItems - is identical on
 * Odoo 17, 18 and 19.
 */
const controllerStack = [];

export function getActiveController() {
    return controllerStack.length ? controllerStack[controllerStack.length - 1] : null;
}

function trackController(ControllerClass, viewType) {
    if (!ControllerClass) {
        return;
    }
    patch(ControllerClass.prototype, {
        setup() {
            super.setup(...arguments);
            onMounted(() => {
                this.__shortcutViewType = viewType;
                controllerStack.push(this);
            });
            onWillUnmount(() => {
                const index = controllerStack.indexOf(this);
                if (index > -1) {
                    controllerStack.splice(index, 1);
                }
            });
        },
    });
}

trackController(FormController, "form");
trackController(ListController, "list");
trackController(KanbanController, "kanban");
