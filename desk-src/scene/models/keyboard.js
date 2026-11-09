// A 104-key beige keyboard: a wedge case, one merged mesh of tapered keycaps, and a cable to the PC's side.
// Legends come from one canvas texture mapped flat over the key area.
import { BoxGeometry, CatmullRomCurve3, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, TubeGeometry, Vector3 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { drawTexture } from "./canvas.js";

const PITCH = 1.8;        // cm per key unit
const CAP_H = 1.0;        // keycap height above the case
const CASE = { w: 46.4, h: 2.2, d: 15 };
const TEX_PX = 40;        // texture pixels per key unit

export function buildKeyboard() {
  const keys = layout();
  const extent = {
    w: Math.max(...keys.map((k) => k.x + k.w)),
    h: Math.max(...keys.map((k) => k.y + k.h)),
  };

  const group = new Group();
  group.name = "keyboard";
  const tilt = new Group();
  tilt.rotation.x = 0.07;
  tilt.position.y = 0.6;

  const body = new Mesh(
    new RoundedBoxGeometry(CASE.w, CASE.h, CASE.d, 3, 0.5),
    new MeshStandardMaterial({ color: 0xc4bea9, roughness: 0.6 }),
  );
  body.position.y = CASE.h / 2;
  body.userData.bakeGroup = "kbd";

  const caps = new Mesh(capGeometry(keys, extent), capMaterial(keys, extent));
  caps.userData.bakeGroup = "kbd";

  group.add(tilt, buildCable());
  tilt.add(body, caps);
  group.position.set(-4, 0, 42);
  return group;
}

// The lead leaves the back of the case, runs along the desk and plugs into the left side of the PC case.
function buildCable() {
  const curve = new CatmullRomCurve3([
    [0, 1.6, -7.4], [-2, 0.5, -10], [-8, 0.3, -14], [-15, 0.3, -19],
    [-20, 0.3, -25], [-19.5, 1.5, -29.5], [-16.5, 3, -30.5],
  ].map((p) => new Vector3(...p)));
  const cable = new Mesh(
    new TubeGeometry(curve, 40, 0.25, 6),
    new MeshStandardMaterial({ color: 0xc4bea9, roughness: 0.7 }),
  );
  cable.userData.bakeGroup = "kbd";
  return cable;
}

// Each key is { x, y, w, h, label, mod } in key units, origin at the top left of the key area.
function layout() {
  const keys = [];
  const add = (x, y, w, label, { h = 1, mod = false } = {}) => keys.push({ x, y, w, h, label, mod });
  const row = (y, x, specs) => {
    for (const [label, w = 1, mod = false] of specs) {
      add(x, y, w, label, { mod });
      x += w;
    }
  };
  const chars = (s) => [...s].map((c) => [c]);

  // Main block, 15 units wide. Row 0 is the function row.
  add(0, 0, 1, "Esc", { mod: true });
  [["F1", 2], ["F5", 6.5], ["F9", 11]].forEach(([first, x]) => {
    const n = Number(first.slice(1));
    for (let i = 0; i < 4; i++) add(x + i, 0, 1, `F${n + i}`, { mod: true });
  });
  row(1.5, 0, [...chars("`1234567890-="), ["Bksp", 2, true]]);
  row(2.5, 0, [["Tab", 1.5, true], ...chars("QWERTYUIOP[]"), ["\\", 1.5]]);
  row(3.5, 0, [["Caps", 1.75, true], ...chars("ASDFGHJKL;'"), ["Enter", 2.25, true]]);
  row(4.5, 0, [["Shift", 2.25, true], ...chars("ZXCVBNM,./"), ["Shift", 2.75, true]]);
  row(5.5, 0, [
    ["Ctrl", 1.25, true], ["Win", 1.25, true], ["Alt", 1.25, true], ["", 6.25],
    ["Alt", 1.25, true], ["Win", 1.25, true], ["Menu", 1.25, true], ["Ctrl", 1.25, true],
  ]);

  // Navigation block and arrows, 3 units wide.
  row(0, 15.5, [["PrtSc", 1, true], ["ScrLk", 1, true], ["Pause", 1, true]]);
  row(1.5, 15.5, [["Ins", 1, true], ["Home", 1, true], ["PgUp", 1, true]]);
  row(2.5, 15.5, [["Del", 1, true], ["End", 1, true], ["PgDn", 1, true]]);
  add(16.5, 4.5, 1, "↑", { mod: true });
  row(5.5, 15.5, [["←", 1, true], ["↓", 1, true], ["→", 1, true]]);

  // Numpad, 4 units wide.
  row(1.5, 19, [["Num", 1, true], ["/"], ["*"], ["-"]]);
  row(2.5, 19, [["7"], ["8"], ["9"]]);
  add(22, 2.5, 1, "+", { h: 2 });
  row(3.5, 19, [["4"], ["5"], ["6"]]);
  row(4.5, 19, [["1"], ["2"], ["3"]]);
  add(22, 4.5, 1, "Ent", { h: 2, mod: true });
  row(5.5, 19, [["0", 2], ["."]]);
  return keys;
}

function capGeometry(keys, extent) {
  const width = extent.w * PITCH;
  const depth = extent.h * PITCH;
  const parts = keys.map((k) => {
    const gap = 0.12;
    const w = k.w * PITCH - gap * 2;
    const d = k.h * PITCH - gap * 2;
    const geo = new BoxGeometry(w, CAP_H, d);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) pos.setXYZ(i, pos.getX(i) * 0.8, pos.getY(i), pos.getZ(i) * 0.78);
    }
    geo.translate(
      (k.x + k.w / 2) * PITCH - width / 2,
      CASE.h - 0.1 + CAP_H / 2,
      (k.y + k.h / 2) * PITCH - depth / 2 - 0.4,
    );
    geo.computeVertexNormals();
    // Flat map over the whole key area, so the sides sample the cap colour next to the legend.
    const uv = [];
    for (let i = 0; i < pos.count; i++) {
      uv.push((pos.getX(i) + width / 2) / width, 1 - (pos.getZ(i) + depth / 2 + 0.4) / depth);
    }
    geo.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    return geo;
  });
  return mergeGeometries(parts);
}

function capMaterial(keys, extent) {
  const map = drawTexture(Math.ceil(extent.w * TEX_PX), Math.ceil(extent.h * TEX_PX), (ctx, w, h) => {
    ctx.fillStyle = "#d9d3c0";
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const k of keys) {
      const x = k.x * TEX_PX;
      const y = k.y * TEX_PX;
      if (k.mod) {
        ctx.fillStyle = "#bdb6a1";
        ctx.fillRect(x + 2, y + 2, k.w * TEX_PX - 4, k.h * TEX_PX - 4);
      }
      if (!k.label) continue;
      ctx.fillStyle = "#4a463c";
      ctx.font = `${k.label.length > 2 ? 11 : 17}px sans-serif`;
      ctx.fillText(k.label, x + (k.w * TEX_PX) / 2, y + (k.h * TEX_PX) / 2);
    }
  });
  return new MeshStandardMaterial({ map, roughness: 0.55 });
}
