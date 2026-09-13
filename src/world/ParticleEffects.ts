import * as THREE from 'three';

// Dust puff on landing
export class DustPuff {
  particles: THREE.Points;
  private velocities: Float32Array;
  private lifetimes: Float32Array;
  private maxLifetime: Float32Array;
  alive = false;

  constructor() {
    const count = 20;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.lifetimes = new Float32Array(count);
    this.maxLifetime = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -100; // off screen
      positions[i * 3 + 2] = 0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xD2B48C,
      size: 0.15,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geo, mat);
  }

  trigger(x: number, y: number, z: number) {
    const pos = (this.particles.geometry.attributes.position as THREE.BufferAttribute);
    this.alive = true;
    (this.particles.material as THREE.PointsMaterial).opacity = 0.6;

    for (let i = 0; i < this.lifetimes.length; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      pos.setXYZ(i, x, y + 0.05, z);
      this.velocities[i * 3] = Math.cos(angle) * speed;
      this.velocities[i * 3 + 1] = 0.5 + Math.random() * 1.5;
      this.velocities[i * 3 + 2] = Math.sin(angle) * speed;
      this.lifetimes[i] = 0;
      this.maxLifetime[i] = 0.4 + Math.random() * 0.3;
    }
    pos.needsUpdate = true;
  }

  update(dt: number) {
    if (!this.alive) return;
    const pos = (this.particles.geometry.attributes.position as THREE.BufferAttribute);
    let allDead = true;

    for (let i = 0; i < this.lifetimes.length; i++) {
      this.lifetimes[i] += dt;
      if (this.lifetimes[i] >= this.maxLifetime[i]) continue;
      allDead = false;
      const t = this.lifetimes[i] / this.maxLifetime[i];
      pos.setXYZ(i,
        pos.getX(i) + this.velocities[i * 3] * dt,
        pos.getY(i) + this.velocities[i * 3 + 1] * dt,
        pos.getZ(i) + this.velocities[i * 3 + 2] * dt,
      );
      this.velocities[i * 3 + 1] -= 4 * dt; // gravity
    }
    pos.needsUpdate = true;
    (this.particles.material as THREE.PointsMaterial).opacity = 0.6 * (1 - this.lifetimes[0] / this.maxLifetime[0]);

    if (allDead) this.alive = false;
  }
}

// Water splash on entering water
export class WaterSplash {
  particles: THREE.Points;
  private velocities: Float32Array;
  private lifetimes: Float32Array;
  private maxLifetime: Float32Array;
  alive = false;

  constructor() {
    const count = 15;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.lifetimes = new Float32Array(count);
    this.maxLifetime = new Float32Array(count);

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x8BD4F0,
      size: 0.12,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geo, mat);
  }

  trigger(x: number, y: number, z: number) {
    const pos = (this.particles.geometry.attributes.position as THREE.BufferAttribute);
    this.alive = true;
    (this.particles.material as THREE.PointsMaterial).opacity = 0.7;

    for (let i = 0; i < this.lifetimes.length; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2;
      pos.setXYZ(i, x, y + 0.1, z);
      this.velocities[i * 3] = Math.cos(angle) * speed;
      this.velocities[i * 3 + 1] = 2 + Math.random() * 3;
      this.velocities[i * 3 + 2] = Math.sin(angle) * speed;
      this.lifetimes[i] = 0;
      this.maxLifetime[i] = 0.5 + Math.random() * 0.3;
    }
    pos.needsUpdate = true;
  }

  update(dt: number) {
    if (!this.alive) return;
    const pos = (this.particles.geometry.attributes.position as THREE.BufferAttribute);
    let allDead = true;

    for (let i = 0; i < this.lifetimes.length; i++) {
      this.lifetimes[i] += dt;
      if (this.lifetimes[i] >= this.maxLifetime[i]) continue;
      allDead = false;
      pos.setXYZ(i,
        pos.getX(i) + this.velocities[i * 3] * dt,
        pos.getY(i) + this.velocities[i * 3 + 1] * dt,
        pos.getZ(i) + this.velocities[i * 3 + 2] * dt,
      );
      this.velocities[i * 3 + 1] -= 6 * dt;
    }
    pos.needsUpdate = true;
    (this.particles.material as THREE.PointsMaterial).opacity = 0.7 * Math.max(0, 1 - this.lifetimes[0] / this.maxLifetime[0]);

    if (allDead) this.alive = false;
  }
}

// Fountain spray particles (continuous)
export class FountainSpray {
  particles: THREE.Points;
  private velocities: Float32Array;
  private ages: Float32Array;
  private maxAge: Float32Array;
  private basePositions: THREE.BufferAttribute;

  constructor(x: number, z: number) {
    const count = 40;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.ages = new Float32Array(count);
    this.maxAge = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      this.resetParticle(i, positions, x, z);
    }

