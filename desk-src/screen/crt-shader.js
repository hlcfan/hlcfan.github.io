// The CRT look: curvature, beam blur, scanlines, aperture mask, vignette,
// flicker, and the power-on/off curve. Drawn additively over the dark glass.
import { AdditiveBlending, CanvasTexture, LinearFilter, LinearMipmapLinearFilter, ShaderMaterial, SRGBColorSpace, Vector2 } from "three";

export const CRT_DEFAULTS = { curvature: 0.05, scanline: 0.25, mask: 0.15, vignette: 0.35, flicker: 0.02 };

export function createScreenTexture(canvas) {
  const tex = new CanvasTexture(canvas);
  tex.flipY = false; // rows are uploaded top-down as bands; the shader flips v
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

export function createCrtMaterial(texture) {
  return new ShaderMaterial({
    uniforms: {
      uTex: { value: texture },
      uTexel: { value: new Vector2(1 / texture.image.width, 1 / texture.image.height) },
      uCurvature: { value: CRT_DEFAULTS.curvature },
      uScanline: { value: CRT_DEFAULTS.scanline },
      uMask: { value: CRT_DEFAULTS.mask },
      uVignette: { value: CRT_DEFAULTS.vignette },
      uFlicker: { value: CRT_DEFAULTS.flicker },
      uTime: { value: 0 },
      uPower: { value: 0 },
      uScreenHeightPx: { value: 400 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}

// `crt off` zeroes curvature, scanlines, mask and flicker. The vignette stays.
export function setCrtEnabled(material, on) {
  const u = material.uniforms;
  u.uCurvature.value = on ? CRT_DEFAULTS.curvature : 0;
  u.uScanline.value = on ? CRT_DEFAULTS.scanline : 0;
  u.uMask.value = on ? CRT_DEFAULTS.mask : 0;
  u.uFlicker.value = on ? CRT_DEFAULTS.flicker : 0;
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uCurvature, uScanline, uMask, uVignette, uFlicker, uTime, uPower, uScreenHeightPx;
varying vec2 vUv;

void main() {
  vec2 cc = vUv * 2.0 - 1.0;

  // 1. Barrel distortion. Outside the distorted rectangle there is no picture.
  vec2 d = cc * (1.0 + uCurvature * dot(cc, cc));
  vec2 uv = d * 0.5 + 0.5;
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  vec2 st = vec2(uv.x, 1.0 - uv.y);

  // 2. Horizontal beam blur from three samples.
  vec3 col = texture2D(uTex, st).rgb * 0.5
           + texture2D(uTex, st + vec2(uTexel.x * 0.6, 0.0)).rgb * 0.25
           + texture2D(uTex, st - vec2(uTexel.x * 0.6, 0.0)).rgb * 0.25;

  // 3. Scanlines. The count follows the screen size on the display and fades
  // out below 60 lines, where they would cut through the glyphs.
  float lines = min(480.0, floor(uScreenHeightPx / 3.0));
  float fade = smoothstep(60.0, 100.0, lines);
  float wave = 0.5 + 0.5 * cos(6.2831853 * uv.y * lines);
  col *= 1.0 - uScanline * fade * (1.0 - wave);

  // 4. RGB aperture mask, one triad per 3 device pixels, fading with the scanlines.
  float triad = mod(floor(gl_FragCoord.x), 3.0);
  float m = uMask * fade;
  vec3 mk = vec3(1.0 - m);
  if (triad < 1.0) mk.r = 1.0; else if (triad < 2.0) mk.g = 1.0; else mk.b = 1.0;
  col *= mk * (1.0 + m * 0.6);

  // 5. Vignette and 6. flicker.
  col *= 1.0 - uVignette * dot(cc, cc) * 0.5;
  col *= 1.0 + uFlicker * sin(uTime * 47.0);
  col *= inside;

  // 7. Power curve: dot, then a line, then the picture fills the height.
  if (uPower < 0.999) {
    vec2 p = cc * vec2(4.0 / 3.0, 1.0);
    if (uPower < 0.15) {
      float k = uPower / 0.15;
      float r = mix(0.012, 0.05, k);
      col = vec3(smoothstep(r, 0.0, length(p))) * mix(0.3, 1.2, k);
    } else if (uPower < 0.5) {
      float k = (uPower - 0.15) / 0.35;
      float halfW = mix(0.05, 1.4, k * k);
      float thick = mix(0.05, 0.012, k);
      float line = smoothstep(thick, 0.0, abs(p.y)) * step(abs(p.x), halfW);
      col = vec3(line) * 1.2;
    } else {
      float k = (uPower - 0.5) / 0.5;
      float halfH = mix(0.012, 1.05, 1.0 - (1.0 - k) * (1.0 - k));
      float edge = smoothstep(halfH, halfH - 0.03, abs(p.y));
      col = mix(vec3(edge * 1.1), col * edge, smoothstep(0.0, 0.8, k));
    }
  }

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
