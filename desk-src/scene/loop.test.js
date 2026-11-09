import { describe, expect, it } from "vitest";
import { createFrameMeter } from "./loop.js";

describe("frame meter", () => {
  it("flags a window whose average exceeds the limit", () => {
    const m = createFrameMeter(15, 4);
    expect([20, 20, 20, 20].map(m.push)).toEqual([false, false, false, true]);
  });

  it("does not flag a fast window and starts a fresh one", () => {
    const m = createFrameMeter(15, 3);
    expect([5, 5, 5].map(m.push)).toEqual([false, false, false]);
    expect([40, 40, 40].map(m.push)).toEqual([false, false, true]);
  });
});
