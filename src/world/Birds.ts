import * as THREE from 'three';
import { toonMat } from '../utils/colors';
import { seededRandom } from '../utils/math';

// ===================== Bird species definitions =====================

interface BirdSpecies {
  name: string;
  bodyColor: number;
  wingColor: number;
  bellyColor?: number;
  bodyLength: number;  // Scale factor
  wingSpan: number;
  flapSpeed: number;   // Flaps per second
  flapAmplitude: number;
  speed: number;       // Flight speed
  turnSpeed: number;
  soarRatio: number;   // 0 = always flapping, 1 = always gliding
  tailType: 'normal' | 'forked' | 'fan' | 'long';
  crestColor?: number; // For birds with head crests
}

const SPECIES: BirdSpecies[] = [
  {
    name: '麻雀', bodyColor: 0x8B6914, wingColor: 0x6B4914, bellyColor: 0xD2B48C,
    bodyLength: 0.35, wingSpan: 0.6, flapSpeed: 8, flapAmplitude: 0.5,
    speed: 6, turnSpeed: 3, soarRatio: 0.05, tailType: 'normal',
  },
  {
    name: '燕子', bodyColor: 0x1A1A3E, wingColor: 0x2A2A5E, bellyColor: 0xE8E8E8,
    bodyLength: 0.4, wingSpan: 0.7, flapSpeed: 6, flapAmplitude: 0.6,
    speed: 10, turnSpeed: 4, soarRatio: 0.15, tailType: 'forked',
  },
  {
    name: '鸽子', bodyColor: 0x888899, wingColor: 0x777788, bellyColor: 0xCCCCDD,
    bodyLength: 0.5, wingSpan: 0.9, flapSpeed: 4, flapAmplitude: 0.45,
    speed: 5, turnSpeed: 1.5, soarRatio: 0.3, tailType: 'fan',
  },
  {
    name: '鹦鹉', bodyColor: 0x22AA22, wingColor: 0xEE3333, bellyColor: 0xFFEE44,
    bodyLength: 0.45, wingSpan: 0.8, flapSpeed: 5, flapAmplitude: 0.5,
    speed: 6, turnSpeed: 2.5, soarRatio: 0.1, tailType: 'long', crestColor: 0xFF4444,
  },
  {
    name: '蜂鸟', bodyColor: 0x00CC88, wingColor: 0x88DDCC, bellyColor: 0xAAFFDD,
    bodyLength: 0.15, wingSpan: 0.3, flapSpeed: 20, flapAmplitude: 0.7,
    speed: 3, turnSpeed: 5, soarRatio: 0, tailType: 'normal',
  },
  {
    name: '老鹰', bodyColor: 0x5C3317, wingColor: 0x3E2210, bellyColor: 0xD2B48C,
    bodyLength: 0.8, wingSpan: 1.8, flapSpeed: 2, flapAmplitude: 0.3,
    speed: 7, turnSpeed: 0.8, soarRatio: 0.7, tailType: 'fan',
  },
  {
    name: '火烈鸟', bodyColor: 0xFF69B4, wingColor: 0xFF1493, bellyColor: 0xFFB6C1,
    bodyLength: 0.6, wingSpan: 1.0, flapSpeed: 3, flapAmplitude: 0.35,
    speed: 4, turnSpeed: 1, soarRatio: 0.4, tailType: 'normal',
  },
  {
    name: '蓝鹊', bodyColor: 0x4169E1, wingColor: 0x1E90FF, bellyColor: 0xFFFFFF,
    bodyLength: 0.5, wingSpan: 0.85, flapSpeed: 5, flapAmplitude: 0.5,
    speed: 7, turnSpeed: 2, soarRatio: 0.2, tailType: 'long',
  },
];

// ===================== Single bird =====================

class Bird {
  group: THREE.Group;
  private leftWing: THREE.Mesh;
  private rightWing: THREE.Mesh;
  private tail: THREE.Mesh;

  // Flight state
  private angle: number;
  private radius: number;
  private height: number;
  private centerX: number;
  private centerZ: number;
  private speed: number;
  private phase: number;
  private flapPhase: number;
  private species: BirdSpecies;

  // Wobble for natural flight
  private wobbleX = 0;
  private wobbleZ = 0;
  private wobbleTimer = 0;

