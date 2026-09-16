/** @odoo-module **/

import { Component, useState, useRef } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

const MODIFIER_KEYS = ["control", "alt", "shift", "meta", "capslock", "tab", "dead"];

// Mirrors AUTHORIZED_KEYS of Odoo's hotkey service: anything else is simply
// never dispatched, so it must not be storable either.
// "escape" and "tab" are excluded on purpose, the UI needs them.
const NAV_KEYS = [
    "arrowup",
    "arrowdown",
    "arrowleft",
    "arrowright",
    "pageup",
    "pagedown",
    "home",
    "end",
    "backspace",
    "enter",
    "delete",
    "space",
];

const NAMED_KEYS = { " ": "space" };
for (const key of NAV_KEYS) {
    NAMED_KEYS[key] = key;
}

/**
 * Char field that records a key combination instead of being typed.
 * Focus the field, press the combination, done.
 */
export class HotkeyCaptureField extends Component {
    static template = "web_shortcuts.HotkeyCaptureField";
    static props = { ...standardFieldProps };

    setup() {
        this.state = useState({ capturing: false, error: false });
        this.inputRef = useRef("input");
    }

    get value() {
        return this.props.record.data[this.props.name] || "";
    }

    get placeholder() {
        return this.state.capturing
            ? "Press the key combination..."
            : "Click here, then press your keys";
    }

    /**
     * Physical-layout fallback: on non-QWERTY layouts ev.key can be a symbol
     * or a dead key, while ev.code stays stable.
     */
    _resolveKey(ev) {
        let key = (ev.key || "").toLowerCase();
        if (NAMED_KEYS[key]) {
            return NAMED_KEYS[key];
        }
        if (/^[a-z0-9]$/.test(key)) {
            return key;
        }
        const code = ev.code || "";
        if (code.startsWith("Key")) {
            return code.slice(3).toLowerCase();
        }
        if (code.startsWith("Digit")) {
            return code.slice(5);
        }
        return null;
    }

    onFocus() {
        this.state.capturing = true;
        this.state.error = false;
    }

    onBlur() {
        this.state.capturing = false;
    }

    onKeydown(ev) {
        // Keep the combination away from Odoo's own hotkey service and from
        // the browser default (alt+s would otherwise save the record).
        ev.preventDefault();
        ev.stopPropagation();

        const raw = (ev.key || "").toLowerCase();
        if (MODIFIER_KEYS.includes(raw)) {
            return;
        }
        if (raw === "escape") {
            this.state.capturing = false;
            this.inputRef.el && this.inputRef.el.blur();
            return;
        }

        const key = this._resolveKey(ev);
        if (!key) {
            this.state.error = "This key cannot be used as a shortcut.";
            return;
        }

        // Odoo builds the pressed combination in this exact order and matches
        // registrations with a plain string comparison, so any other order
        // would store a shortcut that never fires.
        const mods = [];
        if (ev.altKey) {
            mods.push("alt");
        }
        if (ev.ctrlKey || ev.metaKey) {
            mods.push("control");
        }
        if (ev.shiftKey) {
            mods.push("shift");
        }
        if (!mods.includes("alt") && !mods.includes("control")) {
            this.state.error = "Add Alt or Ctrl: Shift alone would fire while typing.";
            return;
        }

        this.state.error = false;
        this.props.record.update({ [this.props.name]: [...mods, key].join("+") });
    }

    onClear() {
        this.state.error = false;
        this.props.record.update({ [this.props.name]: false });
        this.inputRef.el && this.inputRef.el.focus();
    }

    get display() {
        if (!this.value) {
            return "";
        }
        return this.value
            .split("+")
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join(" + ");
    }
}

export const hotkeyCaptureField = {
    component: HotkeyCaptureField,
    displayName: "Hotkey Capture",
    supportedTypes: ["char"],
};

registry.category("fields").add("hotkey_capture", hotkeyCaptureField);
