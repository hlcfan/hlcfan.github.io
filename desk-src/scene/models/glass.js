// A Glencairn-style whisky glass: a tulip bowl on a short stem and a wide foot, half full.
// The glass is see-through, so it is lit live and not baked. The whisky is opaque and bakes.
import { CircleGeometry, DoubleSide, Group, LatheGeometry, Mesh, MeshStandardMaterial, Vector2 } from "three";

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
    color: 0xdfeaf0, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.12, side: DoubleSide, depthWrite: false,
  }));

  const whiskyMaterial = new MeshStandardMaterial({ color: 0x9a6208, emissive: 0x4a2c00, roughness: 0.12 });
  const whisky = new Mesh(lathe(POUR), whiskyMaterial);
  const surface = new Mesh(new CircleGeometry(LEVEL_RADIUS - 0.02, SEGMENTS), whiskyMaterial);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = LEVEL;

  group.add(whisky, surface, glass);
  return group;
}

function lathe(points) {
  return new LatheGeometry(points.map(([r, y]) => new Vector2(r, y)), SEGMENTS);
}
