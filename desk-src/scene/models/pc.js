// The beige desktop case lying flat: drives, buttons, LEDs and decals.
// Returns a Group. The scene reads `userData.parts` and nothing else.
import {
  BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, NoColorSpace,
  PlaneGeometry, SphereGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { drawTexture, rng } from "./canvas.js";

export const CASE = { w: 42, h: 14, d: 43 };

export function buildPC() {
  const group = new Group();
  group.name = "pc";

  const plastic = plasticMaterial();
  const body = new Mesh(new RoundedBoxGeometry(CASE.w, CASE.h, CASE.d, 4, 0.6), plastic);
  body.position.y = CASE.h / 2;
  group.add(body);

  const front = new Group();
  front.position.set(0, CASE.h / 2, CASE.d / 2);
  group.add(front);

  const dark = new MeshStandardMaterial({ color: 0x1a1915, roughness: 0.6 });
  const trim = new MeshStandardMaterial({ color: 0xc9c2ae, roughness: 0.5 });

  // 3.5" floppy drive and 24x CD-ROM, stacked on the left.
  addBox(front, trim, 15, 3.4, 0.5, -9, 3.2, 0.1);
  addBox(front, dark, 9, 0.5, 0.6, -9, 3.2, 0.15);
  addBox(front, trim, 15, 3.4, 0.5, -9, -1.6, 0.1);
  addBox(front, dark, 12, 0.7, 0.6, -9, -1.6, 0.15);
  addDecal(front, cdLabel(), 7, 1.1, -9, 0.3, 0.42);
  addBox(front, trim, 15, 3.0, 0.5, -9, -5.2, 0.1);
  addBox(front, dark, 11, 0.5, 0.6, -9, -5.2, 0.15);

  // Reset button, power button, LEDs on the right.
  const reset = new Mesh(new CylinderGeometry(0.45, 0.45, 0.5, 20), buttonMaterial(0xb8b19b));
  reset.rotation.x = Math.PI / 2;
  reset.position.set(8, 3.4, 0.35);
  front.add(reset);

  const powerMat = buttonMaterial(0xcfc8b2);
  const power = new Mesh(new CylinderGeometry(0.9, 0.9, 0.9, 28), powerMat);
  power.name = "power-button";
  power.rotation.x = Math.PI / 2;
  power.position.set(8, -1.2, 0.45);
  front.add(power);

  const powerLed = addLed(front, 0xffa000, 12.5, 3.4);
  const hddLed = addLed(front, 0x20e050, 14.8, 3.4);
  powerLed.name = "power-led";
  hddLed.name = "hdd-led";

  addDecal(front, badge(), 9, 2.8, 12, -4.7, 0.36);

  group.userData.parts = { powerButton: power, powerLed, hddLed, front };
  return group;
}

function plasticMaterial() {
  const grime = drawTexture(512, 512, (ctx, w, h) => {
    const rand = rng(21);
    ctx.fillStyle = "#f4efe0";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      ctx.fillStyle = `rgba(90,70,30,${rand() * 0.07})`;
      ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 4, 1 + rand() * 4);
    }
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(60,45,15,0.28)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const roughMap = grime.clone();
  roughMap.colorSpace = NoColorSpace;
  roughMap.needsUpdate = true;
  return new MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.55, map: grime, roughnessMap: roughMap });
}

function buttonMaterial(color) {
  return new MeshStandardMaterial({ color, roughness: 0.45, emissive: 0x000000 });
}

function addBox(parent, material, w, h, d, x, y, z) {
  const m = new Mesh(new BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function addLed(parent, color, x, y) {
  const led = new Mesh(new SphereGeometry(0.28, 12, 8), new MeshBasicMaterial({ color }));
  led.scale.z = 0.5;
  led.position.set(x, y, 0.3);
  parent.add(led);
  return led;
}

function addDecal(parent, texture, w, h, x, y, z) {
  const m = new Mesh(
    new PlaneGeometry(w, h),
    new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  m.position.set(x, y, z);
  parent.add(m);
}

// Invented names throughout. No real trademarks.
function cdLabel() {
  return drawTexture(256, 40, (ctx, w, h) => {
    ctx.fillStyle = "#3a382f";
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("24x MAX  CD-ROM", 6, h / 2);
  });
}

function badge() {
  return drawTexture(320, 100, (ctx, w, h) => {
    ctx.fillStyle = "#2b3f6b";
    ctx.fillRect(4, 4, w - 8, h - 8);
    ctx.strokeStyle = "#c9c2ae";
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = "#e9e4d2";
    ctx.font = "bold 30px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Pentrix III", w / 2, 46);
    ctx.font = "20px Arial, sans-serif";
    ctx.fillText("inside", w / 2, 78);
  });
}
