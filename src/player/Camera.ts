import * as THREE from 'three';
import { clamp } from '../utils/math';
import type { Collider } from '../world/Terrain';

const _ray = new THREE.Raycaster();
const _dir = new THREE.Vector3();
const _sphere = new THREE.Sphere();

export class ThirdPersonCamera {
  camera: THREE.PerspectiveCamera;

  private yaw = 0;
  private pitch = 0.15;
  private distance = 8;
  private targetDistance = 8;

  private restingActive = false;
  private readonly restingPitch = 0.05;
  private readonly restingDistanceTarget = 12;

  private readonly minPitch = -0.2;
  private readonly maxPitch = 1.2;
  private readonly minDistance = 4;
  private readonly maxDistance = 15;
  private readonly sensitivity = 0.003;

  private smoothPos = new THREE.Vector3();
  private smoothTarget = new THREE.Vector3();
  private firstUpdate = true;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 500);
  }

  handleMouse(dx: number, dy: number) {
    this.yaw -= dx * this.sensitivity;
    this.pitch += dy * this.sensitivity;
    this.pitch = clamp(this.pitch, this.minPitch, this.maxPitch);
  }

  handleScroll(delta: number) {
    if (this.restingActive) return;
    this.targetDistance += delta * 0.005;
    this.targetDistance = clamp(this.targetDistance, this.minDistance, this.maxDistance);
  }

  setRestingMode(active: boolean) {
    this.restingActive = active;
  }

  update(target: THREE.Vector3, dt: number, colliders?: Collider[]) {
    // Only the resting view eases the camera. Outside of it the player owns pitch and
    // zoom — easing them back every frame would undo look-up/down and scroll zoom.
    if (this.restingActive) {
      const lerpSpeed = Math.min(dt * 1.2, 1);
      this.pitch += (this.restingPitch - this.pitch) * lerpSpeed;
      this.targetDistance += (this.restingDistanceTarget - this.targetDistance) * lerpSpeed;
    }

    this.distance += (this.targetDistance - this.distance) * Math.min(dt * 5, 1);

    const offsetX = Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
    const offsetY = Math.sin(this.pitch) * this.distance;
    const offsetZ = Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;

    const desiredPos = new THREE.Vector3(
      target.x + offsetX,
      target.y + 1.0 + offsetY,
      target.z + offsetZ,
    );

    // M14: Camera obstacle collision — pull camera closer if blocked
    if (colliders && colliders.length > 0) {
      const eyePos = new THREE.Vector3(target.x, target.y + 1.0, target.z);
      _dir.subVectors(desiredPos, eyePos).normalize();
      const maxDist = eyePos.distanceTo(desiredPos);
      let safeDist = maxDist;

      // The sphere test below reads _ray's own ray, so aim it down the eye→camera line
      _ray.set(eyePos, _dir);

      for (const col of colliders) {
        if (col.wallX1 !== undefined) {
          // Wall segment collision: test ray against a thin box around the wall
          const dist = this.rayVsWallSegment(eyePos, _dir, maxDist, col);
          if (dist !== null && dist < safeDist) {
            safeDist = dist;
          }
        } else {
          // Cylinder collision: test ray against a sphere approximation
          const center = new THREE.Vector3(col.x, eyePos.y, col.z);
          _sphere.set(center, col.radius + 0.3);
          const hit = new THREE.Vector3();
          if (_ray.ray.intersectSphere(_sphere, hit)) {
            const d = eyePos.distanceTo(hit);
            if (d < safeDist) safeDist = d;
          }
        }
      }

      if (safeDist < maxDist) {
        const pullBack = Math.max(safeDist - 0.3, 0.5);
        desiredPos.copy(eyePos).addScaledVector(_dir, pullBack);
      }
    }

    const lookTarget = new THREE.Vector3(target.x, target.y + 0.5, target.z);

    if (this.firstUpdate) {
      this.smoothPos.copy(desiredPos);
      this.smoothTarget.copy(lookTarget);
      this.firstUpdate = false;
    }

    const smoothFactor = Math.min(dt * 8, 1);
    this.smoothPos.lerp(desiredPos, smoothFactor);
    this.smoothTarget.lerp(lookTarget, smoothFactor);

    this.camera.position.copy(this.smoothPos);
    this.camera.lookAt(this.smoothTarget);
  }

  /** Ray vs wall segment intersection (2D in XZ plane) */
  private rayVsWallSegment(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, col: Collider): number | null {
    const wx = col.wallX2! - col.wallX1!;
    const wz = col.wallZ2! - col.wallZ1!;
    const len = Math.sqrt(wx * wx + wz * wz);
    if (len < 0.01) return null;

    // Wall normal (perpendicular in XZ)
    const nx = -wz / len;
    const nz = wx / len;

    // Ray-plane intersection
    const denom = dir.x * nx + dir.z * nz;
    if (Math.abs(denom) < 0.001) return null;

    const wx0 = col.wallX1! - origin.x;
    const wz0 = col.wallZ1! - origin.z;
    const t = (wx0 * nx + wz0 * nz) / denom;

    if (t < 0 || t > maxDist) return null;

    // Check if hit point is within wall segment bounds
    const hitX = origin.x + dir.x * t;
    const hitZ = origin.z + dir.z * t;
    const dx = hitX - col.wallX1!;
    const dz = hitZ - col.wallZ1!;
    const proj = (dx * wx + dz * wz) / (len * len);

    if (proj < -0.1 || proj > 1.1) return null; // Small margin

    return t;
  }

  getForwardDir(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
  }

  getRightDir(): THREE.Vector3 {
    const fwd = this.getForwardDir();
    return new THREE.Vector3(-fwd.z, 0, fwd.x);
  }

  get yawAngle(): number {
    return this.yaw;
  }

  resize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
