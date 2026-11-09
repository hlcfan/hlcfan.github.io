// Every sound is synthesized with Web Audio. No audio files ship.
// Each function takes an AudioContext `ac` and a destination node `out`.
let noiseBuf = null;
let brownBuf = null;

export function relayClick(ac, out, t = ac.currentTime) {
  noiseBurst(ac, out, t, 0.008, 1500, 1.2, 0.5);
  tone(ac, out, "sine", 90, t, 0.06, 0.4, 0.06);
}

export function degaussThump(ac, out, t = ac.currentTime) {
  tone(ac, out, "sine", 60, t, 0.25, 0.9, 0.25, true);
  noiseBurst(ac, out, t, 0.12, 200, 0.7, 0.25, "lowpass");
}

export function postBeep(ac, out, t = ac.currentTime) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = "square";
  o.frequency.value = 1000;
  g.gain.setValueAtTime(0.08, t);
  g.gain.setValueAtTime(0, t + 0.12);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.13);
}

export function hddSeek(ac, out, t = ac.currentTime) {
  noiseBurst(ac, out, t, 0.015 + Math.random() * 0.025, 2000, 1.5, 0.35);
}

export function keyClick(ac, out, t = ac.currentTime) {
  const detune = 0.85 + Math.random() * 0.3;
  noiseBurst(ac, out, t, 0.006, 3000 * detune, 1, 0.3);
  tone(ac, out, "sine", 180 * detune, t, 0.03, 0.25, 0.03);
}

// Fan: brown noise through a 400 Hz low-pass, with a slow 0.4 Hz wobble.
export function startFan(ac, out, { gain = 0.06, rampS = 1.2 } = {}) {
  const src = ac.createBufferSource();
  src.buffer = brown(ac);
  src.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 400;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, ac.currentTime);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + rampS);
  const lfo = ac.createOscillator();
  const depth = ac.createGain();
  lfo.frequency.value = 0.4;
  depth.gain.value = gain * 0.15;
  lfo.connect(depth).connect(g.gain);
  src.connect(lp).connect(g).connect(out);
  src.start();
  lfo.start();

  return {
    stop(rampOut = 2) {
      const now = ac.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0.0001, now + rampOut);
      src.stop(now + rampOut + 0.05);
      lfo.stop(now + rampOut + 0.05);
    },
  };
}

function noiseBurst(ac, out, t, dur, freq, q, gain, type = "bandpass") {
  const src = ac.createBufferSource();
  src.buffer = white(ac);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.01);
}

function tone(ac, out, type, freq, t, dur, gain, decay, exp = false) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  if (exp) g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  else g.gain.linearRampToValueAtTime(0, t + decay);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function white(ac) {
  if (noiseBuf && noiseBuf.sampleRate === ac.sampleRate) return noiseBuf;
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function brown(ac) {
  if (brownBuf && brownBuf.sampleRate === ac.sampleRate) return brownBuf;
  brownBuf = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate);
  const d = brownBuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return brownBuf;
}
