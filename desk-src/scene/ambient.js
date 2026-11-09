// Small ambient life: rain on the window, dust and glow in the lamp light, a swing when the lamp is
// clicked. Everything here runs only while the scene is active, so an idle scene still renders nothing.
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, PointsMaterial } from "three";
import { rng } from "./models/canvas.js";

const DUST_COUNT = 70;
const DROPS = 46;
const LAMP_HEAD_REST = 0.35;

export function createAmbient({ scene, parts, reduced }) {
  const dust = buildDust(parts.lampDustBox);
  const rain = createRain(parts.rain);
  const swing = { angle: 0, speed: 0 };
  let lampOn = false;
  scene.add(dust.points);
  dust.points.visible = false;

  return {
    setLamp(on) {
      lampOn = on;
      dust.points.visible = on && !reduced;
      parts.lampGlow.material.opacity = on ? 0.55 : 0;
    },
    kickLamp() { if (!reduced) swing.speed += 2.4; },
    get swinging() { return Math.abs(swing.angle) > 0.002 || Math.abs(swing.speed) > 0.01; },
    // Returns true when something moved and the frame must be drawn.
    update(now, dt, active) {
      stepSwing(dt);
      if (reduced) { rain.drawStill(); return this.swinging; }
      if (!active) return this.swinging;
      const t = now / 1000;
      rain.step(dt);
      if (lampOn) {
        dust.step(dt, t);
        const flicker = 0.93 + 0.04 * Math.sin(t * 7.1) + 0.03 * Math.sin(t * 13.7 + 1);
        parts.lampGlow.material.opacity = 0.55 * flicker;
      }
      return true;
    },
  };

  // A damped spring on the shade angle.
  function stepSwing(dt) {
    if (!(Math.abs(swing.angle) > 0.002 || Math.abs(swing.speed) > 0.01)) { swing.angle = 0; swing.speed = 0; }
    const k = 38;
    const damping = 3.2;
    swing.speed += (-k * swing.angle - damping * swing.speed) * dt;
    swing.angle += swing.speed * dt;
    parts.lampHead.rotation.z = LAMP_HEAD_REST + swing.angle;
  }
}

function buildDust({ min, max }) {
  const rand = rng(3);
  const pos = new Float32Array(DUST_COUNT * 3);
  const seed = [];
  for (let i = 0; i < DUST_COUNT; i++) {
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = min[k] + rand() * (max[k] - min[k]);
    seed.push({ vx: (rand() - 0.5) * 0.6, vy: 0.2 + rand() * 0.5, vz: (rand() - 0.5) * 0.6, ph: rand() * 6.28 });
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  const points = new Points(geo, new PointsMaterial({
    color: 0xffd9a0, size: 0.45, transparent: true, opacity: 0.45, blending: AdditiveBlending, depthWrite: false,
  }));
  points.frustumCulled = false;

  return {
    points,
    step(dt, t) {
      for (let i = 0; i < DUST_COUNT; i++) {
        const s = seed[i];
        pos[i * 3] += (s.vx + Math.sin(t * 0.7 + s.ph) * 0.5) * dt;
        pos[i * 3 + 1] += s.vy * dt;
        pos[i * 3 + 2] += (s.vz + Math.cos(t * 0.6 + s.ph) * 0.5) * dt;
        for (let k = 0; k < 3; k++) {
          if (pos[i * 3 + k] > max[k]) pos[i * 3 + k] = min[k];
          else if (pos[i * 3 + k] < min[k]) pos[i * 3 + k] = max[k];
        }
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// Streaks fall down the pane, a few drops run slowly. Redrawn only while active.
function createRain({ canvas, texture }) {
  const ctx = canvas.getContext("2d");
  const rand = rng(17);
  const w = canvas.width;
  const h = canvas.height;
  const drops = Array.from({ length: DROPS }, () => newDrop(true));
  const runners = Array.from({ length: 6 }, () => ({ x: rand() * w, y: rand() * h, v: 6 + rand() * 10, r: 1.2 + rand() * 1.4 }));

  return { step, drawStill: () => { draw(); }, };

  function newDrop(anywhere) {
    return { x: rand() * w, y: anywhere ? rand() * h : -10, len: 6 + rand() * 14, v: 90 + rand() * 90, a: 0.15 + rand() * 0.25 };
  }

  function step(dt) {
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.y += d.v * dt;
      if (d.y - d.len > h) drops[i] = newDrop(false);
    }
    for (const r of runners) {
      r.y += r.v * dt;
      if (r.y > h + 4) { r.y = -4; r.x = rand() * w; }
    }
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.lineWidth = 1;
    for (const d of drops) {
      ctx.strokeStyle = `rgba(190,215,255,${d.a})`;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y - d.len);
      ctx.lineTo(d.x - 1.5, d.y);
      ctx.stroke();
    }
    for (const r of runners) {
      ctx.fillStyle = "rgba(210,228,255,0.45)";
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.fill();
    }
    texture.needsUpdate = true;
  }
}
