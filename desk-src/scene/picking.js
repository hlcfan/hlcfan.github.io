// Raycasting for interactive objects. Targets are registered by name.
import { Raycaster, Vector2 } from "three";

export function createPicker(camera, canvas, targets) {
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const names = Object.keys(targets);
  const objects = names.map((n) => targets[n]);

  return { pick };

  // Returns the name of the nearest target under the pointer, or null.
  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(objects, true);
    if (!hits.length) return null;
    for (const hit of hits) {
      for (let i = 0; i < objects.length; i++) {
        if (hit.object === objects[i] || isDescendant(hit.object, objects[i])) return names[i];
      }
    }
    return null;
  }
}

function isDescendant(obj, ancestor) {
  for (let o = obj.parent; o; o = o.parent) if (o === ancestor) return true;
  return false;
}