  constructor(species: BirdSpecies, centerX: number, centerZ: number, height: number, radius: number, angle: number) {
    this.species = species;
    this.centerX = centerX;
    this.centerZ = centerZ;
    this.height = height;
    this.radius = radius;
    this.angle = angle;
    this.speed = species.speed / radius; // Angular speed
    this.phase = Math.random() * Math.PI * 2;
    this.flapPhase = Math.random() * Math.PI * 2;

    this.group = new THREE.Group();

    const s = species.bodyLength;
    const bodyMat = toonMat(species.bodyColor);
    const wingMat = toonMat(species.wingColor);
    const bellyMat = toonMat(species.bellyColor ?? species.bodyColor);

    // Body (elongated sphere)
    const bodyGeo = new THREE.SphereGeometry(s * 0.4, 8, 6);
    bodyGeo.scale(1.5, 0.8, 0.8);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    this.group.add(body);

    // Belly (slightly lighter underside)
    const bellyGeo = new THREE.SphereGeometry(s * 0.35, 8, 4);
    bellyGeo.scale(1.2, 0.5, 0.7);
    const belly = new THREE.Mesh(bellyGeo, bellyMat);
    belly.position.y = -s * 0.05;
    this.group.add(belly);

    // Head
    const headGeo = new THREE.SphereGeometry(s * 0.25, 8, 6);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(s * 0.5, s * 0.1, 0);
    this.group.add(head);

    // Eye
    const eyeGeo = new THREE.SphereGeometry(s * 0.05, 6, 4);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(s * 0.6, s * 0.15, -s * 0.15);
    this.group.add(eyeL);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(s * 0.6, s * 0.15, s * 0.15);
    this.group.add(eyeR);

    // Beak
    const beakGeo = new THREE.ConeGeometry(s * 0.06, s * 0.2, 4);
    beakGeo.rotateX(Math.PI / 2);
    const beakMat = toonMat(0xFFAA00);
    const beak = new THREE.Mesh(beakGeo, beakMat);
    beak.position.set(s * 0.7, s * 0.08, 0);
    this.group.add(beak);

    // Wings
    const wingGeo = new THREE.BufferGeometry();
    const wingW = species.wingSpan * 0.5;
    const wingH = s * 0.6;
    const wingVerts = new Float32Array([
      0, 0, 0,
      -wingW, 0, -wingH * 0.3,
      -wingW * 0.6, 0, wingH * 0.2,
      0, 0, 0,
      -wingW * 0.6, 0, wingH * 0.2,
      -wingW * 0.3, 0, wingH * 0.5,
    ]);
    wingGeo.setAttribute('position', new THREE.BufferAttribute(wingVerts, 3));
    wingGeo.computeVertexNormals();

    this.leftWing = new THREE.Mesh(wingGeo, wingMat);
    this.leftWing.position.set(-s * 0.1, s * 0.05, 0);
    this.group.add(this.leftWing);

    this.rightWing = new THREE.Mesh(wingGeo, wingMat);
    this.rightWing.position.set(-s * 0.1, s * 0.05, 0);
    this.rightWing.scale.z = -1; // Mirror
    this.group.add(this.rightWing);

    // Tail
    const tailGeo = new THREE.BufferGeometry();
    let tailVerts: Float32Array;
    switch (species.tailType) {
      case 'forked':
        tailVerts = new Float32Array([
          0, 0, 0, -s * 0.5, 0, -s * 0.15, -s * 0.4, 0, 0,
          0, 0, 0, -s * 0.4, 0, 0, -s * 0.5, 0, s * 0.15,
        ]);
        break;
      case 'fan':
        tailVerts = new Float32Array([
          0, 0, 0, -s * 0.5, 0, -s * 0.2, -s * 0.5, 0, s * 0.2,
        ]);
        break;
      case 'long':
        tailVerts = new Float32Array([
          0, 0, 0, -s * 0.8, 0, -s * 0.05, -s * 0.8, 0, s * 0.05,
          0, 0, 0, -s * 0.7, s * 0.05, 0, -s * 0.8, 0, 0,
        ]);
        break;
      default:
        tailVerts = new Float32Array([
          0, 0, 0, -s * 0.4, 0, -s * 0.1, -s * 0.4, 0, s * 0.1,
        ]);
    }
    tailGeo.setAttribute('position', new THREE.BufferAttribute(tailVerts, 3));
    tailGeo.computeVertexNormals();
    this.tail = new THREE.Mesh(tailGeo, toonMat(species.wingColor, { side: THREE.DoubleSide }));
    this.tail.position.set(-s * 0.5, 0, 0);
    this.group.add(this.tail);

    // Crest (for parrots etc.)
    if (species.crestColor) {
      const crestGeo = new THREE.ConeGeometry(s * 0.08, s * 0.2, 4);
      const crest = new THREE.Mesh(crestGeo, toonMat(species.crestColor));
      crest.position.set(s * 0.45, s * 0.3, 0);
      this.group.add(crest);
    }

    // Position
    this.updatePosition(0);
  }

  update(dt: number, time: number) {
    // Advance along circular path
    this.angle += this.speed * dt;

    // Natural wobble
    this.wobbleTimer += dt;
    if (this.wobbleTimer > 2 + Math.random() * 3) {
      this.wobbleTimer = 0;
      this.wobbleX = (Math.random() - 0.5) * 2;
      this.wobbleZ = (Math.random() - 0.5) * 2;
    }

    this.updatePosition(time);

    // Flapping animation
    const isSoaring = Math.sin(time * 0.3 + this.phase) < -(1 - this.species.soarRatio * 2);
    if (isSoaring) {
      // Gliding - wings spread
      this.leftWing.rotation.x = 0;
      this.rightWing.rotation.x = 0;
    } else {
      // Flapping
      this.flapPhase += dt * this.species.flapSpeed * Math.PI * 2;
      const flap = Math.sin(this.flapPhase) * this.species.flapAmplitude;
      this.leftWing.rotation.x = flap;
      this.rightWing.rotation.x = -flap;
    }

    // Subtle body tilt during turns
    const turnRate = this.speed;
    this.group.rotation.z = Math.sin(this.angle) * turnRate * 0.1;
  }

