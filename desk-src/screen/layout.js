// The two terminal layouts. The canvas stays 1280 x 960. The narrow layout
// doubles the cell and the font, so the same pixels hold 40 x 15 cells.
export const CANVAS = { w: 1280, h: 960 };

export const LAYOUTS = {
  wide: { name: "wide", cols: 80, rows: 30, cellW: 16, cellH: 32, scale: 1 },
  narrow: { name: "narrow", cols: 40, rows: 15, cellW: 32, cellH: 64, scale: 2 },
};

// Focus mode fits the screen with this much margin around it.
export const FOCUS_MARGIN = 1.12;
export const WIDE_MIN_PX = 600;

// Chooses the layout from the size the screen has on the display in focus mode.
export function pickLayout(viewportW, viewportH) {
  const screenPx = Math.min(viewportW, (viewportH * 4) / 3) / FOCUS_MARGIN;
  return screenPx >= WIDE_MIN_PX ? LAYOUTS.wide : LAYOUTS.narrow;
}
