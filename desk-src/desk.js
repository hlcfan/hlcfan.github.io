// Desk wiring: connects the 3D scene, power state machine, CRT screen,
// terminal session, audio and accessibility controls.
import { Box3, Vector3 } from "three";
import { createScene, DEMAND } from "./scene/scene.js";
import { buildScreenOverlay } from "./scene/models/crt.js";
import { createPower, powerCurve, S } from "./power.js";
import { biosFrame, blankFrame, bootFrame, haltFrame } from "./boot-script.js";
import { createContent } from "./content.js";
import { createAudio } from "./audio/audio.js";
import { createLiveRegion } from "./a11y/live-region.js";
import { createProxyControls } from "./a11y/proxy-controls.js";
import { CRT_DEFAULTS, createCrtMaterial, createScreenTexture, setCrtEnabled } from "./screen/crt-shader.js";
import { loadFont } from "./screen/font.js";
import { LAYOUTS, pickLayout } from "./screen/layout.js";
import { createScreenCanvas, uploadBands } from "./screen/screen-canvas.js";
import { THEMES } from "./screen/themes.js";
import { NOW } from "./terminal/fs.js";
import { createSession } from "./terminal/session.js";
import { createTerminal } from "./terminal/terminal.js";

const ACTIVE_WINDOW_MS = 10000;
const GITHUB_URL = "https://github.com/hlcfan";
const FLOPPY_MS = 900;
const SLOT = { x: -9, y: 10.2, z: 21.6 };
const LED = { amber: 0xffa000, green: 0x30ff40, hddOn: 0x30ff60, hddOff: 0x103a1c };

