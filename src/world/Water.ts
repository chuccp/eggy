import * as THREE from 'three';
import { COLORS } from '../utils/colors';

// Water surface with wave shader + fake reflection
export class Water {
  mesh: THREE.Mesh;

  constructor() {
    const geo = new THREE.CircleGeometry(12, 48);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(COLORS.water) },
        uSkyColor: { value: new THREE.Color(0xB0D4F1) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPos;
        varying vec3 vWorldNormal;
        uniform float uTime;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.y += sin(p.x * 2.0 + uTime * 1.5) * 0.03;
          p.y += cos(p.z * 1.5 + uTime * 1.2) * 0.03;
          vPos = p;
          // Approximate normal from wave derivatives
          float nx = cos(p.x * 2.0 + uTime * 1.5) * 2.0 * 0.03;
          float nz = -sin(p.z * 1.5 + uTime * 1.2) * 1.5 * 0.03;
          vWorldNormal = normalize(vec3(nx, 1.0, nz));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uSkyColor;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vPos;
        varying vec3 vWorldNormal;
        void main() {
          float wave = sin(vUv.x * 20.0 + uTime * 2.0) * 0.5 + 0.5;
          wave *= cos(vUv.y * 15.0 + uTime * 1.5) * 0.5 + 0.5;

          float dist = length(vUv - 0.5);
          float depth = 1.0 - smoothstep(0.0, 0.45, dist);

          // Base water color with depth
          vec3 color = uColor * (0.7 + 0.3 * depth);
          color += wave * 0.08;

          // Fake reflection: blend sky color based on normal Y and wave
          // Fresnel-like: more reflection at grazing angles (edges)
          float fresnel = pow(1.0 - vWorldNormal.y, 2.0);
          float reflStrength = mix(0.1, 0.35, fresnel) * (0.8 + wave * 0.2);
          color = mix(color, uSkyColor, reflStrength);

          // Foam at edges
          float foam = 1.0 - smoothstep(0.44, 0.49, dist);
          foam = max(0.0, foam) * 0.35;
          color += vec3(foam);

          // Opacity
          float alpha = mix(0.45, 0.8, depth);
          float edge = smoothstep(0.48, 0.5, dist);
          alpha *= (1.0 - edge);

          gl_FragColor = vec4(color, alpha);
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(-30, 0.05, -20);
    this.mesh.receiveShadow = true;
  }

  update(time: number) {
    (this.mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
  }
}
