/** @odoo-module **/

import { Component, useState, useRef, onWillStart, useExternalListener } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

/**
 * Small systray button showing the list of available shortcuts.
 * Built with plain OWL state instead of the core Dropdown component, because
 * the Dropdown slot API differs between Odoo 17 and 18/19.
 */
export class ShortcutSystray extends Component {
    static template = "web_shortcuts.ShortcutSystray";
    static props = {};

    setup() {
        this.shortcutService = useService("web_shortcuts");
        this.state = useState({ open: false, items: [] });
        this.rootRef = useRef("root");

        // Close when clicking anywhere outside the panel, like the other
        // systray dropdowns. mousedown in the capture phase runs before the
        // toggle button's click handler, so the button keeps toggling.
        useExternalListener(window, "mousedown", this.onWindowMouseDown.bind(this), {
            capture: true,
        });
        useExternalListener(window, "keydown", this.onWindowKeydown.bind(this));
        useExternalListener(window, "blur", () => this.close());

        onWillStart(async () => {
            this.state.items = this.shortcutService.shortcuts || [];
            if (!this.state.items.length) {
                this.state.items = (await this.shortcutService.reload()) || [];
            }
        });
    }

    toggle() {
        this.state.open = !this.state.open;
    }

    onWindowMouseDown(ev) {
        if (!this.state.open) {
            return;
        }
        const root = this.rootRef.el;
        if (root && !root.contains(ev.target)) {
            this.close();
        }
    }

    onWindowKeydown(ev) {
        if (this.state.open && ev.key === "Escape") {
            this.close();
        }
    }

    close() {
        this.state.open = false;
    }

    async onReload() {
        this.state.items = (await this.shortcutService.reload()) || [];
    }

    onItemClick(item) {
        this.close();
        this.shortcutService.run(item);
    }

    iconFor(item) {
        switch (item.target_type) {
            case "command":
                return "fa-bolt";
            case "view":
                return "fa-th-large";
            case "menu":
                return "fa-bars";
            case "url":
                return "fa-external-link";
            default:
                return "fa-play";
        }
    }

    formatHotkey(hotkey) {
        return (hotkey || "")
            .split("+")
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join(" + ");
    }
}

registry.category("systray").add(
    "web_shortcuts.ShortcutSystray",
    { Component: ShortcutSystray },
    { sequence: 45 }
);
