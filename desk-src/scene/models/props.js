// Desk props: lamp, whisky glass, floppy, wall clock, keyboard,
// speakers, CD-R in a paper sleeve. Built from boxes and canvas textures.
import {
  AdditiveBlending, BoxGeometry, Sprite, SpriteMaterial, CircleGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, SphereGeometry, CanvasTexture, SRGBColorSpace,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { drawTexture, rng } from "./canvas.js";
import { buildGlass } from "./glass.js";
import { buildKeyboard } from "./keyboard.js";

export function buildProps() {
  const group = new Group();
  group.name = "props";

  const lamp = buildLamp();
  lamp.group.position.set(-72, 0, -16);
  const glass = buildGlass();
  glass.position.set(57, 0.06, 12); // lifted so the foot does not z-fight with the desk top
  const floppy = buildFloppy();
  floppy.position.set(46, 0.4, 36);
  floppy.rotation.y = -0.35;
  const clock = buildClock();
  clock.group.position.set(-46, 40, -69);
  const win = buildWindow();
  win.group.position.set(76, 28, -69.6);
  const wall = new Mesh(new PlaneGeometry(420, 180), new MeshStandardMaterial({ color: 0x6c7490, roughness: 0.95, map: paintTexture() }));
  wall.position.set(0, 60, -70);
  wall.userData.bakeGroup = "wall";

  group.add(
    wall, win.group, lamp.group, glass, floppy, clock.group,
    buildKeyboard(), buildSpeaker(-33), buildSpeaker(33), buildSleeve(),
  );

  group.userData.parts = {
    lamp: lamp.group, lampBulb: lamp.bulb, lampHead: lamp.head,
    floppy, clock, wall, rain: win.rain, lampGlow: lamp.glow,
  };
  return group;
}

function buildLamp() {
  const group = new Group();
  group.name = "lamp";
  const metal = new MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.6 });
  const base = new Mesh(new CylinderGeometry(7, 8, 2, 24), metal);
  base.position.y = 1;
  const arm = new Mesh(new CylinderGeometry(0.7, 0.7, 36, 10), metal);
  arm.position.set(0, 19, 0);
  const head = new Group();
  head.position.set(8, 36, 8);
  head.rotation.z = 0.35;
  const shade = new Mesh(new CylinderGeometry(3, 9, 9, 24, 1, true), new MeshStandardMaterial({ color: 0x2f5a3c, roughness: 0.5, side: DoubleSide }));
  shade.position.y = -2;
  const bulb = new Mesh(new SphereGeometry(2.4, 16, 12), new MeshStandardMaterial({ color: 0x5a5030, emissive: 0xffc56a, emissiveIntensity: 0 }));
  bulb.position.y = -4;
  head.add(shade, bulb);
  const arm2 = new Mesh(new CylinderGeometry(0.6, 0.6, 14, 10), metal);
  arm2.position.set(4, 34, 4);
  arm2.rotation.z = -1.1;
  arm2.rotation.x = 0.6;
  group.add(base, arm, arm2, head);
  const glow = new Sprite(new SpriteMaterial({
    map: glowTexture(), color: 0xffc070, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false,
  }));
  glow.scale.setScalar(26);
  glow.position.set(0, -5.5, 0);
  glow.renderOrder = 4;
  head.add(glow);
  return { group, bulb, head, glow };
}

function buildFloppy() {
  const group = new Group();
  group.name = "floppy";
  const shell = new Mesh(new BoxGeometry(9, 0.3, 9), new MeshStandardMaterial({ color: 0x23272e, roughness: 0.5 }));
  const shutter = new Mesh(new BoxGeometry(4, 0.34, 3), new MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.8 }));
  shutter.position.set(0, 0, -3);
  const label = new Mesh(
    new PlaneGeometry(6, 4),
    new MeshStandardMaterial({
      roughness: 0.6,
      map: drawTexture(192, 128, (ctx, w, h) => {
        ctx.fillStyle = "#e9e4d2";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#2b3f6b";
        ctx.font = "bold 34px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("GITHUB", w / 2, 56);
        ctx.font = "20px Arial, sans-serif";
        ctx.fillText("hlcfan  1.44MB", w / 2, 92);
      }),
    }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.17, 2);
  group.add(shell, shutter, label);
  return group;
}

// A wall clock whose hands follow the visitor's local time.
function buildClock() {
  const group = new Group();
  group.name = "clock";
  const rim = new Mesh(new CylinderGeometry(11, 11, 2, 40), new MeshStandardMaterial({ color: 0x2a2620, roughness: 0.6 }));
  rim.rotation.x = Math.PI / 2;
  const face = new Mesh(new CircleGeometry(10, 40), new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
  face.position.z = 1.05;
  group.add(rim, face);

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const tex = drawTexture(256, 256, () => {});
  face.material.map = tex;
  const ctx = tex.image.getContext("2d");

  return { group, update };

  function update(date = new Date()) {
    const w = 256;
    ctx.fillStyle = "#e9e4d2";
    ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = "#2a2620";
    ctx.lineWidth = 5;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100);
      ctx.lineTo(128 + Math.sin(a) * 116, 128 - Math.cos(a) * 116);
      ctx.stroke();
    }
    const h = ((date.getHours() % 12) + date.getMinutes() / 60) / 12;
    const m = date.getMinutes() / 60;
    hand(h, 62, 9);
    hand(m, 96, 6);
    tex.needsUpdate = true;

    function hand(frac, len, width) {
      const a = frac * Math.PI * 2;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(128, 128);
      ctx.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len);
      ctx.stroke();
    }
  }
}

