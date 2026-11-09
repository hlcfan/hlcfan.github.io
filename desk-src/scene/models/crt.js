// The CRT monitor: bezel, tapered tube, controls, and the curved glass.
// The glass is a plain dark material until the terminal screen arrives in M2.
import {
  AdditiveBlending, BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { drawTexture } from "./canvas.js";

export const SCREEN = { w: 28, h: 21 };

export function buildCRT() {
  const group = new Group();
  group.name = "crt";

  const plastic = new MeshStandardMaterial({ color: 0xd2ccb9, roughness: 0.55 });
  const dark = new MeshStandardMaterial({ color: 0x1a1915, roughness: 0.6 });

  const baseH = 1.5;
  const bezelH = 34;
  const cy = baseH + bezelH / 2;

  const swivel = new Mesh(new BoxGeometry(24, baseH, 24), plastic);
  swivel.position.set(0, baseH / 2, -2);
  group.add(swivel);

  const bezel = new Mesh(new RoundedBoxGeometry(36, bezelH, 8, 4, 1.2), plastic);
  bezel.position.set(0, cy, 15);
  group.add(bezel);

  // Four-sided frustum, wide end toward the front.
  const tubeGeo = new CylinderGeometry(21, 14.5, 30, 4, 1);
  tubeGeo.rotateY(Math.PI / 4);
  tubeGeo.rotateX(Math.PI / 2);
  const tube = new Mesh(tubeGeo, plastic);
  tube.scale.set(1, 0.92, 1);
  tube.position.set(0, cy, -4);
  group.add(tube);

  // Recess around the glass.
  const recess = new Mesh(new BoxGeometry(31, 24, 0.4), dark);
  recess.position.set(0, cy + 1.5, 19.1);
  group.add(recess);

  const screen = new Mesh(curvedGlass(SCREEN.w, SCREEN.h, 0.8), glassMaterial());
  screen.name = "screen";
  screen.position.set(0, cy + 1.5, 19.3);
  group.add(screen);

  // Brand strip and controls under the glass.
  const strip = new Mesh(
    new PlaneGeometry(10, 1.6),
    new MeshBasicMaterial({ map: brandStrip(), transparent: true, depthWrite: false }),
  );
  strip.position.set(-9, cy - 12.6, 19.05);
  group.add(strip);

  const dial = new Mesh(new CylinderGeometry(0.9, 0.9, 0.6, 20), dark);
  dial.rotation.x = Math.PI / 2;
  dial.position.set(10, cy - 13, 19.2);
  group.add(dial);

  const switchBtn = new Mesh(new BoxGeometry(1.8, 1.1, 0.6), dark);
  switchBtn.position.set(14, cy - 13, 19.2);
  group.add(switchBtn);

  // Faint blue-white halo around the glass. desk.js sets its opacity from the picture brightness.
  const glow = new Mesh(
    new PlaneGeometry(58, 48),
    new MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
  );
  glow.name = "screen-glow";
  glow.position.set(0, cy + 1.5, 19.7);
  glow.renderOrder = 3;
  group.add(glow);

  group.userData.parts = { screen, glow };
  group.userData.height = baseH + bezelH;
  return group;
}

// A copy of the glass in front of it, for the additive CRT shader.
export function buildScreenOverlay(glass, material) {
  const overlay = new Mesh(glass.geometry, material);
  overlay.name = "screen-overlay";
  overlay.position.copy(glass.position);
  overlay.position.z += 0.03;
  overlay.renderOrder = 2;
  glass.parent.add(overlay);
  return overlay;
}

// A plane bowed outward toward the viewer: z grows toward the center.
function curvedGlass(w, h, bulge) {
  const geo = new PlaneGeometry(w, h, 16, 12);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i) / (w / 2);
    const ny = pos.getY(i) / (h / 2);
    pos.setZ(i, bulge * (1 - 0.5 * (nx * nx + ny * ny)));
  }
  geo.computeVertexNormals();
  return geo;
}

function glassMaterial() {
  return new MeshStandardMaterial({ color: 0x050808, roughness: 0.12, metalness: 0.0, envMapIntensity: 0.6 });
}

// Transparent over the glass itself, brightest just outside it, fading outward.
function glowTexture() {
  return drawTexture(256, 212, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.5);
    g.addColorStop(0, "rgba(150,200,255,0)");
    g.addColorStop(0.45, "rgba(150,200,255,0.5)");
    g.addColorStop(1, "rgba(150,200,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function brandStrip() {
  return drawTexture(320, 50, (ctx, w, h) => {
    ctx.fillStyle = "#6b6657";
    ctx.font = "bold 28px Arial, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText("VIEWTEK  17", 4, h / 2);
  });
}
