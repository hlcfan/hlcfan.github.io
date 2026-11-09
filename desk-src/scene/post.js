// Post-processing: multisampled half-float scene, a gentle bloom, then tone mapping.
// Bloom is the first thing dropped when frames miss the budget. Software renderers get neither bloom nor multisampling.
import { HalfFloatType, NeutralToneMapping, Vector2, WebGLRenderTarget } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const BLOOM = { strength: 0.32, radius: 0.55, threshold: 0.92 };

export function createPost(renderer, scene, camera) {
  // Neutral keeps hues and mid-tones, so the terminal text colors stay as the themes define them.
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1;

  // A software renderer (SwiftShader, llvmpipe) cannot afford multisampling or bloom.
  const software = isSoftwareRenderer(renderer.getContext());
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: software ? 0 : 4 });
  const composer = new EffectComposer(renderer, target);
  const bloom = new UnrealBloomPass(new Vector2(1, 1), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  if (software) bloom.enabled = false;

  return {
    render: () => composer.render(),
    setSize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    setBloom(on) { bloom.enabled = on; },
    get bloom() { return bloom.enabled; },
  };
}

function isSoftwareRenderer(gl) {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
  return /swiftshader|llvmpipe|software/i.test(name);
}
