// Colors per theme. `bg` keys cover the terminal and the boot screens.
export const THEMES = {
  green: { bg: "#021208", fg: "#33ff66", dim: "#27c250", bright: "#b8ffcb", err: "#ff8a8a" },
  amber: { bg: "#140b00", fg: "#ffb000", dim: "#d89400", bright: "#ffe29a", err: "#ff8a78" },
  blue: { bg: "#0a2a8a", fg: "#e8f0ff", dim: "#c0d0f4", bright: "#ffffff", err: "#ffc4c4" },
};

export const THEME_NAMES = Object.keys(THEMES);

// Boot screens use fixed colors, independent of the theme.
const FIXED = {
  bios: "#c8c8c8",
  biosY: "#ffff55",
  biosW: "#ffffff",
  gray: "#c8c8c8",
  white: "#ffffff",
};

const FIXED_BG = { bios: "#0000a8", black: "#000000", glow: "#0c0e0c" };

export function textColor(theme, key) {
  return FIXED[key] ?? THEMES[theme][key] ?? THEMES[theme].fg;
}

export function backgroundColor(theme, key) {
  return FIXED_BG[key] ?? THEMES[theme].bg;
}

// WCAG relative luminance contrast of two #rrggbb colors.
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
