// Applies the offline bake: lightmaps and the second UV set for the code-built models.
// Each mesh group has a lightmap per lamp state. Fails soft: any error leaves the flat scene.
import { Box3, SRGBColorSpace, TextureLoader } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { nameBakeMeshes } from "./bake-names.js";

const BOX_TOLERANCE_CM = 0.05;

// `roots` are the model groups that were baked. Resolves to null, or { count, setLamp }.
export async function loadBake({ roots, base = "", url = `${base}/assets/desk/bake/` }) {
  try {
    const res = await fetch(`${url}bake.json`);
    if (!res.ok) return null;
    const manifest = await res.json();
    const loader = new TextureLoader();
    const [gltf, onMaps] = await Promise.all([
      new GLTFLoader().loadAsync(`${url}${manifest.geometry}`),
      loadState(manifest, url, loader, "on"),
    ]);

    const meshes = apply(roots, gltf);
    const maps = { on: onMaps, off: null };
    let lamp = "on";
    const bake = {
      count: meshes.length,
      // Swaps the lightmaps. The lamp-off set loads on first use.
      async setLamp(on) {
        const state = on ? "on" : "off";
        lamp = state;
        maps[state] ??= await loadState(manifest, url, loader, state);
        if (lamp !== state) return; // a later toggle won
        for (const { mesh, group } of meshes) {
          const set = maps[state][group];
          mesh.material.lightMap = set.tex;
          mesh.material.lightMapIntensity = set.exposure;
        }
      },
    };
    for (const { mesh, group } of meshes) {
      mesh.material = mesh.material.clone();
      mesh.material.lightMap = onMaps[group].tex;
      mesh.material.lightMapIntensity = onMaps[group].exposure;
    }
    return bake;
  } catch (err) {
    console.warn("bake not applied:", err);
    return null;
  }
}

async function loadState(manifest, url, loader, state) {
  const entries = await Promise.all(
    Object.entries(manifest.groups).map(async ([group, g]) => {
      const tex = await loader.loadAsync(`${url}${g.states[state].file}`);
      tex.flipY = false;
      tex.colorSpace = SRGBColorSpace;
      tex.channel = 1;
      return [group, { tex, exposure: g.exposure }];
    }),
  );
  return Object.fromEntries(entries);
}

// Swaps in the geometry that carries the second UV set. Meshes whose shape differs are left alone.
function apply(roots, gltf) {
  const baked = new Map();
  gltf.scene.traverse((o) => { if (o.isMesh) baked.set(o.name, o); });

  const applied = [];
  for (const root of roots) {
    for (const mesh of nameBakeMeshes(root)) {
      const src = baked.get(mesh.name);
      if (!src || !sameShape(mesh.geometry, src.geometry)) continue;
      mesh.geometry = src.geometry;
      applied.push({ mesh, group: mesh.name.split("_")[0] });
    }
  }
  return applied;
}

function sameShape(a, b) {
  const boxA = new Box3().setFromBufferAttribute(a.attributes.position);
  const boxB = new Box3().setFromBufferAttribute(b.attributes.position);
  return boxA.min.distanceTo(boxB.min) < BOX_TOLERANCE_CM && boxA.max.distanceTo(boxB.max) < BOX_TOLERANCE_CM;
}
