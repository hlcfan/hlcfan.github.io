// Visually hidden controls that mirror the 3D ones: a power button and a text
// input. They sit between the skip link and the mute button in the tab order.
export function createProxyControls({ before, onPower, onText, onKey, onFocusChange }) {
  const power = document.createElement("button");
  power.type = "button";
  power.className = "sr-only";
  power.id = "desk-power";
  power.textContent = "Power button";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "sr-only";
  input.id = "desk-input";
  input.setAttribute("aria-label", "Terminal input");
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("spellcheck", "false");
  input.setAttribute("enterkeyhint", "go");

  before.parentNode.insertBefore(power, before);
  before.parentNode.insertBefore(input, before);

  power.addEventListener("click", () => onPower());
  // A held Enter repeats `click` on a button. A held key must not toggle the power.
  power.addEventListener("keydown", (e) => { if (e.repeat) e.preventDefault(); });
  power.addEventListener("focus", () => onFocusChange("power", true));
  power.addEventListener("blur", () => onFocusChange("power", false));
  input.addEventListener("focus", () => onFocusChange("input", true));
  input.addEventListener("blur", () => onFocusChange("input", false));

  // Printable text arrives through `input` events, so IME, paste and mobile keyboards work.
  input.addEventListener("input", () => {
    const text = input.value;
    input.value = "";
    if (text) onText(text);
  });
  // Mobile keyboards often send Backspace on an empty field only as beforeinput.
  input.addEventListener("beforeinput", (e) => {
    if (e.inputType === "deleteContentBackward" && input.value === "") {
      e.preventDefault();
      onKey({ key: "Backspace" });
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.isComposing || e.key === "Process") return;
    if (e.key === "Escape") return; // handled globally by the focus-mode logic
    if (isSpecial(e) && onKey({ key: e.key, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, repeat: e.repeat })) {
      e.preventDefault();
    }
  });

  return {
    power,
    input,
    focusInput: () => input.focus({ preventScroll: true }),
    blurInput: () => input.blur(),
    get inputFocused() { return document.activeElement === input; },
  };
}

function isSpecial(e) {
  if (e.ctrlKey || e.metaKey) return e.key.length === 1;
  return e.key.length > 1;
}
