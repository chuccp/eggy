import * as THREE from 'three';
import { toonMat } from '../utils/colors';

// Swing set
export class Swing {
  group: THREE.Group;
  x: number;
  z: number;
  baseY: number;
  seat: THREE.Mesh;
  private ropeL: THREE.Mesh;
  private ropeR: THREE.Mesh;
  angle = 0;
  private angularVel = 0;

  constructor(x: number, z: number, getHeight: (x: number, z: number) => number) {
    this.x = x;
    this.z = z;
    this.group = new THREE.Group();
    const y = getHeight(x, z);
    this.baseY = y;
    this.group.position.set(x, y, z);

    const frameMat = toonMat(0x888888);
    const ropeMat = toonMat(0x666666);

    // A-frame
    const barGeo = new THREE.CylinderGeometry(0.05, 0.05, 3, 8);
    const legL1 = new THREE.Mesh(barGeo, frameMat);
    legL1.position.set(-0.8, 1.5, 0);
    legL1.rotation.z = 0.15;
    this.group.add(legL1);

    const legL2 = new THREE.Mesh(barGeo, frameMat);
    legL2.position.set(0.8, 1.5, 0);
    legL2.rotation.z = -0.15;
    this.group.add(legL2);

    // Top bar
    const topGeo = new THREE.CylinderGeometry(0.04, 0.04, 2, 8);
    topGeo.rotateZ(Math.PI / 2);
    const top = new THREE.Mesh(topGeo, frameMat);
    top.position.y = 2.9;
    this.group.add(top);

    // Ropes
    const ropeGeo = new THREE.CylinderGeometry(0.02, 0.02, 2.2, 4);
    this.ropeL = new THREE.Mesh(ropeGeo, ropeMat);
    this.ropeL.position.set(-0.3, 1.8, 0);
    this.group.add(this.ropeL);

    this.ropeR = new THREE.Mesh(ropeGeo, ropeMat);
    this.ropeR.position.set(0.3, 1.8, 0);
    this.group.add(this.ropeR);

    // Seat
    const seatGeo = new THREE.BoxGeometry(0.5, 0.04, 0.2);
    const seatMat = toonMat(0xA0522D);
    this.seat = new THREE.Mesh(seatGeo, seatMat);
    this.seat.position.y = 0.7;
    this.seat.castShadow = true;
    this.group.add(this.seat);

    this.group.castShadow = true;
  }

  update(dt: number) {
    // Gentle swinging physics
    const gravity = 9.8;
    const length = 2.2;
    this.angularVel += (-gravity / length * Math.sin(this.angle)) * dt;
    this.angularVel *= 0.995; // Damping
    this.angle += this.angularVel * dt;

    // Seat position follows the pendulum arc (physically consistent with rope length)
    const sinA = Math.sin(this.angle);
    const cosA = Math.cos(this.angle);
    this.seat.position.z = sinA * length;
    this.seat.position.y = 2.9 - cosA * length; // top bar y=2.9 minus rope projection

    // Rope positions: center of each rope = midpoint between top attachment and seat
    // RopeL top attachment: (-0.3, 2.9, 0), RopeR top attachment: (0.3, 2.9, 0)
    const halfLen = length * 0.5;
    const ropeCenterY = 2.9 - halfLen * cosA;
    const ropeCenterZ = halfLen * sinA;

    this.ropeL.position.set(-0.3, ropeCenterY, ropeCenterZ);
    this.ropeR.position.set(0.3, ropeCenterY, ropeCenterZ);

    // Rotate ropes to align from top attachment down to seat
    this.ropeL.rotation.x = -this.angle;
    this.ropeR.rotation.x = -this.angle;
  }

  push(force: number) {
    this.angularVel += force;
  }

  isNear(worldX: number, worldZ: number): boolean {
    const dx = worldX - this.x;
    const dz = worldZ - this.z;
    return Math.sqrt(dx * dx + dz * dz) < 2.5;
  }

  get interactLabel(): string { return '按 E 推秋千'; }
}

// See-saw
export class SeeSaw {
  group: THREE.Group;
  x: number;
  z: number;
  baseY: number;
  private plank: THREE.Mesh;
  angle = 0;
  private angularVel = 0;

  constructor(x: number, z: number, getHeight: (x: number, z: number) => number) {
    this.x = x;
    this.z = z;
    this.group = new THREE.Group();
    const y = getHeight(x, z);
    this.baseY = y;
    this.group.position.set(x, y, z);

    const mat = toonMat(0xDEB887);
    const pivotMat = toonMat(0x888888);

    // Fulcrum
    const fulcrum = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.5, 8),
      pivotMat,
    );
    fulcrum.position.y = 0.25;
    this.group.add(fulcrum);

    // Plank
    const plankGeo = new THREE.BoxGeometry(3, 0.08, 0.4);
    this.plank = new THREE.Mesh(plankGeo, mat);
    this.plank.position.y = 0.55;
    this.plank.castShadow = true;
    this.group.add(this.plank);
  }

  update(dt: number) {
    this.angularVel += (-12 * Math.sin(this.angle)) * dt;
    this.angularVel *= 0.98;
    this.angle += this.angularVel * dt;
    this.angle = Math.max(-0.3, Math.min(0.3, this.angle));
    this.plank.rotation.z = this.angle;
  }

  push(force: number) {
    this.angularVel += force;
  }

  isNear(worldX: number, worldZ: number): boolean {
    const dx = worldX - this.x;
    const dz = worldZ - this.z;
    return Math.sqrt(dx * dx + dz * dz) < 2.5;
  }

  get interactLabel(): string { return '按 E 压跷跷板'; }
}
