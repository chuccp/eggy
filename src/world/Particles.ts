import * as THREE from 'three';
import { toonMat } from '../utils/colors';
import { seededRandom } from '../utils/math';

// ==================== M5: Chimney Smoke ====================

interface SmokeEmitter {
  particles: THREE.Points;
  velocities: Float32Array;
  ages: Float32Array;
  maxAge: Float32Array;
  positions: THREE.BufferAttribute;
  baseX: number;
  baseY: number;
  baseZ: number;
}

export class ChimneySmoke {
  private emitters: SmokeEmitter[] = [];

  /** Pass world-space chimney top positions (x, y, z) */
  constructor(chimneyTops: { wx: number; wy: number; wz: number }[]) {
    for (const h of chimneyTops) {
      this.emitters.push(this.createEmitter(h.wx, h.wy, h.wz));
    }
  }

  private createEmitter(x: number, y: number, z: number): SmokeEmitter {
    const count = 20;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const ages = new Float32Array(count);
    const maxAge = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = x;
      positions[i * 3 + 1] = -100; // off-screen initially
      positions[i * 3 + 2] = z;
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;
      ages[i] = (i / count) * 2.5; // stagger initial ages
      maxAge[i] = 2 + Math.random() * 1.5;
    }

    const attr = new THREE.BufferAttribute(positions, 3);
    geo.setAttribute('position', attr);

    const mat = new THREE.PointsMaterial({
      color: 0x999999,
      size: 0.3,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });

    const particles = new THREE.Points(geo, mat);
    particles.frustumCulled = false;

    return { particles, velocities, ages, maxAge, positions: attr, baseX: x, baseY: y, baseZ: z };
  }

  update(dt: number) {
    for (const em of this.emitters) {
      for (let i = 0; i < em.ages.length; i++) {
        em.ages[i] += dt;
        if (em.ages[i] >= em.maxAge[i]) {
          // Respawn at chimney top
          em.ages[i] = 0;
          em.maxAge[i] = 2 + Math.random() * 1.5;
          const posArr = em.positions.array as Float32Array;
          posArr[i * 3] = em.baseX + (Math.random() - 0.5) * 0.2;
          posArr[i * 3 + 1] = em.baseY;
          posArr[i * 3 + 2] = em.baseZ + (Math.random() - 0.5) * 0.2;
          // Upward with slight random horizontal drift
          em.velocities[i * 3] = (Math.random() - 0.5) * 0.3;
          em.velocities[i * 3 + 1] = 1.0 + Math.random() * 0.5;
          em.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
          continue;
        }
        const posArr = em.positions.array as Float32Array;
        // Horizontal sway using sine
        const swayX = Math.sin(em.ages[i] * 2 + i) * 0.15 * dt;
        const swayZ = Math.cos(em.ages[i] * 1.7 + i * 0.7) * 0.15 * dt;
        posArr[i * 3] += em.velocities[i * 3] * dt + swayX;
        posArr[i * 3 + 1] += em.velocities[i * 3 + 1] * dt;
        posArr[i * 3 + 2] += em.velocities[i * 3 + 2] * dt + swayZ;
      }
      em.positions.needsUpdate = true;

      // Fade & shrink based on oldest particle's progress
      const t = em.ages[0] / em.maxAge[0];
      const mat = em.particles.material as THREE.PointsMaterial;
      mat.opacity = 0.35 * (1 - t);
      mat.size = 0.3 * (1 - t * 0.6);
    }
  }

  addToScene(scene: THREE.Scene) {
    for (const em of this.emitters) {
      scene.add(em.particles);
    }
  }
}

// ==================== M6: Butterfly Particles ====================

interface ButterflyState {
  group: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  // Bezier flight path
  startPos: THREE.Vector3;
  controlA: THREE.Vector3;
  controlB: THREE.Vector3;
  endPos: THREE.Vector3;
  t: number;          // progress along bezier [0,1]
  speed: number;      // how fast t advances
  baseY: number;      // base flight height
  flapSpeed: number;
  // Scatter state
  scattered: boolean;
  scatterTimer: number;
  scatterDir: THREE.Vector3;
}

export class ButterflyManager {
  private butterflies: ButterflyState[] = [];
  private sceneGroup: THREE.Group;
  private rng: () => number;

  private BUTTERFLY_COLORS = [0xFF69B4, 0xFFE66D, 0x87CEEB, 0xDA70D6]; // pink, yellow, blue, purple
  private FLOWER_AREA_MIN = new THREE.Vector3(20, 0, 20);
  private FLOWER_AREA_MAX = new THREE.Vector3(40, 0, 40);
  private SCATTER_DISTANCE = 5;
  private SCATTER_DURATION = 2;

  constructor(getHeight: (x: number, z: number) => number) {
    this.sceneGroup = new THREE.Group();
    this.rng = seededRandom(12345);

    for (let i = 0; i < 18; i++) {
      const b = this.createButterfly(i, getHeight);
      this.butterflies.push(b);
      this.sceneGroup.add(b.group);
    }
  }

