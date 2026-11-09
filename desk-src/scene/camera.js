// Limited orbit camera: a fixed diorama view with a small drag range,
// inertia, and a slow spring back to center after idle.
import { Vector3 } from "three";

export const LIMITS = { yaw: rad(18), pitch: rad(10) };
export const FOCUS_LIMITS = { yaw: rad(4), pitch: rad(4) };
export const IDLE_RETURN_MS = 6000;
export const FOCUS_TWEEN_MS = 600;
export const FOCUS_MARGIN = 1.12;
export const SCREEN_CM = { w: 28, h: 21 };

const TARGET = new Vector3(0, 20, 10);
const BASE = new Vector3(0, 66, 132);
const HALF_WIDTH_CM = 46;

export function createCameraRig(camera, { invalidate, reducedMotion }) {
  const state = newRigState();
  const baseOffset = BASE.clone().sub(TARGET);
  const screenCenter = new Vector3(0, 34, 20);
  const focus = { want: 0, p: 0 };
  let fitScale = 1;
  let aspect = 1.78;

  apply();

  return {
    state,
    get focused() { return focus.want === 1; },
    dragStart: (now) => { if (!reducedMotion) dragStart(state, now); },
    dragMove: (dx, dy, now) => { if (!reducedMotion) { dragMove(state, dx, dy, now); apply(); invalidate(); } },
    dragEnd: (now) => { dragEnd(state, now); invalidate(); },
    setScreenCenter: (v) => { screenCenter.copy(v); apply(); },
    setFocus,
    update,
    resize,
    idleWakeMs: (now) => idleWakeMs(state, now),
  };

  // Moves the camera in front of the screen over 600 ms (at once with reduced motion).
  function setFocus(on) {
    focus.want = on ? 1 : 0;
    if (reducedMotion) focus.p = focus.want;
    state.lastInput = performance.now();
    apply();
    invalidate();
  }

  function update(dt, now) {
    let tweening = false;
    if (focus.p !== focus.want) {
      const step = dt / (FOCUS_TWEEN_MS / 1000);
      focus.p = focus.want > focus.p ? Math.min(1, focus.p + step) : Math.max(0, focus.p - step);
      tweening = focus.p !== focus.want;
    }
    const moving = stepRig(state, dt, now);
    apply();
    return moving || tweening;
  }

  function resize(nextAspect) {
    aspect = nextAspect;
    fitScale = fitDistanceScale(aspect, camera.fov);
    apply();
  }

  function apply() {
    const e = ease(focus.p);
    state.limYaw = lerp(LIMITS.yaw, FOCUS_LIMITS.yaw, e);
    state.limPitch = lerp(LIMITS.pitch, FOCUS_LIMITS.pitch, e);
    state.yaw = clamp(state.yaw, -state.limYaw, state.limYaw);
    state.pitch = clamp(state.pitch, -state.limPitch, state.limPitch);

    const target = TARGET.clone().lerp(screenCenter, e);
    const wide = baseOffset.clone().multiplyScalar(fitScale);
    const close = new Vector3(0, 0, focusDistance(aspect, camera.fov));
    const offset = wide.lerp(close, e);
    offset.applyAxisAngle(new Vector3(1, 0, 0), -state.pitch);
    offset.applyAxisAngle(new Vector3(0, 1, 0), state.yaw);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
  }
}

// Distance from the screen plane that fits the glass, plus a margin, in view.
export function focusDistance(aspect, fovDeg) {
  const t = Math.tan(rad(fovDeg) / 2);
  const fitH = (SCREEN_CM.h * FOCUS_MARGIN) / 2 / t;
  const fitW = (SCREEN_CM.w * FOCUS_MARGIN) / 2 / (t * aspect);
  return Math.max(fitH, fitW);
}

export function newRigState() {
  return { yaw: 0, pitch: 0, vyaw: 0, vpitch: 0, dragging: false, lastInput: 0, lastMove: 0, limYaw: LIMITS.yaw, limPitch: LIMITS.pitch };
}

export function dragStart(state, now) {
  state.dragging = true;
  state.vyaw = 0;
  state.vpitch = 0;
  state.lastInput = now;
  state.lastMove = now;
}

export function dragMove(state, dx, dy, now) {
  const k = rad(0.12);
  const dyaw = -dx * k;
  const dpitch = dy * k;
  const dt = Math.max((now - state.lastMove) / 1000, 0.001);
  state.yaw = clamp(state.yaw + dyaw, -state.limYaw, state.limYaw);
  state.pitch = clamp(state.pitch + dpitch, -state.limPitch, state.limPitch);
  state.vyaw = state.vyaw * 0.5 + (dyaw / dt) * 0.5;
  state.vpitch = state.vpitch * 0.5 + (dpitch / dt) * 0.5;
  state.lastMove = now;
  state.lastInput = now;
}

export function dragEnd(state, now) {
  state.dragging = false;
  state.lastInput = now;
  if (now - state.lastMove > 80) {
    state.vyaw = 0;
    state.vpitch = 0;
  }
}

// Advances inertia and the idle spring. Returns true while the rig still moves.
export function stepRig(state, dt, now) {
  if (state.dragging) return true;

  const decay = Math.exp(-dt * 4);
  state.vyaw *= decay;
  state.vpitch *= decay;
  state.yaw = clamp(state.yaw + state.vyaw * dt, -state.limYaw, state.limYaw);
  state.pitch = clamp(state.pitch + state.vpitch * dt, -state.limPitch, state.limPitch);
  if (Math.abs(state.vyaw) < 1e-3) state.vyaw = 0;
  if (Math.abs(state.vpitch) < 1e-3) state.vpitch = 0;

  const rotated = state.yaw !== 0 || state.pitch !== 0;
  const inertial = state.vyaw !== 0 || state.vpitch !== 0;
  if (!rotated && !inertial) return false;
  if (inertial) return true;

  // Waiting for the idle timer. The scene wakes the loop with idleWakeMs().
  if (now - state.lastInput < IDLE_RETURN_MS) return false;
  const pull = Math.exp(-dt * 1.5);
  state.yaw *= pull;
  state.pitch *= pull;
  if (Math.abs(state.yaw) < 1e-3 && Math.abs(state.pitch) < 1e-3) {
    state.yaw = 0;
    state.pitch = 0;
    return false;
  }
  return true;
}

// Milliseconds until the idle spring starts, or null when nothing is pending.
export function idleWakeMs(state, now) {
  const off = state.yaw !== 0 || state.pitch !== 0;
  if (state.dragging || !off) return null;
  return Math.max(0, IDLE_RETURN_MS - (now - state.lastInput)) + 16;
}

// Scale applied to the base distance so a 92 cm wide slice stays in view on tall screens.
export function fitDistanceScale(aspect, fovDeg) {
  const baseDist = BASE.clone().sub(TARGET).length();
  const need = HALF_WIDTH_CM / (Math.tan(rad(fovDeg) / 2) * aspect);
  return clamp(need / baseDist, 1, 2.2);
}

function ease(p) {
  return p * p * (3 - 2 * p);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function rad(deg) {
  return (deg * Math.PI) / 180;
}
