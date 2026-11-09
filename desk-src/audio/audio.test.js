import { afterEach, describe, expect, it, vi } from "vitest";
import { createAudio } from "./audio.js";

function fakeEnv() {
  const handlers = {};
  const win = { addEventListener: (ev, fn) => (handlers[ev] ??= []).push(fn) };
  const docHandlers = {};
  const doc = { hidden: false, addEventListener: (ev, fn) => (docHandlers[ev] = fn) };
  const created = [];
  class AC {
    constructor() {
      this.state = "suspended";
      this.currentTime = 0;
      this.destination = {};
      this.resume = vi.fn(() => { this.state = "running"; });
      this.suspend = vi.fn(() => { this.state = "suspended"; });
      created.push(this);
    }
    createGain() { return { gain: { value: 1, setTargetAtTime: vi.fn() }, connect: () => ({}) }; }
  }
  const storage = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
  return { win, doc, AC, handlers, docHandlers, created, storage };
}

afterEach(() => vi.useRealTimers());

describe("audio unlock", () => {
  it("listens for click, pointerup and keydown but not pointerdown or touchstart", () => {
    const e = fakeEnv();
    createAudio({ win: e.win, doc: e.doc, AudioContextClass: e.AC, storage: e.storage });
    expect(Object.keys(e.handlers).sort()).toEqual(["click", "keydown", "pointerup"]);
  });

  it("creates and resumes the context on the first gesture only", () => {
    const e = fakeEnv();
    const a = createAudio({ win: e.win, doc: e.doc, AudioContextClass: e.AC, storage: e.storage });
    expect(a.unlocked).toBe(false);
    e.handlers.click[0]();
    e.handlers.keydown[0]();
    expect(e.created).toHaveLength(1);
    expect(e.created[0].resume).toHaveBeenCalled();
    expect(a.unlocked).toBe(true);
  });

  it("play, fanOn and fanOff are no-ops before the unlock", () => {
    const e = fakeEnv();
    const a = createAudio({ win: e.win, doc: e.doc, AudioContextClass: e.AC, storage: e.storage });
    expect(() => { a.play("relayClick"); a.fanOn(); a.fanOff(); }).not.toThrow();
    expect(e.created).toHaveLength(0);
  });
});

describe("mute", () => {
  it("persists the choice and suspends the context after 300 ms", () => {
    vi.useFakeTimers();
    const e = fakeEnv();
    const a = createAudio({ win: e.win, doc: e.doc, AudioContextClass: e.AC, storage: e.storage });
    e.handlers.click[0]();
    a.setMuted(true);
    expect(e.storage.data["desk.muted"]).toBe("1");
    expect(e.created[0].suspend).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(e.created[0].suspend).toHaveBeenCalled();
    a.setMuted(false);
    expect(e.created[0].resume).toHaveBeenCalledTimes(2);
  });

  it("starts muted when the stored choice says so and does not resume on unlock", () => {
    const e = fakeEnv();
    e.storage.data["desk.muted"] = "1";
    const a = createAudio({ win: e.win, doc: e.doc, AudioContextClass: e.AC, storage: e.storage });
    e.handlers.click[0]();
    expect(a.muted).toBe(true);
    expect(e.created[0].resume).not.toHaveBeenCalled();
  });

  it("notifies listeners", () => {
    const e = fakeEnv();
    const a = createAudio({ win: e.win, doc: e.doc, AudioContextClass: e.AC, storage: e.storage });
    const seen = [];
    a.onMute((m) => seen.push(m));
    a.setMuted(true);
    expect(seen).toEqual([true]);
  });
});

describe("tab visibility", () => {
  it("suspends when hidden and resumes when visible and not muted", () => {
    const e = fakeEnv();
    createAudio({ win: e.win, doc: e.doc, AudioContextClass: e.AC, storage: e.storage });
    e.handlers.click[0]();
    e.doc.hidden = true;
    e.docHandlers.visibilitychange();
    expect(e.created[0].suspend).toHaveBeenCalled();
    e.doc.hidden = false;
    e.docHandlers.visibilitychange();
    expect(e.created[0].resume).toHaveBeenCalledTimes(2);
  });
});
