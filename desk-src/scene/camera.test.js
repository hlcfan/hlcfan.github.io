import { describe, expect, it } from "vitest";
import { FOCUS_LIMITS, LIMITS, dragEnd, focusDistance, idleWakeMs, dragMove, dragStart, fitDistanceScale, IDLE_RETURN_MS, newRigState, stepRig } from "./camera.js";

describe("orbit limits", () => {
  it("clamps yaw and pitch while dragging", () => {
    const s = newRigState();
    dragStart(s, 0);
    dragMove(s, -100000, 100000, 16);
    expect(s.yaw).toBeCloseTo(LIMITS.yaw);
    expect(s.pitch).toBeCloseTo(LIMITS.pitch);
    dragMove(s, 200000, -200000, 32);
    expect(s.yaw).toBeCloseTo(-LIMITS.yaw);
    expect(s.pitch).toBeCloseTo(-LIMITS.pitch);
  });
});

describe("inertia and spring", () => {
  it("coasts after release and then holds until the idle delay", () => {
    const s = newRigState();
    dragStart(s, 0);
    dragMove(s, 50, 0, 16);
    dragEnd(s, 20);
    const yawAtRelease = s.yaw;
    stepRig(s, 0.016, 40);
    expect(s.yaw).not.toBe(yawAtRelease);
    for (let t = 56; t < 3000; t += 16) stepRig(s, 0.016, t);
    const held = s.yaw;
    expect(held).not.toBe(0);
    expect(stepRig(s, 0.016, 3016)).toBe(false); // waiting for the idle timer, no frames needed
    expect(s.yaw).toBe(held);
    expect(idleWakeMs(s, 3016)).toBeGreaterThan(2900);
    expect(idleWakeMs(newRigState(), 0)).toBeNull();
  });

  it("springs back to center after 6 s idle, then reports rest", () => {
    const s = newRigState();
    s.yaw = 0.2;
    s.pitch = -0.1;
    s.lastInput = 0;
    let now = IDLE_RETURN_MS + 1;
    let moving = true;
    for (let i = 0; i < 2000 && moving; i++) {
      moving = stepRig(s, 0.016, now);
      now += 16;
    }
    expect(moving).toBe(false);
    expect(s.yaw).toBe(0);
    expect(s.pitch).toBe(0);
  });

  it("is at rest when centered with no velocity", () => {
    expect(stepRig(newRigState(), 0.016, 100)).toBe(false);
  });
});

describe("fitDistanceScale", () => {
  it("is 1 on wide screens and grows on tall screens, capped", () => {
    expect(fitDistanceScale(1.78, 35)).toBe(1);
    expect(fitDistanceScale(0.46, 35)).toBeGreaterThan(1.5);
    expect(fitDistanceScale(0.1, 35)).toBe(2.2);
  });
});

describe("focus mode", () => {
  it("has a narrower orbit range than the default view", () => {
    expect(FOCUS_LIMITS.yaw).toBeLessThan(LIMITS.yaw);
    expect(FOCUS_LIMITS.pitch).toBeLessThan(LIMITS.pitch);
  });

  it("fits the 28 x 21 cm glass: height-limited on wide displays, width-limited on tall ones", () => {
    const wide = focusDistance(2, 35);
    expect(wide).toBeCloseTo((21 * 1.12) / 2 / Math.tan((35 * Math.PI) / 360), 5);
    expect(focusDistance(0.46, 35)).toBeGreaterThan(wide * 2);
  });
});
