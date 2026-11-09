// Scene core: renderer, render-on-demand loop, resize, pointer input, context loss.
// The desk wiring (screen, power, terminal, audio) lives in desk.js and plugs in here.
import { PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import { createCameraRig } from "./camera.js";
import { createFrameMeter, createLoop } from "./loop.js";
import { setupLighting } from "./lighting.js";
import { createPicker } from "./picking.js";
import { createPost } from "./post.js";
import { buildCRT } from "./models/crt.js";
import { buildContactShadow, buildDesk } from "./models/desk.js";
import { buildPC, CASE } from "./models/pc.js";
import { buildProps } from "./models/props.js";

const CONTEXT_RESTORE_MS = 3000;
const TAP_MAX_PX = 6;
const TAP_MAX_MS = 500;
const BUTTON_TRAVEL_CM = 0.2;

// Frame demand levels a ticker can return.
export const DEMAND = { NONE: 0, SLOW: 1, FULL: 2 };

export function createScene(canvas, { onFatal = () => {}, reducedMotion = false } = {}) {
  const mobile = matchMedia("(pointer: coarse)").matches || innerWidth < 700;
  const budget = mobile ? { maxRatio: 1.5, limitMs: 20 } : { maxRatio: 2, limitMs: 15 };

  const renderer = new WebGLRenderer({ canvas, antialias: true });
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 1, 600);
  const meter = createFrameMeter(budget.limitMs);
  const tickers = [];
  const beforeRender = [];
  const hooks = { tap: () => {}, hover: () => {}, resize: () => {} };
  let pixelRatio = Math.min(devicePixelRatio, budget.maxRatio);
  let wakeTimer = 0;
  let breathing = false;
  const restPosition = new Vector3();

  const rig = createCameraRig(camera, { invalidate: () => loop.invalidate(), reducedMotion });
  const loop = createLoop({ update, render, onFrameCost });
  const lights = setupLighting(scene, renderer);
  const post = createPost(renderer, scene, camera);
  const parts = buildWorld();
  const picker = createPicker(camera, canvas, {
    "power-button": parts.powerButton,
    screen: parts.screen,
    lamp: parts.lamp,
    floppy: parts.floppy,
  });

  scene.updateMatrixWorld(true);
  rig.setScreenCenter(parts.screen.getWorldPosition(new Vector3()));
  resize();
  new ResizeObserver(resize).observe(canvas);
  bindPointer();
  bindContextLoss();

  return {
    renderer, camera, scene, rig, loop, parts, lights, picker,
    invalidate: () => loop.invalidate(),
    addTicker: (fn) => tickers.push(fn),
    addBeforeRender: (fn) => beforeRender.push(fn),
    onTap: (fn) => (hooks.tap = fn),
    onHover: (fn) => (hooks.hover = fn),
    onResize: (fn) => (hooks.resize = fn),
    setPowerHighlight,
    setBreathing: (on) => { breathing = on; },
    setCursor: (c) => { canvas.style.cursor = c; },
    firstFrame,
    get pixelRatio() { return pixelRatio; },
  };

  function buildWorld() {
    const desk = buildDesk();
    const pc = buildPC();
    const crt = buildCRT();
    crt.position.set(0, CASE.h, 0);

    const props = buildProps();

    const caseShadow = buildContactShadow(CASE.w + 14, CASE.d + 14);
    caseShadow.position.set(0, 0.35, 0);
    scene.add(desk, caseShadow, pc, crt, props);
    return { ...pc.userData.parts, ...crt.userData.parts, ...props.userData.parts, pc, crt, desk, props, caseShadow };
  }

  // Runs the rig and every ticker. Tells the loop how fast to go, or to stop.
  function update(dt, now) {
    let level = rig.update(dt, now) ? DEMAND.FULL : DEMAND.NONE;
    for (const t of tickers) level = Math.max(level, t(dt, now) ?? 0);
    loop.setFpsCap(level === DEMAND.SLOW ? 33 : 0);
    if (level === DEMAND.NONE) scheduleIdleWake(now);
    return level > DEMAND.NONE;
  }

  // The orbit springs back after 6 s idle. Wake the loop for it, and only then.
  function scheduleIdleWake(now) {
    clearTimeout(wakeTimer);
    const ms = rig.idleWakeMs(now);
    if (ms !== null) wakeTimer = setTimeout(() => loop.invalidate(), ms);
  }

  function render() {
    for (const fn of beforeRender) fn(renderer);
    if (breathing) sway();
    post.render();
    if (breathing) camera.position.copy(restPosition);
  }

  // A slow, tiny drift of the camera, so a still room does not look frozen. Undone after each frame.
  function sway() {
    const t = performance.now() / 1000;
    restPosition.copy(camera.position);
    camera.position.x += Math.sin(t * 0.55) * 0.14;
    camera.position.y += Math.sin(t * 0.41 + 1) * 0.1;
    camera.updateMatrixWorld();
  }

  function onFrameCost(ms) {
    if (!meter.push(ms)) return;
    if (post.bloom) post.setBloom(false); // bloom goes first, then resolution
    else if (pixelRatio > 1) pixelRatio = Math.max(1, pixelRatio - 0.25);
    else return;
    resize();
  }

  function resize() {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    post.setSize(w, h, pixelRatio);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    rig.resize(camera.aspect);
    hooks.resize(w, h);
    loop.invalidate();
  }

  function setPowerHighlight(on) {
    const mat = parts.powerButton.material;
    mat.emissive.setHex(on ? 0x6fa8ff : 0x000000);
    mat.emissiveIntensity = 0.6;
    loop.invalidate();
  }

  function bindPointer() {
    let down = null;
    let hover = null;

    canvas.addEventListener("pointerdown", (e) => {
      const name = picker.pick(e.clientX, e.clientY);
      down = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), name, moved: false };
      canvas.setPointerCapture(e.pointerId);
      if (name === "power-button") pressButton(true);
      else rig.dragStart(performance.now());
    });
    canvas.addEventListener("pointermove", (e) => {
      if (down && down.id === e.pointerId) {
        if (Math.hypot(e.clientX - down.x0, e.clientY - down.y0) > TAP_MAX_PX) down.moved = true;
        if (down.name !== "power-button") rig.dragMove(e.clientX - down.x, e.clientY - down.y, performance.now());
        down.x = e.clientX;
        down.y = e.clientY;
      } else if (!down) {
        setHover(picker.pick(e.clientX, e.clientY));
      }
    });
    const end = (e, cancelled) => {
      if (!down || down.id !== e.pointerId) return;
      const d = down;
      down = null;
      pressButton(false);
      if (d.name !== "power-button") rig.dragEnd(performance.now());
      const quick = performance.now() - d.t0 < TAP_MAX_MS;
      if (!cancelled && !d.moved && quick) hooks.tap(picker.pick(e.clientX, e.clientY), e);
    };
    canvas.addEventListener("pointerup", (e) => end(e, false));
    canvas.addEventListener("pointercancel", (e) => end(e, true));
    canvas.addEventListener("pointerleave", () => { if (!down) setHover(null); });

    function setHover(name) {
      if (name === hover) return;
      hover = name;
      hooks.hover(name);
    }
  }

  // The power button travels 2 mm on press.
  function pressButton(on) {
    const wantZ = on ? 0.45 - BUTTON_TRAVEL_CM : 0.45;
    if (parts.powerButton.position.z === wantZ) return;
    parts.powerButton.position.z = wantZ;
    loop.invalidate();
  }

  function bindContextLoss() {
    let timer = 0;
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      loop.stop();
      timer = setTimeout(onFatal, CONTEXT_RESTORE_MS);
    });
    canvas.addEventListener("webglcontextrestored", () => {
      clearTimeout(timer);
      resize();
      loop.resume();
    });
  }

  function firstFrame() {
    loop.invalidate();
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
}
