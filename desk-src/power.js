// The power state machine and its timings. Every other module reads the state
// and subscribes to changes. Nothing else sets it.
export const S = { OFF: "OFF", POWERING: "POWERING", POST: "POST", BOOTING: "BOOTING", READY: "READY", HALTING: "HALTING" };

export const TIMINGS = {
  cold: { POWERING: 1200, POST: 1300, BOOTING: 2500 },
  fast: { POWERING: 400, POST: 300, BOOTING: 800 },
  halting: 1000,
  rampCold: 400, // the white dot grows into the picture
  rampFast: 250,
  collapse: 300, // the picture collapses to a dot at the end of HALTING
};

export const LEGAL = {
  OFF: ["POWERING", "READY"], // READY directly is the reduced-motion path
  POWERING: ["POST", "READY", "HALTING"],
  POST: ["BOOTING", "READY", "HALTING"],
  BOOTING: ["READY", "HALTING"],
  READY: ["HALTING"],
  HALTING: ["OFF"],
};

export function createPower({
  reducedMotion = false,
  isFast = () => false,
  timers = { set: (f, ms) => setTimeout(f, ms), clear: (id) => clearTimeout(id) },
  now = () => performance.now(),
} = {}) {
  let state = S.OFF;
  let since = now();
  let fast = false;
  let timer = null;
  let rebootPending = false;
  const listeners = new Set();

  return {
    get state() { return state; },
    get fast() { return fast; },
    get since() { return since; },
    get animating() { return state !== S.OFF && state !== S.READY; },
    get durations() { return fast ? TIMINGS.fast : TIMINGS.cold; },
    elapsed: () => now() - since,
    subscribe, press, skip, reboot, powerOnFast,
  };

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  // The power button. OFF and HALTING aside, it always starts HALTING.
  function press() {
    if (state === S.OFF) return powerOn(isFast());
    if (state === S.HALTING) return false;
    return halt();
  }

  // Power on with the fast path, used by the `#cat=` link.
  function powerOnFast() {
    return state === S.OFF ? powerOn(true) : false;
  }

  // Any key or click during POWERING, POST or BOOTING jumps to READY.
  function skip() {
    if (state !== S.POWERING && state !== S.POST && state !== S.BOOTING) return false;
    return go(S.READY);
  }

  function reboot() {
    if (state === S.OFF || state === S.HALTING) return false;
    rebootPending = true;
    return halt();
  }

  function powerOn(useFast) {
    fast = useFast;
    return go(reducedMotion ? S.READY : S.POWERING);
  }

  function halt() {
    return go(S.HALTING);
  }

  function go(next) {
    if (!LEGAL[state].includes(next)) return false;
    const prev = state;
    state = next;
    since = now();
    timers.clear(timer);
    timer = null;
    schedule();
    for (const fn of [...listeners]) fn(next, prev);
    return true;
  }

  function schedule() {
    const d = TIMINGS[fast ? "fast" : "cold"];
    if (state === S.POWERING) timer = timers.set(() => go(S.POST), d.POWERING);
    else if (state === S.POST) timer = timers.set(() => go(S.BOOTING), d.POST);
    else if (state === S.BOOTING) timer = timers.set(() => go(S.READY), d.BOOTING);
    else if (state === S.HALTING) timer = timers.set(finishHalt, reducedMotion ? 0 : TIMINGS.halting);
  }

  function finishHalt() {
    go(S.OFF);
    if (rebootPending) {
      rebootPending = false;
      powerOn(fast);
    }
  }
}

// The picture amount for the shader: 0 is dark, 1 is the full picture.
export function powerCurve(state, elapsed, fast) {
  const ramp = fast ? TIMINGS.rampFast : TIMINGS.rampCold;
  if (state === S.OFF) return 0;
  if (state === S.POWERING) return Math.min(1, elapsed / ramp);
  if (state === S.HALTING) {
    const start = TIMINGS.halting - TIMINGS.collapse;
    return elapsed <= start ? 1 : Math.max(0, 1 - (elapsed - start) / TIMINGS.collapse);
  }
  return 1;
}
