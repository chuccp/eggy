import * as THREE from 'three';
import { COLORS } from '../utils/colors';

export class SceneManager {
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;

  constructor() {
    this.scene = new THREE.Scene();

    // Sky color
    this.scene.background = new THREE.Color(COLORS.sky);
    this.scene.fog = new THREE.Fog(COLORS.sky, 80, 200);

    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    // Hemisphere light (sky + ground)
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x556B2F, 0.4);
    this.scene.add(hemi);

    // Directional light (sun)
    const sun = new THREE.DirectionalLight(0xFFF5E1, 1.0);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    // Simple sky dome (gradient sphere)
    const skyGeo = new THREE.SphereGeometry(150, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color(COLORS.skyZenith) },
        uBottomColor: { value: new THREE.Color(COLORS.sky) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          float t = max(0.0, h);
          gl_FragColor = vec4(mix(uBottomColor, uTopColor, t), 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);
  }
}
