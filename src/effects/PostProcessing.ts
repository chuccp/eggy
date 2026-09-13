import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/** Custom vignette shader — darkens screen edges slightly */
const VignetteShader = {
  name: 'VignetteShader',
  uniforms: {
    tDiffuse: { value: null },
    uOffset: { value: 0.4 },  // inner radius where darkening starts
    uDarkness: { value: 0.9 }, // outer radius where full darkening applies
    uStrength: { value: 0.35 }, // how much to darken (0 = none, 1 = black)
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uOffset;
    uniform float uDarkness;
    uniform float uStrength;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float dist = distance(vUv, vec2(0.5));
      float vignette = smoothstep(uOffset, uDarkness, dist);
      color.rgb *= 1.0 - vignette * uStrength;
      gl_FragColor = color;
    }
  `,
};

export function createPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): EffectComposer {
  const size = renderer.getSize(new THREE.Vector2());

  const composer = new EffectComposer(renderer);

  // 1. Scene render pass
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 2. Bloom (subtle, targets bright lights/water highlights)
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(size.x, size.y),
    0.3,   // strength
    0.4,   // radius
    0.85,  // threshold
  );
  composer.addPass(bloomPass);

  // 3. Vignette
  const vignettePass = new ShaderPass(VignetteShader);
  composer.addPass(vignettePass);

  // 4. Output pass (applies renderer toneMapping + colorSpace)
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return composer;
}