function buildSpeaker(x) {
  const group = new Group();
  group.name = "speaker";
  const body = new Mesh(new RoundedBoxGeometry(10, 18, 12, 3, 0.6), new MeshStandardMaterial({ color: 0xd2ccb9, roughness: 0.55 }));
  body.position.y = 9;
  const cone = new Mesh(new CircleGeometry(3.6, 24), new MeshStandardMaterial({ color: 0x1d1c18, roughness: 0.8 }));
  cone.position.set(0, 7, 6.05);
  const tweeter = new Mesh(new CircleGeometry(1.3, 16), new MeshStandardMaterial({ color: 0x2a2924, roughness: 0.6 }));
  tweeter.position.set(0, 14, 6.05);
  group.add(body, cone, tweeter);
  group.position.set(x, 0, -4);
  return group;
}

function buildSleeve() {
  const group = new Group();
  group.name = "sleeve";
  const paper = new Mesh(new BoxGeometry(13, 0.2, 13), new MeshStandardMaterial({ color: 0xe9e4d2, roughness: 0.9 }));
  const window = new Mesh(new CircleGeometry(5, 28), new MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.25, metalness: 0.7 }));
  window.rotation.x = -Math.PI / 2;
  window.position.y = 0.11;
  group.add(paper, window);
  group.position.set(18, 0.4, 14);
  group.rotation.y = 0.3;
  return group;
}

// Flat wall paint with a little mottling, so the baked light has something to fall on.
function paintTexture() {
  return drawTexture(512, 256, (ctx, w, h) => {
    const rand = rng(5);
    ctx.fillStyle = "#c9ccd6";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = `rgba(${rand() > 0.5 ? "255,255,255" : "20,24,40"},${rand() * 0.025})`;
      const r = 2 + rand() * 18;
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function glowTexture() {
  return drawTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.25, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

// A window on the back wall: wood frame, a night city behind it, and rain on the pane.
// The rain canvas is redrawn by ambient.js, only while the scene is active.
function buildWindow() {
  const group = new Group();
  group.name = "window";
  const W = 30;
  const H = 36;
  const wood = new MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.7 });
  const bar = (w, h, d, x, y, z = 0.6) => {
    const m = new Mesh(new BoxGeometry(w, h, d), wood);
    m.position.set(x, y, z);
    group.add(m);
  };
  bar(W + 6, 3, 2.2, 0, H / 2 + 1.5);
  bar(W + 6, 3, 2.2, 0, -H / 2 - 1.5);
  bar(3, H + 6, 2.2, -W / 2 - 1.5, 0);
  bar(3, H + 6, 2.2, W / 2 + 1.5, 0);
  bar(1.4, H, 1.4, 0, 0, 0.9);
  bar(W, 1.4, 1.4, 0, 6, 0.9);

  const sky = new Mesh(new PlaneGeometry(W, H), new MeshBasicMaterial({ map: nightCity() }));
  sky.position.z = 0.1;

  const rainCanvas = document.createElement("canvas");
  rainCanvas.width = 128;
  rainCanvas.height = 160;
  const rainTex = new CanvasTexture(rainCanvas);
  rainTex.colorSpace = SRGBColorSpace;
  const pane = new Mesh(new PlaneGeometry(W, H), new MeshBasicMaterial({ map: rainTex, transparent: true, depthWrite: false }));
  pane.position.z = 0.4;
  group.add(sky, pane);
  return { group, rain: { canvas: rainCanvas, texture: rainTex } };
}

function nightCity() {
  return drawTexture(256, 320, (ctx, w, h) => {
    const rand = rng(11);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0b1226");
    g.addColorStop(0.7, "#1d2848");
    g.addColorStop(1, "#2b2f4e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Skyline and lit windows, drawn blurry so it reads as far away.
    ctx.filter = "blur(1.2px)";
    for (let i = 0; i < 14; i++) {
      const bw = 20 + rand() * 30;
      const bh = 60 + rand() * 110;
      const x = i * 20 - 10 + rand() * 8;
      ctx.fillStyle = "#0a0d1a";
      ctx.fillRect(x, h - bh, bw, bh);
      for (let k = 0; k < 14; k++) {
        if (rand() < 0.45) continue;
        ctx.fillStyle = rand() < 0.7 ? "#ffd28a" : "#9fc4ff";
        ctx.fillRect(x + 3 + rand() * (bw - 8), h - bh + 6 + rand() * (bh - 12), 2, 3);
      }
    }
    ctx.filter = "none";
  });
}
