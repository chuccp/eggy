import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { toonMat } from '../utils/colors';
import type { PhysicsWorld } from '../game/Physics';

const BALL_COLORS = [0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0x95E1D3, 0xF38181, 0xAA96DA];
const RADIUS = 0.42;

/**
 * Colourful balls scattered around the plaza that the character can shove around.
 * Each one is a real cannon sphere resting on the terrain heightfield, so the
 * character's capsule pushes them through ordinary contact resolution.
 */
export class PushableBalls {
  private meshes: THREE.Mesh[] = [];
  private bodies: CANNON.Body[] = [];

  constructor(
    private physics: PhysicsWorld,
    getHeight: (x: number, z: number) => number,
    positions: [number, number][],
  ) {
    positions.forEach(([x, z], i) => {
      const color = BALL_COLORS[i % BALL_COLORS.length];
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS, 16, 12),
        toonMat(color),
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const y = getHeight(x, z) + RADIUS + 0.1;
      mesh.position.set(x, y, z);
      this.meshes.push(mesh);

      const body = new CANNON.Body({
        mass: 1.5,
        shape: new CANNON.Sphere(RADIUS),
        position: new CANNON.Vec3(x, y, z),
      });
      // Friction is disabled globally (the player is velocity-driven), so damping is
      // what stops the balls from rolling forever.
      body.linearDamping = 0.4;
      body.angularDamping = 0.4;
      this.physics.world.addBody(body);
      this.bodies.push(body);
    });
  }

  /** Copy each simulated body onto its mesh. */
  update() {
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      const m = this.meshes[i];
      m.position.set(b.position.x, b.position.y, b.position.z);
      m.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    }
  }

  addToScene(scene: THREE.Scene) {
    for (const mesh of this.meshes) scene.add(mesh);
  }
}
