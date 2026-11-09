// Render-on-demand loop. It runs only while `update` reports motion or
// someone called invalidate(), so an idle scene renders no frames.
export function createLoop({ update, render, onFrameCost }) {
  let raf = 0;
  let last = 0;
  let stopped = false;
  let capMs = 0;

  return { invalidate, stop, resume, setFpsCap: (ms) => { capMs = ms; } };

  function invalidate() {
    if (stopped || raf) return;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  }

  function resume() {
    stopped = false;
    invalidate();
  }

  function tick(now) {
    raf = 0;
    if (capMs && last && now - last < capMs - 3) {
      invalidate();
      return;
    }
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
    const more = update(dt, now);
    const t0 = performance.now();
    render();
    onFrameCost?.(performance.now() - t0);
    last = more ? now : 0;
    if (more) invalidate();
  }
}

// Collects render cost over a window of frames. Returns true once per window
// when the average exceeds the limit.
export function createFrameMeter(limitMs, windowSize = 60) {
  let sum = 0;
  let count = 0;
  return { push };

  function push(ms) {
    sum += ms;
    count += 1;
    if (count < windowSize) return false;
    const slow = sum / count > limitMs;
    sum = 0;
    count = 0;
    return slow;
  }
}
