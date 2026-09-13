import * as THREE from 'three';
import { toonMat } from '../utils/colors';

const WATER_Y = 0.05;
const HULL_DECK = 0.35;     // deck height above the water surface
const MAX_THROTTLE = 5.5;
const TURN_RATE = 1.6;

/**
 * A rowboat floating on the lake. It is deliberately not a physics body — while the
 * character rides it the Controls layer drives it directly and clamps it inside the lake,
 * which keeps rowing predictable.
 */
export class Boat {
  group: THREE.Group;
  x: number;
  z: number;
  /** Heading in radians; 0 points toward -Z. */
  heading = 0;
  private speed = 0;
  private bobPhase = Math.random() * Math.PI * 2;

  constructor(
    private lakeCenter: { x: number; z: number },
    private lakeRadius: number,
    startX: number,
    startZ: number,
  ) {
    this.x = startX;
    this.z = startZ;

    this.group = new THREE.Group();
    const hullMat = toonMat(0xA0522D);
    const trimMat = toonMat(0xE8D5B7);
    const deckMat = toonMat(0xC19A6B);

    // Hull: a squashed sphere gives a rounded dinghy silhouette
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1.15, 18, 12), hullMat);
    hull.scale.set(1.0, 0.42, 1.5);
    hull.position.y = 0.05;
    hull.castShadow = true;
    this.group.add(hull);

    // Inner deck so you can see into the boat
    const deck = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 10), deckMat);
    deck.scale.set(1.0, 0.3, 1.42);
    deck.position.y = 0.24;
    this.group.add(deck);

    // Rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.09, 8, 20), trimMat);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(1.0, 1.45, 1.0);
    rim.position.y = 0.34;
    rim.castShadow = true;
    this.group.add(rim);

    // Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.42), trimMat);
    seat.position.set(0, 0.34, 0.1);
    seat.castShadow = true;
    this.group.add(seat);

    // Oars resting across the gunwales
    for (const side of [-1, 1]) {
      const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.9, 6), toonMat(0x8B5A2B));
      oar.rotation.z = Math.PI / 2;
      oar.rotation.y = side * 0.28;
      oar.position.set(side * 0.35, 0.56, 0.15);
      this.group.add(oar);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.16), toonMat(0x8B5A2B));
      blade.position.set(side * 1.2, 0.56, 0.15 + side * 0.28);
      this.group.add(blade);
    }

    this.group.position.set(startX, WATER_Y, startZ);
  }

  /** Seat position in world space (where the rider sits). */
  seatPosition(): { x: number; y: number; z: number } {
    return { x: this.x, y: WATER_Y + HULL_DECK + 0.18, z: this.z };
  }

  isNear(x: number, z: number, range = 2.6): boolean {
    return Math.hypot(x - this.x, z - this.z) < range;
  }

  /** Rowing: throttle -1..1 drives forward, steer -1..1 turns. */
  drive(throttle: number, steer: number, dt: number) {
    this.heading += steer * TURN_RATE * dt;
    const target = throttle * MAX_THROTTLE;
    // Ease toward the target speed so rowing feels like a boat, not a car
    this.speed += (target - this.speed) * Math.min(dt * 1.8, 1);
  }

  update(dt: number) {
    if (Math.abs(this.speed) > 0.01) {
      // heading 0 points toward -Z
      this.x += Math.sin(this.heading) * this.speed * dt;
      this.z += Math.cos(this.heading) * this.speed * dt;

      // Stay on the lake
      const dx = this.x - this.lakeCenter.x;
      const dz = this.z - this.lakeCenter.z;
      const dist = Math.hypot(dx, dz);
      const limit = this.lakeRadius - 1.6;
      if (dist > limit) {
        this.x = this.lakeCenter.x + (dx / dist) * limit;
        this.z = this.lakeCenter.z + (dz / dist) * limit;
        this.speed *= 0.4;
      }
    } else {
      this.speed *= Math.max(0, 1 - dt * 3);
    }

    this.bobPhase += dt * 1.6;
    this.group.position.set(
      this.x,
      WATER_Y + Math.sin(this.bobPhase) * 0.05,
      this.z,
    );
    this.group.rotation.set(
      Math.sin(this.bobPhase * 0.8) * 0.02,
      this.heading,
      Math.sin(this.bobPhase * 0.6) * 0.03,
    );
  }

  /** A spot on the shore nearest the boat, for getting out. */
  dockPosition(): { x: number; z: number } {
    const dx = this.x - this.lakeCenter.x;
    const dz = this.z - this.lakeCenter.z;
    const dist = Math.hypot(dx, dz) || 1;
    const r = this.lakeRadius + 1.5;
    return {
      x: this.lakeCenter.x + (dx / dist) * r,
      z: this.lakeCenter.z + (dz / dist) * r,
    };
  }
}
