/** @odoo-module **/

import { registry } from "@web/core/registry";
import { browser } from "@web/core/browser/browser";
import { makeCommandRunner } from "./shortcut_commands";

/**
 * Loads web.shortcut records for the current user and registers each one
 * on the core "hotkey" service. Works unchanged on Odoo 17 / 18 / 19.
 */
export const webShortcutsService = {
    dependencies: ["orm", "hotkey", "action", "menu", "notification"],

    start(env, { orm, hotkey, action, menu, notification }) {
        let unregisterFns = [];
        let shortcuts = [];
        const commands = makeCommandRunner({ action, notification, env });

        function run(sc) {
            try {
                if (sc.target_type === "command") {
                    return Promise.resolve(commands.runCommand(sc.command)).catch((e) => {
                        console.warn("[web_shortcuts] command failed", sc, e);
                    });
                }
                if (sc.target_type === "view") {
                    return Promise.resolve(commands.switchToView(sc.view_type)).catch((e) => {
                        console.warn("[web_shortcuts] view switch failed", sc, e);
                    });
                }
                if (sc.target_type === "url" && sc.url) {
                    browser.open(sc.url, "_blank");
                    return;
                }
                if (sc.target_type === "menu" && sc.menu_id) {
                    const menuData =
                        typeof menu.getMenu === "function"
                            ? menu.getMenu(sc.menu_id)
                            : null;
                    menu.selectMenu(menuData || sc.menu_id);
                    return;
                }
                if (sc.action_id) {
                    action.doAction(sc.action_id, { clearBreadcrumbs: true });
                }
            } catch (e) {
                notification.add("Shortcut failed: " + sc.name, { type: "warning" });
                console.error("[web_shortcuts] failed to run shortcut", sc, e);
            }
        }

        function unregisterAll() {
            for (const fn of unregisterFns) {
                try {
                    fn();
                } catch (e) {
                    // ignore
                }
            }
            unregisterFns = [];
        }

        async function load() {
            unregisterAll();
            try {
                shortcuts = await orm.call("web.shortcut", "get_user_shortcuts", []);
            } catch (e) {
                console.warn("[web_shortcuts] could not load shortcuts", e);
                shortcuts = [];
                return shortcuts;
            }
            for (const sc of shortcuts) {
                try {
                    unregisterFns.push(
                        hotkey.add(sc.hotkey, () => run(sc), {
                            global: true,
                            allowRepeat: false,
                            // Commands such as Save or Next view stay useful
                            // while the cursor sits inside a field.
                            bypassEditableProtection: sc.bypass_editable !== false,
                        })
                    );
                } catch (e) {
                    console.warn("[web_shortcuts] invalid or duplicated hotkey:", sc.hotkey, e);
                }
            }
            return shortcuts;
        }

        // fire and forget: never block the web client boot sequence
        load();

        return {
            reload: load,
            run,
            get shortcuts() {
                return shortcuts;
            },
        };
    },
};

registry.category("services").add("web_shortcuts", webShortcutsService);
