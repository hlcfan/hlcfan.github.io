// A Glencairn-style whisky glass: a tulip bowl on a short stem and a wide foot, half full.
// Both the glass and the whisky are see-through, so neither is baked.
import {
  AdditiveBlending, CircleGeometry, Color, DoubleSide, Float32BufferAttribute, Group, LatheGeometry, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Vector2,
} from "three";

const SEGMENTS = 48;
const LEVEL = 5.0;       // whisky surface height in cm
const LEVEL_RADIUS = 2.94;

// Outer wall from the base centre up to the rim, then the inner wall back down. Units are cm.
const OUTER = [[0, 0], [2.6, 0], [2.7, 0.2], [1.6, 0.7], [1.5, 1.4], [2.4, 2.6], [3.1, 4.2], [3.2, 5.4], [3.0, 7.2], [2.6, 9.0], [2.45, 10.4]];
const INNER = [[2.23, 10.4], [2.38, 9.0], [2.78, 7.2], [2.98, 5.4], [2.88, 4.2], [2.2, 2.9], [0, 2.5]];
// Where the whisky sits: the inner wall from the bowl floor up to the surface.
const POUR = [[0, 2.5], [2.18, 2.9], [2.86, 4.2], [LEVEL_RADIUS - 0.02, LEVEL]];

export function buildGlass() {
  const group = new Group();
  group.name = "glass";

  const glass = new Mesh(lathe([...OUTER, ...INNER]), new MeshStandardMaterial({
    color: 0xdfeaf0, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.08, side: DoubleSide, depthWrite: false,
  }));

  // The whisky is see-through: a gradient from deep amber at the bottom to bright gold at the
  // surface, with a lit patch on the bowl floor where light gathers. It is unlit and not baked.
  const whisky = new Mesh(lathe(POUR), new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92, side: DoubleSide, depthWrite: false }));
  paintGradient(whisky.geometry);
  whisky.renderOrder = 1;
  const surface = new Mesh(new CircleGeometry(LEVEL_RADIUS - 0.02, SEGMENTS), new MeshBasicMaterial({ color: 0xe9a01c, transparent: true, opacity: 0.9, depthWrite: false }));
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = LEVEL;
  surface.renderOrder = 1;
  const glow = new Mesh(new CircleGeometry(1.5, 24), new MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 2.6;
  glow.renderOrder = 1;
  glass.renderOrder = 2;

  group.add(whisky, surface, glow, glass);
  return group;
}

function lathe(points) {
  return new LatheGeometry(points.map(([r, y]) => new Vector2(r, y)), SEGMENTS);
}

// Deep amber at the floor of the bowl, bright gold at the surface.
function paintGradient(geometry) {
  const low = new Color(0xa84a00);
  const high = new Color(0xe8920c);
  const pos = geometry.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - 2.5) / (LEVEL - 2.5)));
    const c = low.clone().lerp(high, t);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
}
