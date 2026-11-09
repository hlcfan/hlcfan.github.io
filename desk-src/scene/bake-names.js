// Stable names for the meshes of a model group, shared by the bake export and the runtime.
// The name is the group name, an underscore, and the child-index path (GLTFLoader strips "/" from node names), so it does not depend on object names.
import { Mesh } from "three";

// Only lit standard materials are baked. LEDs, decals, and the glass keep their own look.
export function isBakeable(mesh) {
  const m = mesh.material;
  return mesh.isMesh && !mesh.userData.noBake && m && !Array.isArray(m) && m.isMeshStandardMaterial && !m.transparent;
}

// A mesh with `userData.bakeGroup` goes to that group, others to the group of the root.
export function nameBakeMeshes(root, group = root.name) {
  const named = [];
  walk(root, [], (obj, path) => {
    if (!(obj instanceof Mesh) || !isBakeable(obj)) return;
    obj.name = `${obj.userData.bakeGroup ?? group}_${path.join("-")}`;
    named.push(obj);
  });
  return named;
}

function walk(obj, path, visit) {
  obj.children.forEach((child, i) => {
    const next = [...path, i];
    visit(child, next);
    walk(child, next, visit);
  });
}