    this.basePositions = new THREE.BufferAttribute(positions, 3);
    geo.setAttribute('position', this.basePositions);

    const mat = new THREE.PointsMaterial({
      color: 0xB0E0FF,
      size: 0.08,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geo, mat);
    this.particles.position.set(x, 0, z);
  }

  private resetParticle(i: number, positions: Float32Array, _x: number, _z: number) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.5;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = 1.8; // top of fountain
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    this.velocities[i * 3] = Math.cos(angle) * (0.5 + Math.random());
    this.velocities[i * 3 + 1] = 2 + Math.random() * 2;
    this.velocities[i * 3 + 2] = Math.sin(angle) * (0.5 + Math.random());
    this.ages[i] = Math.random() * 1.5; // stagger
    this.maxAge[i] = 1 + Math.random() * 0.5;
  }

  update(dt: number, playerPos?: THREE.Vector3) {
    const pos = this.basePositions.array as Float32Array;
    const count = this.ages.length;

    // Distance-based intensity factor: 1.0 near fountain, 0.2 far away
    let distanceFactor = 0.6; // default when no player pos provided
    if (playerPos) {
      const dist = Math.sqrt(playerPos.x * playerPos.x + playerPos.z * playerPos.z);
      if (dist < 10) {
        distanceFactor = 1.0;
      } else if (dist > 20) {
        distanceFactor = 0.2;
      } else {
        distanceFactor = 1.0 - ((dist - 10) / 10) * 0.8;
      }
    }

    // Scale material opacity and size with distance
    const mat = this.particles.material as THREE.PointsMaterial;
    mat.opacity = 0.2 + distanceFactor * 0.5;
    mat.size = 0.04 + distanceFactor * 0.08;

    // Visible particle count scales with distance
    const visibleCount = Math.floor(count * (0.3 + distanceFactor * 0.7));

    for (let i = 0; i < count; i++) {
      if (i >= visibleCount) {
        // Hide particles beyond visible count offscreen
        pos[i * 3 + 1] = -100;
        this.ages[i] = this.maxAge[i]; // mark for reset when they come back
        continue;
      }

      this.ages[i] += dt;
      if (this.ages[i] >= this.maxAge[i]) {
        this.resetParticle(i, pos, 0, 0);
        // Scale initial velocity by distance factor
        this.velocities[i * 3] *= distanceFactor;
        this.velocities[i * 3 + 1] *= (0.5 + distanceFactor * 0.5);
        this.velocities[i * 3 + 2] *= distanceFactor;
        continue;
      }
      pos[i * 3] += this.velocities[i * 3] * dt;
      pos[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      pos[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      this.velocities[i * 3 + 1] -= 3 * dt; // gravity
    }
    this.basePositions.needsUpdate = true;
  }
}

// Golden egg collection burst
export class GoldenBurst {
  particles: THREE.Points;
  private velocities: Float32Array;
  private lifetimes: Float32Array;
  private maxLifetime: Float32Array;
  alive = false;

  constructor() {
    const count = 30;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.lifetimes = new Float32Array(count);
    this.maxLifetime = new Float32Array(count);

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xFFD700,
      size: 0.2,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geo, mat);
  }

  trigger(x: number, y: number, z: number) {
    const pos = (this.particles.geometry.attributes.position as THREE.BufferAttribute);
    this.alive = true;
    (this.particles.material as THREE.PointsMaterial).opacity = 1;

    for (let i = 0; i < this.lifetimes.length; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 3 + Math.random() * 4;
      pos.setXYZ(i, x, y, z);
      this.velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      this.velocities[i * 3 + 1] = Math.cos(phi) * speed;
      this.velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
      this.lifetimes[i] = 0;
      this.maxLifetime[i] = 0.6 + Math.random() * 0.4;
    }
    pos.needsUpdate = true;
  }

  update(dt: number) {
    if (!this.alive) return;
    const pos = (this.particles.geometry.attributes.position as THREE.BufferAttribute);
    let allDead = true;

    for (let i = 0; i < this.lifetimes.length; i++) {
      this.lifetimes[i] += dt;
      if (this.lifetimes[i] >= this.maxLifetime[i]) continue;
      allDead = false;
      pos.setXYZ(i,
        pos.getX(i) + this.velocities[i * 3] * dt,
        pos.getY(i) + this.velocities[i * 3 + 1] * dt,
        pos.getZ(i) + this.velocities[i * 3 + 2] * dt,
      );
      this.velocities[i * 3 + 1] -= 5 * dt;
    }
    pos.needsUpdate = true;
    (this.particles.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - this.lifetimes[0] / this.maxLifetime[0]);

    if (allDead) this.alive = false;
  }
}
