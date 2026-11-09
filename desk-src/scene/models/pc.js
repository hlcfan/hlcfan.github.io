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

  // Two identical 5.25" optical drives and a 3.5" floppy, stacked on the left. The front group
  // origin is the middle of the case height, so the desk is at y = -7.
  const drives = { x: -9, trim, dark, recess: new MeshStandardMaterial({ color: 0xb4ad97, roughness: 0.6 }) };
  addOpticalDrive(front, drives, -3.7, "24x MAX  CD-ROM");
  addOpticalDrive(front, drives, 0.4, "CD-RW  8x4x32");
  addFloppyDrive(front, drives, 3.9);

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

// Bay plate 15 x 3.8 cm: a recessed panel around the tray slot, a label strip, then the eject
// button, a status LED and a headphone jack along the bottom edge.
function addOpticalDrive(front, { x, trim, dark, recess }, y, label) {
  addBox(front, trim, 15, 3.8, 0.5, x, y, 0.1);
  addBox(front, recess, 12.6, 1.2, 0.1, x, y - 0.5, 0.33);
  addBox(front, dark, 11.8, 0.4, 0.2, x, y - 0.5, 0.4);
  addDecal(front, labelTexture(label), 7.2, 0.9, x - 2.5, y + 1.3, 0.37);
  addBox(front, recess, 1.6, 0.5, 0.25, x + 5.2, y - 1.45, 0.38);
  addBox(front, new MeshBasicMaterial({ color: 0x1d6b2c }), 0.5, 0.2, 0.1, x + 3.1, y - 1.45, 0.37);
  const jack = new Mesh(new CylinderGeometry(0.25, 0.25, 0.2, 14), dark);
  jack.rotation.x = Math.PI / 2;
  jack.position.set(x - 5.4, y - 1.45, 0.38);
  front.add(jack);
}

// A 3.5" drive in a 5.25" bay: a 15 x 2.6 filler plate, the drive face in the middle, a wide
// disk slot, an eject button and an activity LED.
function addFloppyDrive(front, { x, trim, dark, recess }, y) {
  addBox(front, trim, 15, 2.6, 0.5, x, y, 0.1);
  addBox(front, recess, 9.4, 2.2, 0.2, x, y, 0.4);
  addBox(front, recess, 7.2, 0.7, 0.1, x - 0.3, y + 0.35, 0.52);
  addBox(front, dark, 6.4, 0.22, 0.2, x - 0.3, y + 0.35, 0.55);
  addBox(front, trim, 1.1, 0.45, 0.25, x + 3.2, y - 0.75, 0.5);
  addBox(front, new MeshBasicMaterial({ color: 0x1d6b2c }), 0.4, 0.2, 0.1, x - 3.6, y - 0.75, 0.5);
}

function labelTexture(text) {
  return drawTexture(256, 40, (ctx, w, h) => {
    ctx.fillStyle = "#3a382f";
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 6, h / 2);
  });
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

// The CPU badge uses the real Pentium name. The BIOS, monitor and CD-ROM names are invented.
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
    ctx.fillText("Pentium III", w / 2, 46);
    ctx.font = "20px Arial, sans-serif";
    ctx.fillText("inside", w / 2, 78);
  });
}
