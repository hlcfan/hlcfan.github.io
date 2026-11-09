// Desk props: lamp, mug, floppy, sticky note, wall clock, keyboard, mouse,
// speakers, CD-R in a paper sleeve. Built from boxes and canvas textures.
import {
  AdditiveBlending, BoxGeometry, CircleGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, SphereGeometry, TorusGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { drawTexture } from "./canvas.js";

export function buildProps() {
  const group = new Group();
  group.name = "props";

  const lamp = buildLamp();
  lamp.group.position.set(-62, 0, -8);
  const mug = buildMug();
  mug.group.position.set(48, 0, 14);
  const floppy = buildFloppy();
  floppy.position.set(46, 0.4, 36);
  floppy.rotation.y = -0.35;
  const note = buildNote();
  note.position.set(-34, 0.45, 30);
  note.rotation.y = 0.25;
  const clock = buildClock();
  clock.group.position.set(74, 38, -69);
  const wall = new Mesh(new PlaneGeometry(420, 180), new MeshStandardMaterial({ color: 0x1b1814, roughness: 0.95 }));
  wall.position.set(0, 60, -70);

  group.add(
    wall, lamp.group, mug.group, floppy, note, clock.group,
    buildKeyboard(), buildMouse(), buildSpeaker(-33), buildSpeaker(33), buildSleeve(),
  );

  group.userData.parts = {
    lamp: lamp.group, lampBulb: lamp.bulb, lampHead: lamp.head, mugSteam: mug.steam,
    floppy, note, clock,
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
  head.rotation.z = -0.5;
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
  return { group, bulb, head };
}

function buildMug() {
  const group = new Group();
  group.name = "mug";
  const white = new MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.35 });
  const body = new Mesh(new CylinderGeometry(4.2, 3.8, 9, 28, 1, true), new MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.35, side: DoubleSide }));
  body.position.y = 4.5;
  const bottom = new Mesh(new CircleGeometry(3.8, 28), white);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.05;
  const coffee = new Mesh(new CircleGeometry(4, 28), new MeshStandardMaterial({ color: 0x2b1a10, roughness: 0.2 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 7.6;
  const handle = new Mesh(new TorusGeometry(2.6, 0.55, 8, 20, Math.PI * 1.2), white);
  handle.position.set(4.2, 4.5, 0);
  handle.rotation.z = -Math.PI * 0.6;

  // Three faint wisps. desk.js moves them from the clock, so they freeze when the loop idles.
  const steam = [];
  const tex = drawTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  for (let i = 0; i < 3; i++) {
    const m = new Mesh(new PlaneGeometry(5, 5), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }));
    m.userData.phase = i / 3;
    steam.push(m);
    group.add(m);
  }
  group.add(body, bottom, coffee, handle);
  return { group, steam };
}

function buildFloppy() {
  const group = new Group();
  group.name = "floppy";
  const shell = new Mesh(new BoxGeometry(9, 0.3, 9), new MeshStandardMaterial({ color: 0x23272e, roughness: 0.5 }));
  const shutter = new Mesh(new BoxGeometry(4, 0.34, 3), new MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.3, metalness: 0.8 }));
  shutter.position.set(0, 0, -3);
  const label = new Mesh(
    new PlaneGeometry(6, 4),
    new MeshBasicMaterial({
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

function buildNote() {
  const group = new Group();
  group.name = "note";
  const paper = new Mesh(
    new PlaneGeometry(8, 8),
    new MeshBasicMaterial({
      map: drawTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = "#f2dc5a";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#4a4020";
        ctx.font = "bold 22px 'Comic Sans MS', cursive, sans-serif";
        ctx.fillText("now:", 14, 34);
        ctx.fillRect(14, 50, 90, 3);
        ctx.fillRect(14, 70, 70, 3);
        ctx.fillRect(14, 90, 80, 3);
      }),
    }),
  );
  paper.rotation.x = -Math.PI / 2;
  group.add(paper);
  return group;
}

// A wall clock whose hands follow the visitor's local time.
function buildClock() {
  const group = new Group();
  group.name = "clock";
  const rim = new Mesh(new CylinderGeometry(11, 11, 2, 40), new MeshStandardMaterial({ color: 0x2a2620, roughness: 0.6 }));
  rim.rotation.x = Math.PI / 2;
  const face = new Mesh(new CircleGeometry(10, 40), new MeshBasicMaterial({ color: 0xffffff }));
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

function buildKeyboard() {
  const group = new Group();
  group.name = "keyboard";
  const body = new Mesh(new RoundedBoxGeometry(46, 2.6, 16, 3, 0.5), new MeshStandardMaterial({ color: 0xd2ccb9, roughness: 0.6 }));
  body.position.y = 1.3;
  const keys = new Mesh(
    new PlaneGeometry(42, 12),
    new MeshBasicMaterial({
      map: drawTexture(512, 150, (ctx, w, h) => {
        ctx.fillStyle = "#bdb7a3";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#e4dfcd";
        ctx.strokeStyle = "#8d8776";
        for (let r = 0; r < 5; r++) {
          const n = r === 4 ? 1 : 15 - (r === 2 ? 1 : 0);
          for (let c = 0; c < n; c++) {
            const kw = r === 4 ? 260 : w / 15 - 3;
            const x = r === 4 ? 100 : c * (w / 15) + 2;
            ctx.fillRect(x, 6 + r * 28, kw, 24);
            ctx.strokeRect(x, 6 + r * 28, kw, 24);
          }
        }
      }),
    }),
  );
  keys.rotation.x = -Math.PI / 2 + 0.08;
  keys.position.set(0, 2.65, -0.5);
  group.add(body, keys);
  group.position.set(-4, 0, 42);
  return group;
}

function buildMouse() {
  const group = new Group();
  group.name = "mouse";
  const body = new Mesh(new SphereGeometry(3, 20, 14), new MeshStandardMaterial({ color: 0xd2ccb9, roughness: 0.5 }));
  body.scale.set(1, 0.55, 1.5);
  body.position.y = 1.6;
  const cable = new Mesh(new CylinderGeometry(0.2, 0.2, 14, 6), new MeshStandardMaterial({ color: 0xc4bea9 }));
  cable.rotation.x = Math.PI / 2;
  cable.position.set(0, 0.3, -9);
  group.add(body, cable);
  group.position.set(30, 0, 40);
  return group;
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
