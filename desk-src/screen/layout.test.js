import { describe, expect, it } from "vitest";
import { bands } from "./screen-canvas.js";
import { CANVAS, LAYOUTS, pickLayout } from "./layout.js";
import { THEMES, contrast } from "./themes.js";

describe("layouts", () => {
  it("fill the canvas exactly", () => {
    for (const l of Object.values(LAYOUTS)) {
      expect(l.cols * l.cellW).toBe(CANVAS.w);
      expect(l.rows * l.cellH).toBe(CANVAS.h);
    }
  });

  it("picks wide on desktop and narrow on phones, by on-screen width in focus mode", () => {
    expect(pickLayout(1280, 720).name).toBe("wide");
    expect(pickLayout(390, 780).name).toBe("narrow");
    expect(pickLayout(1024, 600).name).toBe("wide");
    expect(pickLayout(800, 400).name).toBe("narrow"); // short landscape is height-limited
  });
});

describe("themes", () => {
  it("meet 7:1 contrast for every text color at the source", () => {
    for (const [name, t] of Object.entries(THEMES)) {
      for (const key of ["fg", "dim", "bright", "err"]) {
        expect(contrast(t[key], t.bg), `${name}.${key}`).toBeGreaterThanOrEqual(7);
      }
    }
  });
});

describe("bands", () => {
  it("merges consecutive dirty rows", () => {
    expect(bands([0, 1, 2, 5, 7, 8], 32)).toEqual([
      { y: 0, h: 96 },
      { y: 160, h: 32 },
      { y: 224, h: 64 },
    ]);
  });
});