  private updatePosition(time: number) {
    const wobbleXSmooth = Math.sin(time * 0.5 + this.phase) * this.wobbleX * 0.5;
    const wobbleZSmooth = Math.cos(time * 0.4 + this.phase * 1.3) * this.wobbleZ * 0.5;

    const x = this.centerX + Math.cos(this.angle) * this.radius + wobbleXSmooth;
    const z = this.centerZ + Math.sin(this.angle) * this.radius + wobbleZSmooth;
    const y = this.height + Math.sin(time * 0.8 + this.phase) * 1.0; // Gentle vertical bob

    this.group.position.set(x, y, z);

    // Face direction of travel
    const nextAngle = this.angle + 0.01;
    const nx = this.centerX + Math.cos(nextAngle) * this.radius;
    const nz = this.centerZ + Math.sin(nextAngle) * this.radius;
    this.group.lookAt(nx, y, nz);
  }
}

// ===================== Flock manager =====================

export class BirdManager {
  private birds: Bird[] = [];
  private sceneGroup: THREE.Group;

  constructor(getHeight: (x: number, z: number) => number) {
    this.sceneGroup = new THREE.Group();
    const rng = seededRandom(999);

    // Create flocks of different species at various locations
    const flocks: { species: BirdSpecies; count: number; cx: number; cz: number; minH: number; maxH: number; minR: number; maxR: number }[] = [
      // Sparrows near the center - small fast flock
      { species: SPECIES[0], count: 5, cx: 10, cz: 10, minH: 12, maxH: 18, minR: 8, maxR: 15 },
      { species: SPECIES[0], count: 4, cx: -15, cz: 5, minH: 10, maxH: 16, minR: 6, maxR: 12 },
      // Swallows - fast, high
      { species: SPECIES[1], count: 4, cx: 30, cz: -10, minH: 20, maxH: 30, minR: 15, maxR: 25 },
      { species: SPECIES[1], count: 3, cx: -25, cz: 25, minH: 18, maxH: 28, minR: 12, maxR: 20 },
      // Pigeons - medium, gentle
      { species: SPECIES[2], count: 3, cx: 0, cz: -15, minH: 8, maxH: 14, minR: 10, maxR: 18 },
      { species: SPECIES[2], count: 3, cx: 20, cz: 20, minH: 10, maxH: 16, minR: 8, maxR: 14 },
      // Parrots - colorful, playful
      { species: SPECIES[3], count: 3, cx: -30, cz: -15, minH: 15, maxH: 22, minR: 10, maxR: 18 },
      { species: SPECIES[3], count: 2, cx: 40, cz: 15, minH: 14, maxH: 20, minR: 8, maxR: 14 },
      // Hummingbird - tiny, near flowers
      { species: SPECIES[4], count: 2, cx: 5, cz: -5, minH: 3, maxH: 6, minR: 2, maxR: 5 },
      { species: SPECIES[4], count: 2, cx: -10, cz: 10, minH: 4, maxH: 7, minR: 2, maxR: 4 },
      // Eagle - large, soaring high
      { species: SPECIES[5], count: 2, cx: 0, cz: 0, minH: 35, maxH: 50, minR: 30, maxR: 50 },
      // Flamingo - graceful, medium height
      { species: SPECIES[6], count: 2, cx: -25, cz: -20, minH: 10, maxH: 15, minR: 12, maxR: 20 },
      // Blue magpie - colorful
      { species: SPECIES[7], count: 3, cx: 15, cz: -30, minH: 12, maxH: 20, minR: 10, maxR: 18 },
      { species: SPECIES[7], count: 2, cx: -40, cz: 10, minH: 14, maxH: 22, minR: 8, maxR: 15 },
    ];

    for (const flock of flocks) {
      for (let i = 0; i < flock.count; i++) {
        const h = flock.minH + rng() * (flock.maxH - flock.minH);
        const r = flock.minR + rng() * (flock.maxR - flock.minR);
        const angle = rng() * Math.PI * 2;
        const cx = flock.cx + (rng() - 0.5) * 10;
        const cz = flock.cz + (rng() - 0.5) * 10;

        const bird = new Bird(flock.species, cx, cz, h, r, angle);
        this.birds.push(bird);
        this.sceneGroup.add(bird.group);
      }
    }
  }

  update(dt: number) {
    const time = performance.now() * 0.001;
    for (const bird of this.birds) {
      bird.update(dt, time);
    }
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.sceneGroup);
  }
}
