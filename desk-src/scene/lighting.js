// Warm key light, a lamp light that stays off until the lamp prop lands,
// and a procedural room environment for plastic reflections.
import { Color, DirectionalLight, HemisphereLight, PMREMGenerator, PointLight } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export function setupLighting(scene, renderer) {
  scene.background = new Color(0x0b0a09);

  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;
  pmrem.dispose();

  scene.add(new HemisphereLight(0x8a8fa8, 0x2a1d12, 0.35));

  const key = new DirectionalLight(0xffe2b8, 1.4);
  key.position.set(-60, 90, 70);
  scene.add(key);

  const lamp = new PointLight(0xffcf8a, 0, 260, 1.4);
  lamp.position.set(-52, 34, 0);
  scene.add(lamp);

  return { key, lamp };
}