  private createButterfly(index: number, getHeight: (x: number, z: number) => number): ButterflyState {
    const color = this.BUTTERFLY_COLORS[index % this.BUTTERFLY_COLORS.length];
    const group = new THREE.Group();

    // Wings - two small planes
    const wingGeo = new THREE.PlaneGeometry(0.25, 0.15);

    const leftWing = new THREE.Mesh(wingGeo, toonMat(color, { side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
    leftWing.position.set(0.12, 0, 0);
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, toonMat(color, { side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
    rightWing.position.set(-0.12, 0, 0);
    group.add(rightWing);

    // Body - tiny sphere
    const bodyGeo = new THREE.SphereGeometry(0.03, 4, 4);
    const body = new THREE.Mesh(bodyGeo, toonMat(0x333333));
    group.add(body);

    // Pick random start position in flower field
    const startX = this.FLOWER_AREA_MIN.x + this.rng() * (this.FLOWER_AREA_MAX.x - this.FLOWER_AREA_MIN.x);
    const startZ = this.FLOWER_AREA_MIN.z + this.rng() * (this.FLOWER_AREA_MAX.z - this.FLOWER_AREA_MIN.z);
    const baseY = getHeight(startX, startZ) + 1.0 + this.rng() * 2.0;
    group.position.set(startX, baseY, startZ);

    // Initial bezier path
    const startPos = new THREE.Vector3(startX, baseY, startZ);
    const endPos = this.randomWaypoint(baseY);
    const controlA = this.randomControl(startPos, baseY);
    const controlB = this.randomControl(endPos, baseY);

    return {
      group, leftWing, rightWing,
      startPos, controlA, controlB, endPos,
      t: this.rng(), // start at random point along path
      speed: 0.08 + this.rng() * 0.12,
      baseY,
      flapSpeed: 8 + this.rng() * 6,
      scattered: false,
      scatterTimer: 0,
      scatterDir: new THREE.Vector3(),
    };
  }

  private randomWaypoint(baseY: number): THREE.Vector3 {
    const x = this.FLOWER_AREA_MIN.x + this.rng() * (this.FLOWER_AREA_MAX.x - this.FLOWER_AREA_MIN.x);
    const z = this.FLOWER_AREA_MIN.z + this.rng() * (this.FLOWER_AREA_MAX.z - this.FLOWER_AREA_MIN.z);
    const y = baseY + (this.rng() - 0.5) * 2;
    return new THREE.Vector3(x, y, z);
  }

  private randomControl(anchor: THREE.Vector3, baseY: number): THREE.Vector3 {
    return new THREE.Vector3(
      anchor.x + (this.rng() - 0.5) * 10,
      baseY + (this.rng() - 0.5) * 3,
      anchor.z + (this.rng() - 0.5) * 10,
    );
  }

  /** Cubic bezier interpolation */
  private bezier(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number): THREE.Vector3 {
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    return new THREE.Vector3(
      mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
      mt3 * p0.z + 3 * mt2 * t * p1.z + 3 * mt * t2 * p2.z + t3 * p3.z,
    );
  }

  update(dt: number, playerPos?: THREE.Vector3) {
    const time = performance.now() * 0.001;

    for (const b of this.butterflies) {
      // Wing flap animation
      const flapAngle = Math.sin(time * b.flapSpeed) * 1.2;
      b.leftWing.rotation.y = flapAngle;
      b.rightWing.rotation.y = -flapAngle;

      if (b.scattered) {
        // Scattered: fly away quickly
        b.scatterTimer -= dt;
        b.group.position.addScaledVector(b.scatterDir, dt * 8);
        b.group.position.y += dt * 2; // rise while scattering

        if (b.scatterTimer <= 0) {
          // Return: pick new bezier from current pos to a flower field waypoint
          b.scattered = false;
          b.startPos.copy(b.group.position);
          b.endPos = this.randomWaypoint(b.baseY);
          b.controlA = this.randomControl(b.startPos, b.baseY);
          b.controlB = this.randomControl(b.endPos, b.baseY);
          b.t = 0;
        }
      } else {
        // Normal bezier flight
        b.t += b.speed * dt;
        if (b.t >= 1) {
          // Pick new path
          b.startPos.copy(b.endPos);
          b.endPos = this.randomWaypoint(b.baseY);
          b.controlA = this.randomControl(b.startPos, b.baseY);
          b.controlB = this.randomControl(b.endPos, b.baseY);
          b.t -= 1;
        }

        const pos = this.bezier(b.startPos, b.controlA, b.controlB, b.endPos, b.t);
        // Gentle bob
        pos.y += Math.sin(time * 1.5 + b.baseY * 3) * 0.3;
        b.group.position.copy(pos);

        // Face direction of travel
        const nextPos = this.bezier(b.startPos, b.controlA, b.controlB, b.endPos, Math.min(b.t + 0.02, 1));
        b.group.lookAt(nextPos);

        // Check player proximity for scatter
        if (playerPos) {
          const dist = b.group.position.distanceTo(playerPos);
          if (dist < this.SCATTER_DISTANCE) {
            b.scattered = true;
            b.scatterTimer = this.SCATTER_DURATION;
            // Scatter direction: away from player, horizontal
            b.scatterDir.set(
              b.group.position.x - playerPos.x,
              0,
              b.group.position.z - playerPos.z,
            ).normalize();
          }
        }
      }
    }
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.sceneGroup);
  }
}

// ==================== M7: Falling Leaves ====================

interface LeafParticle {
  mesh: THREE.Mesh;
  baseX: number;
  baseY: number;
  baseZ: number;
  age: number;
  maxAge: number;
  driftX: number;
  driftZ: number;
  rotSpeed: number;
  swayPhase: number;
  swayFreq: number;
}

export class FallingLeaves {
  private leaves: LeafParticle[] = [];
  private sceneGroup: THREE.Group;
  private centerX: number;
  private centerZ: number;
  private spawnRadius: number;

  private LEAF_COLORS = [0xFF8C00, 0xCD853F, 0x8B4513, 0x228B22, 0x6B8E23, 0xDAA520, 0x556B2F];

  constructor(getHeight: (x: number, z: number) => number, centerX = -25, centerZ = 0, spawnRadius = 15) {
    this.sceneGroup = new THREE.Group();
    this.centerX = centerX;
    this.centerZ = centerZ;
    this.spawnRadius = spawnRadius;

    const rng = seededRandom(54321);

    for (let i = 0; i < 30; i++) {
      const leaf = this.createLeaf(rng, getHeight);
      // Stagger initial ages so they don't all appear at once
      leaf.age = rng() * leaf.maxAge;
      this.leaves.push(leaf);
      this.sceneGroup.add(leaf.mesh);
    }
  }

  private createLeaf(rng: () => number, getHeight: (x: number, z: number) => number): LeafParticle {
    const x = this.centerX + (rng() - 0.5) * this.spawnRadius * 2;
    const z = this.centerZ + (rng() - 0.5) * this.spawnRadius * 2;
    const startY = getHeight(x, z) + 5 + rng() * 8;

    // Small flat rectangle as leaf shape
    const geo = new THREE.PlaneGeometry(0.15 + rng() * 0.1, 0.1 + rng() * 0.05);
    const color = this.LEAF_COLORS[Math.floor(rng() * this.LEAF_COLORS.length)];
    const mat = toonMat(color, { side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, startY, z);
    mesh.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);

    return {
      mesh,
      baseX: x,
      baseZ: z,
      baseY: startY,
      age: 0,
      maxAge: 4 + rng() * 4,
      driftX: (rng() - 0.5) * 1.5,
      driftZ: (rng() - 0.5) * 1.5,
      rotSpeed: 0.5 + rng() * 2,
      swayPhase: rng() * Math.PI * 2,
      swayFreq: 1 + rng() * 2,
    };
  }

  update(dt: number) {
    const time = performance.now() * 0.001;

    for (const leaf of this.leaves) {
      leaf.age += dt;

      if (leaf.age >= leaf.maxAge) {
        // Respawn at top
        leaf.age = 0;
        leaf.maxAge = 4 + Math.random() * 4;
        leaf.baseX = this.centerX + (Math.random() - 0.5) * this.spawnRadius * 2;
        leaf.baseZ = this.centerZ + (Math.random() - 0.5) * this.spawnRadius * 2;
        leaf.mesh.position.x = leaf.baseX;
        leaf.mesh.position.z = leaf.baseZ;
        leaf.mesh.position.y = leaf.baseY;
        leaf.driftX = (Math.random() - 0.5) * 1.5;
        leaf.driftZ = (Math.random() - 0.5) * 1.5;
        leaf.swayPhase = Math.random() * Math.PI * 2;
      }

      // Descent
      const fallSpeed = 1.5;
      leaf.mesh.position.y -= fallSpeed * dt;

      // Horizontal sway + drift
      const swayX = Math.sin(time * leaf.swayFreq + leaf.swayPhase) * 0.5;
      const swayZ = Math.cos(time * leaf.swayFreq * 0.8 + leaf.swayPhase) * 0.3;
      leaf.mesh.position.x += (leaf.driftX * 0.3 + swayX) * dt;
      leaf.mesh.position.z += (leaf.driftZ * 0.3 + swayZ) * dt;

      // Slow rotation
      leaf.mesh.rotation.x += leaf.rotSpeed * 0.3 * dt;
      leaf.mesh.rotation.y += leaf.rotSpeed * 0.5 * dt;
      leaf.mesh.rotation.z += leaf.rotSpeed * 0.2 * dt;

      // Fade as it nears the ground (last 20% of life)
      const lifeRatio = leaf.age / leaf.maxAge;
      const mat = leaf.mesh.material as THREE.MeshToonMaterial;
      if (lifeRatio > 0.8) {
        mat.opacity = 0.9 * (1 - (lifeRatio - 0.8) / 0.2);
      } else {
        mat.opacity = 0.9;
      }
    }
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.sceneGroup);
  }
}
