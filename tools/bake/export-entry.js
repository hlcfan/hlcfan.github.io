// Runs in headless Chromium. Builds the baked groups and returns them as a GLB plus light data.
import { Scene, Vector3 } from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { nameBakeMeshes, isBakeable } from "../../desk-src/scene/bake-names.js";
import { buildCRT } from "../../desk-src/scene/models/crt.js";
import { buildDesk } from "../../desk-src/scene/models/desk.js";
import { buildProps } from "../../desk-src/scene/models/props.js";
import { buildPC, CASE } from "../../desk-src/scene/models/pc.js";

window.exportBake = async () => {
  const scene = new Scene();
  const desk = buildDesk();
  const pc = buildPC();
  const crt = buildCRT();
  crt.position.set(0, CASE.h, 0);
  const props = buildProps();
  scene.add(desk, pc, crt, props);
  scene.updateMatrixWorld(true);

  for (const group of [desk, pc, crt, props]) nameBakeMeshes(group);
  scene.traverse((o) => {
    if ((o.isMesh && !isBakeable(o)) || o.isSprite || o.isPoints) o.visible = false;
  });

  const bulb = props.userData.parts.lampBulb.getWorldPosition(new Vector3());

  const glb = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true });
  return {
    glb: toBase64(new Uint8Array(glb)),
    meta: { lamp: bulb.toArray() },
  };
};

function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
