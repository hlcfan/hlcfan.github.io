// Audio engine: unlock on the first gesture, master gain, mute, and
// suspend when muted or hidden. Before the unlock every call is a no-op.
import * as synth from "./synth.js";

const MASTER_GAIN = 0.5;
const SUSPEND_AFTER_MUTE_MS = 300;
// pointerdown and touchstart do not unlock audio on iOS Safari.
const UNLOCK_EVENTS = ["click", "pointerup", "keydown"];

export function createAudio({
  storage = null,
  win = window,
  doc = document,
  AudioContextClass = win.AudioContext ?? win.webkitAudioContext,
} = {}) {
  let ac = null;
  let master = null;
  let fan = null;
  let muted = readMuted(storage);
  let suspendTimer = 0;
  const listeners = new Set();

  for (const ev of UNLOCK_EVENTS) win.addEventListener(ev, unlock, { capture: true });
  doc.addEventListener("visibilitychange", onVisibility);

  return { unlock, play, fanOn, fanOff, setMuted, get muted() { return muted; }, get unlocked() { return !!ac; }, onMute };

  // Creates and resumes the context. Must run inside a click, pointerup or keydown handler.
  function unlock() {
    if (!AudioContextClass) return;
    if (!ac) {
      ac = new AudioContextClass();
      master = ac.createGain();
      master.gain.value = muted ? 0 : MASTER_GAIN;
      master.connect(ac.destination);
    }
    if (!muted && ac.state === "suspended") ac.resume();
  }

  function play(name) {
    if (!ac || muted || doc.hidden) return;
    const fn = synth[name];
    if (fn) fn(ac, master);
  }

  function fanOn(rampS = 1.2) {
    if (!ac || fan) return;
    fan = synth.startFan(ac, master, { gain: 0.06, rampS });
  }

  function fanOff(rampS = 2) {
    if (!fan) return;
    fan.stop(rampS);
    fan = null;
  }

  function setMuted(on) {
    muted = on;
    try { storage?.setItem("desk.muted", on ? "1" : "0"); } catch { /* blocked */ }
    clearTimeout(suspendTimer);
    if (ac) {
      master.gain.setTargetAtTime(on ? 0 : MASTER_GAIN, ac.currentTime, 0.03);
      if (on) suspendTimer = setTimeout(() => ac.suspend(), SUSPEND_AFTER_MUTE_MS);
      else if (ac.state === "suspended") ac.resume();
    }
    for (const fn of listeners) fn(on);
  }

  function onMute(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function onVisibility() {
    if (!ac) return;
    if (doc.hidden) ac.suspend();
    else if (!muted) ac.resume();
  }
}

function readMuted(storage) {
  try { return storage?.getItem("desk.muted") === "1"; } catch { return false; }
}
