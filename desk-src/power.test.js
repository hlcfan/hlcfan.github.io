import { describe, expect, it } from "vitest";
import { LEGAL, S, TIMINGS, createPower, powerCurve } from "./power.js";
import { KERNEL_LOG, biosFrame, bootFrame } from "./boot-script.js";

// A fake clock: timers fire when advance() passes their due time.
function clock() {
  let t = 0;
  let id = 0;
  const pending = new Map();
  return {
    now: () => t,
    timers: {
      set: (fn, ms) => (pending.set(++id, { fn, at: t + ms }), id),
      clear: (i) => pending.delete(i),
    },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        const next = [...pending.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        pending.delete(next[0]);
        t = next[1].at;
        next[1].fn();
      }
      t = end;
    },
  };
}

function setup(opts = {}) {
  const c = clock();
  const log = [];
  const p = createPower({ ...opts, timers: c.timers, now: c.now });
  p.subscribe((s) => log.push(s));
  return { p, c, log };
}

describe("power state machine", () => {
  it("runs a cold boot through every state in order", () => {
    const { p, c, log } = setup();
    expect(p.state).toBe(S.OFF);
    p.press();
    c.advance(TIMINGS.cold.POWERING + TIMINGS.cold.POST + TIMINGS.cold.BOOTING);
    expect(log).toEqual([S.POWERING, S.POST, S.BOOTING, S.READY]);
    expect(TIMINGS.cold.POWERING + TIMINGS.cold.POST + TIMINGS.cold.BOOTING).toBe(5000);
  });

  it("uses the fast timings when asked", () => {
    const { p, c, log } = setup({ isFast: () => true });
    p.press();
    c.advance(1500);
    expect(log.at(-1)).toBe(S.READY);
  });

  it("jumps to READY on skip during the boot states only", () => {
    const { p, c } = setup();
    expect(p.skip()).toBe(false);
    p.press();
    c.advance(1300);
    expect(p.state).toBe(S.POST);
    expect(p.skip()).toBe(true);
    expect(p.state).toBe(S.READY);
    expect(p.skip()).toBe(false);
  });

  it("the power button halts from any running state and does nothing while halting", () => {
    for (const advance of [100, 1500, 3000, 6000]) {
      const { p, c } = setup();
      p.press();
      c.advance(advance);
      expect(p.press()).toBe(true);
      expect(p.state).toBe(S.HALTING);
      expect(p.press()).toBe(false);
      expect(p.state).toBe(S.HALTING);
      c.advance(TIMINGS.halting);
      expect(p.state).toBe(S.OFF);
    }
  });

  it("a halted boot never reaches READY", () => {
    const { p, c, log } = setup();
    p.press();
    c.advance(500);
    p.press();
    c.advance(10000);
    expect(log).toEqual([S.POWERING, S.HALTING, S.OFF]);
  });

  it("reboot halts, passes OFF, then powers on with no pause", () => {
    const { p, c, log } = setup({ isFast: () => true });
    p.press();
    c.advance(1500);
    log.length = 0;
    expect(p.reboot()).toBe(true);
    c.advance(TIMINGS.halting);
    expect(log).toEqual([S.HALTING, S.OFF, S.POWERING]);
  });

  it("reboot is rejected when OFF or already halting", () => {
    const { p } = setup();
    expect(p.reboot()).toBe(false);
  });

  it("reduced motion goes OFF to READY with no animation, and halts at once", () => {
    const { p, c, log } = setup({ reducedMotion: true });
    p.press();
    expect(p.state).toBe(S.READY);
    p.press();
    c.advance(0);
    expect(log).toEqual([S.READY, S.HALTING, S.OFF]);
  });

  it("powerOnFast works only from OFF", () => {
    const { p } = setup();
    expect(p.powerOnFast()).toBe(true);
    expect(p.fast).toBe(true);
    expect(p.powerOnFast()).toBe(false);
  });

  it("READY can only go to HALTING, and HALTING only to OFF", () => {
    expect(LEGAL.READY).toEqual(["HALTING"]);
    expect(LEGAL.HALTING).toEqual(["OFF"]);
  });
});

describe("powerCurve", () => {
  it("ramps up on power on, holds, and collapses at the end of HALTING", () => {
    expect(powerCurve(S.OFF, 0, false)).toBe(0);
    expect(powerCurve(S.POWERING, 0, false)).toBe(0);
    expect(powerCurve(S.POWERING, TIMINGS.rampCold, false)).toBe(1);
    expect(powerCurve(S.POWERING, 200, false)).toBeCloseTo(0.5);
    expect(powerCurve(S.READY, 5, false)).toBe(1);
    expect(powerCurve(S.HALTING, 100, false)).toBe(1);
    expect(powerCurve(S.HALTING, TIMINGS.halting - TIMINGS.collapse / 2, false)).toBeCloseTo(0.5);
    expect(powerCurve(S.HALTING, TIMINGS.halting, false)).toBe(0);
  });
});

describe("boot screens", () => {
  it("counts memory up to 65536K OK", () => {
    const mid = biosFrame(500, 1300).rows.find((r) => r.t.startsWith("Memory Test"));
    expect(mid.t).not.toContain("OK");
    const end = biosFrame(1300, 1300).rows.find((r) => r.t.startsWith("Memory Test"));
    expect(end.t).toBe("Memory Test : 65536K OK");
  });

  it("fits both layouts and ends with the DEL prompt", () => {
    for (const [cols, rows] of [[80, 30], [40, 15]]) {
      const f = biosFrame(1300, 1300, { cols, rows });
      expect(f.rows).toHaveLength(rows);
      expect(f.rows.every((r) => r.t.length <= cols)).toBe(true);
      expect(f.rows.at(-2).t).toBe("Press DEL to enter SETUP");
    }
  });

  it("shows LILO first, then the kernel log, ending with all lines", () => {
    expect(bootFrame(0, 2500).rows[0].t).toMatch(/^LILO boot:/);
    expect(bootFrame(0, 2500).lines).toBe(0);
    const end = bootFrame(2500, 2500, { cols: 40, rows: 15 });
    expect(end.lines).toBe(KERNEL_LOG.length);
    expect(end.rows).toHaveLength(15);
    expect(end.rows.every((r) => r.t.length <= 40)).toBe(true);
    expect(KERNEL_LOG.length).toBeGreaterThanOrEqual(38);
    expect(KERNEL_LOG[0]).toContain("2.2.17");
  });

  it("kernel line count never goes backwards", () => {
    let last = 0;
    for (let t = 0; t <= 2500; t += 25) {
      const n = bootFrame(t, 2500).lines;
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
  });
});