export async function startDesk(canvas, { onFatal }) {
  const root = document.documentElement;
  const base = root.dataset.base ?? "";
  const local = safeStorage("localStorage");
  const tab = safeStorage("sessionStorage");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const muteButton = document.getElementById("desk-mute");

  const scene = createScene(canvas, { onFatal, reducedMotion: reduced });
  const audio = createAudio({ storage: local });
  const power = createPower({ reducedMotion: reduced, isFast: () => local.get("desk.booted") === "1" });
  const screen = createScreenCanvas();
  const texture = createScreenTexture(screen.canvas);
  const crtMaterial = createCrtMaterial(texture);
  const live = createLiveRegion();
  const content = createContent({ base });
  const term = createTerminal({
    onChange: () => scene.invalidate(),
    onPrint: (lines, label) => live.announce(lines, label),
  });
  const session = createSession({ term, storage: tab.raw, host: hostApi() });
  const proxy = createProxyControls({
    before: muteButton,
    onPower: pressPower,
    onText: (text) => { touchInput(); audio.play("keyClick"); session.onText(text); },
    onKey: onProxyKey,
    onFocusChange,
  });

  let layout = LAYOUTS.wide;
  let focus = false;
  let hover = null;
  let lastInput = performance.now();
  let crtOn = local.get("desk.crt") !== "off";
  let hddUntil = 0;
  let seekLines = 0;
  let brightness = 0;
  let lastSample = 0;
  let inserting = null; // floppy insert animation {t0}
  let pendingCat = location.hash.match(/^#cat=([\w-]+)$/)?.[1] ?? null;
  const center = new Vector3();
  const top = new Vector3();
  const bottom = new Vector3();
  const probe = document.createElement("canvas");
  probe.width = 16;
  probe.height = 12;
  const probeCtx = probe.getContext("2d", { willReadFrequently: true });

  buildScreenOverlay(scene.parts.screen, crtMaterial);
  scene.parts.clock.update();
  setInterval(() => { scene.parts.clock.update(); scene.invalidate(); }, 30000);
  screen.setTheme(THEMES[local.get("desk.theme")] ? local.get("desk.theme") : "green");
  setCrtEnabled(crtMaterial, crtOn);
  root.dataset.deskState = power.state;
  root.dataset.deskLayout = layout.name;

  onResize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight);
  scene.onResize(onResize);
  scene.onTap(onTap);
  scene.onHover(onHover);
  scene.addBeforeRender(beforeRender);
  scene.addTicker(demand);
  power.subscribe(onPowerChange);
  bindGlobalInput();
  bindMute();
  bindViewport();
  bindList();
  setInterval(() => { if (power.state === S.READY) scene.invalidate(); }, 500);

  loadFont(base).then((ok) => { if (ok) { screen.refit(); scene.invalidate(); } });
  content.loadPosts().then((posts) => session.setPosts(posts)).catch(() => {});

  await scene.firstFrame();
  if (local.get("desk.test") === "1") window.__deskTest = { point: pointOf };
  if (pendingCat) power.powerOnFast();
  return { scene, power, term, session };

  // Test support, enabled by localStorage "desk.test": where a part is on the page, in client px.
  function pointOf(name) {
    const obj = scene.parts[name === "lamp" ? "lampBulb" : name]; // the lamp group is mostly empty air
    const c = new Box3().setFromObject(obj).getCenter(new Vector3()).project(scene.camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + ((c.x + 1) / 2) * r.width, y: r.top + ((1 - c.y) / 2) * r.height };
  }

  // ---- power and screen --------------------------------------------------

  function onPowerChange(state, prev) {
    root.dataset.deskState = state;
    if (state === S.POWERING) {
      audio.play("degaussThump");
      audio.fanOn(1.2);
    } else if (state === S.POST) {
      audio.play("postBeep");
    } else if (state === S.BOOTING) {
      seekLines = 0;
    } else if (state === S.READY) {
      onReady();
    } else if (state === S.HALTING) {
      exitFocus();
      session.cancel(true);
      term.setProgram(null);
      audio.fanOff(2);
      audio.play("degaussThump");
    }
    scene.invalidate();
  }

  function onReady() {
    local.set("desk.booted", "1");
    audio.fanOn(1.2);
    session.reset();
    live.announce("System ready");
    if (layout.name === "narrow") enterFocus();
    if (pendingCat) runPendingCat();
  }

  async function runPendingCat() {
    const slug = pendingCat;
    pendingCat = null;
    try {
      const posts = await content.loadPosts();
      session.setPosts(posts);
      const post = posts.find((p) => p.slug === slug);
      session.runLine(post ? `cat /home/alex/posts/${post.date}-${post.slug}.md` : `cat /home/alex/posts/${slug}`);
    } catch {
      term.print("cat: could not load posts", { c: "err" });
    }
  }

  function pressPower() {
    touchInput();
    if (power.press()) audio.play("relayClick");
  }

  // Frames are drawn into the canvas, changed rows go to the GPU, and uniforms follow the state.
  function beforeRender(renderer) {
    const now = performance.now();
    const frame = currentFrame(now);
    const changed = screen.draw(frame);
    uploadBands(renderer, texture, screen.canvas, changed);

    const u = crtMaterial.uniforms;
    u.uPower.value = reduced && power.state !== S.OFF ? 1 : powerCurve(power.state, power.elapsed(), power.fast);
    u.uTime.value = now / 1000;
    u.uFlicker.value = crtOn && !reduced && now - lastInput < ACTIVE_WINDOW_MS ? CRT_DEFAULTS.flicker : 0;
    u.uScreenHeightPx.value = screenHeightPx(renderer);

    if (changed.length && now - lastSample > 250) {
      lastSample = now;
      brightness = sampleBrightness();
    }
    scene.parts.glow.material.opacity = Math.min(0.6, brightness * u.uPower.value * 2.4);
    updateLeds(now);
    animateSteam(now);
    animateFloppy(now);
  }

  function currentFrame(now) {
    const dims = { cols: layout.cols, rows: layout.rows };
    const t = power.elapsed();
    switch (power.state) {
      case S.POWERING: return blankFrame("glow", layout.rows);
      case S.POST: return biosFrame(t, power.durations.POST, dims);
      case S.BOOTING: return bootWithSound(bootFrame(t, power.durations.BOOTING, dims));
      case S.HALTING: return haltFrame(dims);
      case S.READY: return readyFrame(now);
      default: return blankFrame("black", layout.rows);
    }
  }

  function readyFrame(now) {
    const frame = term.frame();
    if (frame.cursor) {
      const blinkOn = Math.floor(now / 500) % 2 === 0;
      frame.cursor.mode = proxy.inputFocused ? (blinkOn ? "block" : "off") : "hollow";
    }
    return frame;
  }

  // A seek sound and an HDD blink for each new kernel line.
  function bootWithSound(frame) {
    if (frame.lines > seekLines) {
      seekLines = frame.lines;
      audio.play("hddSeek");
      hddPulse(45);
    }
    return frame;
  }

  function demand(dt, now) {
    if (power.animating || inserting) return DEMAND.FULL;
    if (power.state === S.READY && now - lastInput < ACTIVE_WINDOW_MS) return DEMAND.SLOW;
    return DEMAND.NONE;
  }

  // Height of the glass on the display in device pixels. The shader sizes scanlines from it.
  function screenHeightPx(renderer) {
    scene.camera.updateMatrixWorld();
    scene.parts.screen.getWorldPosition(center);
    top.set(center.x, center.y + 10.5, center.z).project(scene.camera);
    bottom.set(center.x, center.y - 10.5, center.z).project(scene.camera);
    return (Math.abs(top.y - bottom.y) / 2) * renderer.domElement.height;
  }

  function sampleBrightness() {
    probeCtx.drawImage(screen.canvas, 0, 0, 16, 12);
    const d = probeCtx.getImageData(0, 0, 16, 12).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
    return sum / (16 * 12 * 3 * 255);
  }

  function updateLeds(now) {
    const { powerLed, hddLed } = scene.parts;
    powerLed.material.color.setHex(power.state === S.OFF ? LED.amber : LED.green);
    const flicker = power.state === S.POST && (Math.floor(now / 60) * 7919) % 3 === 0;
    hddLed.material.color.setHex(now < hddUntil || flicker ? LED.hddOn : LED.hddOff);
  }

  function hddPulse(ms) {
    hddUntil = performance.now() + ms;
    scene.invalidate();
    setTimeout(() => scene.invalidate(), ms + 20);
  }

  // ---- layout and focus --------------------------------------------------

  function onResize(w, h) {
    const next = pickLayout(w, h);
    if (next === layout) return;
    layout = next;
    root.dataset.deskLayout = next.name;
    screen.setLayout(next);
    term.resize(next.cols, next.rows);
    if (power.state === S.READY && next.name === "narrow") enterFocus();
  }

  function enterFocus() {
    if (focus) return;
    focus = true;
    scene.rig.setFocus(true);
    proxy.focusInput();
    scene.invalidate();
  }

  function exitFocus() {
    if (!focus) return;
    focus = false;
    scene.rig.setFocus(false);
    proxy.blurInput();
    scene.invalidate();
  }

  // ---- input -------------------------------------------------------------

  function onTap(name) {
    touchInput();
    if (name === "power-button") return pressPower();
    if (isBooting()) return void power.skip();
    if (name === "lamp") return toggleLamp();
    if (name === "floppy") return insertFloppy();
    if (name === "note") return showNote();
    if (power.state !== S.READY) return;
    if (name === "screen") {
      if (!focus) enterFocus();
      else proxy.focusInput();
    } else if (focus) {
      exitFocus();
    }
  }

  function onHover(name) {
    hover = name;
    refreshHighlight();
    const clickable = ["power-button", "lamp", "floppy", "note"].includes(name) || (name === "screen" && power.state === S.READY && !focus);
    scene.setCursor(clickable ? "pointer" : "");
  }

  function refreshHighlight() {
    scene.setPowerHighlight(hover === "power-button" || document.activeElement === proxy.power);
  }

  function onFocusChange(which) {
    if (which === "power") refreshHighlight();
    scene.invalidate();
  }

  function onProxyKey(k) {
    touchInput();
    if (power.state !== S.READY) return false;
    const used = session.onKey(k);
    if (used) audio.play("keyClick");
    return used;
  }

  function bindGlobalInput() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") return onEscape(e);
      if (isBooting() && !e.repeat && e.target !== proxy.power) {
        touchInput();
        power.skip();
        return;
      }
      const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
      if (plain && focus && power.state === S.READY && document.activeElement === document.body) proxy.focusInput();
    }, true);

    // Any click skips the boot. The power button, the canvas (handled as taps) and mute are not skip input.
    document.addEventListener("click", (e) => {
      if (!isBooting()) return;
      if (e.target === canvas || e.target === proxy.power || e.target.closest?.("#desk-mute")) return;
      power.skip();
    }, true);

    canvas.addEventListener("wheel", (e) => {
      if (!focus || power.state !== S.READY) return;
      e.preventDefault();
      touchInput();
      if (term.program) session.onKey({ key: e.deltaY > 0 ? "ArrowDown" : "ArrowUp" });
      else term.scrollBy(e.deltaY < 0 ? 3 : -3);
    }, { passive: false });
  }

  // First Esc: leave the input for the mute button. Second Esc: leave focus mode.
  function onEscape(e) {
    if (proxy.inputFocused) {
      e.preventDefault();
      proxy.blurInput();
      muteButton.focus();
    } else if (focus) {
      e.preventDefault();
      exitFocus();
    }
  }

  function touchInput() {
    lastInput = performance.now();
    scene.invalidate();
  }

  function isBooting() {
    return power.state === S.POWERING || power.state === S.POST || power.state === S.BOOTING;
  }

  // ---- props -------------------------------------------------------------

  function toggleLamp() {
    const on = scene.lights.lamp.intensity === 0;
    scene.lights.lamp.intensity = on ? 900 : 0;
    scene.parts.lampBulb.material.emissiveIntensity = on ? 1.6 : 0;
    root.dataset.lamp = on ? "on" : "off";
    scene.invalidate();
  }

  // Wisps rise from the mug. Driven by the clock, so they stop when the loop idles.
  function animateSteam(now) {
    const active = !reduced && now - lastInput < ACTIVE_WINDOW_MS;
    for (const w of scene.parts.mugSteam) {
      const t = (now / 4000 + w.userData.phase) % 1;
      w.position.set(Math.sin(t * 6 + w.userData.phase * 10) * 1.2, 9 + t * 14, 0.5);
      w.scale.setScalar(1 + t * 1.2);
      w.material.opacity = active ? (1 - t) * 0.45 : 0;
    }
  }

  // The floppy flies to the drive slot, then the page goes to GitHub.
  function insertFloppy() {
    if (inserting) return;
    if (reduced) return void location.assign(GITHUB_URL);
    inserting = { t0: performance.now(), from: scene.parts.floppy.position.clone(), rotY: scene.parts.floppy.rotation.y };
    scene.invalidate();
  }

  function animateFloppy(now) {
    if (!inserting) return;
    const f = scene.parts.floppy;
    const p = Math.min(1, (now - inserting.t0) / FLOPPY_MS);
    const approach = Math.min(1, p / 0.55);
    const slide = Math.max(0, (p - 0.55) / 0.45);
    const e = approach * approach * (3 - 2 * approach);
    f.position.set(
      inserting.from.x + (SLOT.x - inserting.from.x) * e,
      inserting.from.y + (SLOT.y - inserting.from.y) * e + Math.sin(e * Math.PI) * 6,
      inserting.from.z + (SLOT.z + 9 - inserting.from.z) * e - slide * 9,
    );
    f.rotation.y = inserting.rotY * (1 - e);
    if (p >= 1) {
      inserting = null;
      location.assign(GITHUB_URL);
    }
  }

  function showNote() {
    const existing = document.getElementById("now-card");
    if (existing) return existing.remove();
    const card = document.createElement("div");
    card.id = "now-card";
    card.className = "now-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Now");
    card.tabIndex = -1;
    const pre = document.createElement("pre");
    pre.textContent = NOW;
    card.append(pre);
    card.addEventListener("click", () => card.remove());
    card.addEventListener("keydown", (e) => { if (e.key === "Escape") card.remove(); });
    document.body.append(card);
    card.focus();
  }

  // ---- page controls -----------------------------------------------------

  function bindMute() {
    const update = (muted) => {
      muteButton.setAttribute("aria-pressed", String(muted));
      muteButton.setAttribute("aria-label", muted ? "Sound is off. Turn sound on" : "Sound is on. Turn sound off");
      muteButton.dataset.muted = String(muted);
    };
    update(audio.muted);
    audio.onMute(update);
    muteButton.addEventListener("click", () => audio.setMuted(!audio.muted));
  }

  // On phones the keyboard shrinks the visual viewport. Follow it so the screen stays visible.
  function bindViewport() {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => {
      root.style.setProperty("--vvh", `${vv.height}px`);
      root.style.setProperty("--vvt", `${vv.offsetTop}px`);
    };
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    apply();
  }

  function bindList() {
    document.getElementById("list-close")?.addEventListener("click", () => {
      root.classList.remove("list-open");
      proxy.power.focus();
    });
  }

  // ---- what the terminal commands can do ----------------------------------

  function hostApi() {
    return {
      fileRead: () => { hddPulse(80); audio.play("hddSeek"); },
      readPost: (post, cols, signal) => content.readPost(post, cols, signal),
      searchIndex: (signal) => content.searchIndex(signal),
      navigate: (url) => location.assign(base + url),
      exitToList: () => {
        root.classList.add("list-open");
        document.getElementById("list-close")?.focus();
      },
      feedUrl: () => `${location.origin}${base}/feed.xml`,
      theme: (name) => {
        if (!THEMES[name]) return false;
        screen.setTheme(name);
        local.set("desk.theme", name);
        scene.invalidate();
        return true;
      },
      crt: (on) => {
        crtOn = on;
        setCrtEnabled(crtMaterial, on);
        local.set("desk.crt", on ? "on" : "off");
        scene.invalidate();
      },
      mute: (on) => audio.setMuted(on),
      reboot: () => power.reboot(),
      halt: () => power.press(),
      panic: () => setTimeout(() => power.reboot(), 1200),
    };
  }
}

// localStorage and sessionStorage can throw or be missing. Wrap every access.
function safeStorage(kind) {
  let raw = null;
  try { raw = window[kind]; } catch { /* blocked */ }
  return {
    raw,
    get: (k) => { try { return raw?.getItem(k) ?? null; } catch { return null; } },
    set: (k, v) => { try { raw?.setItem(k, v); } catch { /* blocked */ } },
  };
}
