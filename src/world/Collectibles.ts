import * as THREE from 'three';
import { toonMat } from '../utils/colors';

// Lily pad (in water)
export class LilyPad {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  private baseY: number;
  private sinkAmount = 0;
  private playerOn = false;

  constructor(x: number, z: number) {
    this.x = x;
    this.z = z;
    const geo = new THREE.CircleGeometry(0.6, 16);
    geo.rotateX(-Math.PI / 2);
    const mat = toonMat(0x228B22, { side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(x, 0.1, z);
    this.baseY = 0.1;
    this.mesh.castShadow = true;
  }

  update(dt: number) {
    this.sinkAmount *= 0.95;
    this.mesh.position.y = this.baseY - this.sinkAmount;
    // Gradual bob when player was on
    if (this.playerOn) {
      this.sinkAmount = Math.max(this.sinkAmount, 0.15);
    }
    this.playerOn = false;
  }

  /** Call each frame with player position. Returns true if player is on this pad. */
  checkPlayerOn(px: number, py: number, pz: number): boolean {
    const dx = px - this.x;
    const dz = pz - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.7 && py < 0.8) {
      this.playerOn = true;
      this.sinkAmount = 0.25;
      return true;
    }
    return false;
  }

  sink() {
    this.sinkAmount = 0.3;
  }
}

// Collectible golden egg (easter egg)
export class GoldenEgg {
  mesh: THREE.Group;
  collected = false;
  private baseY: number;

  constructor(x: number, z: number, getHeight: (x: number, z: number) => number) {
    this.mesh = new THREE.Group();
    const y = getHeight(x, z);
    this.baseY = y + 0.5;
    this.mesh.position.set(x, this.baseY, z);

    const eggGeo = new THREE.SphereGeometry(0.3, 16, 12);
    eggGeo.scale(1, 1.3, 1);
    const eggMat = toonMat(0xFFD700, { emissive: 0xFFD700, emissiveIntensity: 0.3 });
    const egg = new THREE.Mesh(eggGeo, eggMat);
    this.mesh.add(egg);

    // Glow ring
    const ringGeo = new THREE.RingGeometry(0.4, 0.5, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xFFD700,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -0.3;
    this.mesh.add(ring);
  }

  update(dt: number, playerPos: THREE.Vector3): boolean {
    if (this.collected) return false;

    // Float animation (anchored, so it never drifts away from its spot)
    this.mesh.position.y = this.baseY + Math.sin(Date.now() * 0.003) * 0.12;
    this.mesh.rotation.y += dt * 0.5;

    // Pulse glow
    const mat = (this.mesh.children[0] as THREE.Mesh).material as THREE.MeshToonMaterial;
    mat.emissiveIntensity = 0.3 + Math.sin(Date.now() * 0.005) * 0.15;

    // Check proximity
    if (this.mesh.position.distanceTo(playerPos) < 2) {
      this.collected = true;
      this.mesh.visible = false;
      return true; // Signal collection
    }
    return false;
  }
}
