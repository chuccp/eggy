import * as THREE from 'three';
import { toonMat } from '../utils/colors';
import { clamp, lerp, seededRandom } from '../utils/math';

// ===================== Species =====================
//
// Every pet is a four-legged cartoon built from primitives, in the same macaron
// style as the egg characters. One builder covers all of them: the species only
// picks ear / tail / muzzle shapes and colors.

export interface PetSpecies {
  name: string;
  bodyColor: number;
  bellyColor: number;
  /** 耳朵内侧、尾尖、鼻纹的颜色 */
  accentColor: number;
  ear: 'pointy' | 'floppy' | 'long' | 'none';
  tail: 'slim' | 'curl' | 'pom';
  muzzle: 'short' | 'long' | 'beak';
  /** Tail thickness multiplier — foxes get a big brush. */
  tailFluff: number;
  stripes: boolean;
  whiskers: boolean;
  /** Hop instead of a four-legged trot (rabbits, ducklings). */
  hop: boolean;
  scale: number;
  speed: number;
  /** Onomatopoeia shown in the speech bubble. */
  cry: string;
}

/** 主角的粉白猫：粉色虎斑、奶白肚皮和白袜子。 */
export const PLAYER_CAT: PetSpecies = {
  name: '小猫',
  bodyColor: 0xFFB3BA,
  bellyColor: 0xFFF5F1,
  accentColor: 0xFF7FA8,
  ear: 'pointy',
  tail: 'slim',
  muzzle: 'short',
  tailFluff: 1,
  stripes: true,
  whiskers: true,
  hop: false,
  scale: 1,
  speed: 4.2,
  cry: '喵~',
};

export const WILD_SPECIES: PetSpecies[] = [
  {
    name: '小三花', bodyColor: 0xFFF6E8, bellyColor: 0xFFFFFF, accentColor: 0xE8A45C,
    ear: 'pointy', tail: 'slim', muzzle: 'short', tailFluff: 1, stripes: false,
    whiskers: true, hop: false, scale: 0.95, speed: 3.8, cry: '喵呜~',
  },
  {
    name: '小柴犬', bodyColor: 0xE8A45C, bellyColor: 0xFFF5E1, accentColor: 0xFFF5E1,
    ear: 'floppy', tail: 'curl', muzzle: 'long', tailFluff: 1, stripes: false,
    whiskers: false, hop: false, scale: 1.15, speed: 4.6, cry: '汪！',
  },
  {
    name: '小白兔', bodyColor: 0xF4F1EC, bellyColor: 0xFFFFFF, accentColor: 0xFFB6C1,
    ear: 'long', tail: 'pom', muzzle: 'short', tailFluff: 1, stripes: false,
    whiskers: true, hop: true, scale: 0.9, speed: 3.4, cry: '咕咕',
  },
  {
    name: '小黄鸭', bodyColor: 0xFFE066, bellyColor: 0xFFF6C8, accentColor: 0xFFA500,
    ear: 'none', tail: 'pom', muzzle: 'beak', tailFluff: 1, stripes: false,
    whiskers: false, hop: true, scale: 0.85, speed: 3.0, cry: '嘎嘎',
  },
  {
    name: '小狐狸', bodyColor: 0xF08A3C, bellyColor: 0xFFF3E0, accentColor: 0xFFFFFF,
    ear: 'pointy', tail: 'curl', muzzle: 'long', tailFluff: 1.6, stripes: false,
    whiskers: true, hop: false, scale: 1.05, speed: 4.4, cry: '嘤嘤',
  },
];

export interface PetWater {
  center: THREE.Vector3;
  radius: number;
}

export interface PetContext {
  playerPos: THREE.Vector3;
  playerOnGround: boolean;
  /** How long the player has been standing still, in seconds. */
  playerIdleTime: number;
}

export interface PetRig {
  /** Everything above the hips — pitches when sitting, never carries the legs. */
  bodyGroup: THREE.Group;
  head: THREE.Group;
  /** Front left, front right, rear left, rear right. */
  legs: THREE.Group[];
  tailRoot: THREE.Group;
  ears: THREE.Group[];
  eyes: THREE.Group[];
}

const HIP_Y = 0.24;
const FRONT_Z = -0.16;
const REAR_Z = 0.18;
const LEG_X = 0.105;
const NOSE_COLOR = 0xFF9BAA;
const EYE_COLOR = 0x2A2320;

// ===================== Mesh builder =====================

function buildEar(species: PetSpecies, side: number): THREE.Group {
  const ear = new THREE.Group();
  const outerMat = toonMat(species.bodyColor);
  const innerMat = toonMat(species.accentColor);

  if (species.ear === 'pointy') {
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.17, 5), outerMat);
    outer.position.y = 0.07;
    outer.rotation.z = -side * 0.22;
    outer.castShadow = true;
    ear.add(outer);

    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.1, 5), innerMat);
    inner.position.set(0, 0.06, -0.028);
    inner.rotation.z = -side * 0.22;
    ear.add(inner);
  } else if (species.ear === 'floppy') {
    const outerGeo = new THREE.SphereGeometry(0.078, 10, 8);
    outerGeo.scale(0.55, 1.25, 0.5);
    const outer = new THREE.Mesh(outerGeo, outerMat);
    // 垂在头两侧的外面，不然会整个陷进头里
    outer.position.set(side * 0.035, -0.075, 0);
    outer.rotation.z = side * 0.45;
    outer.castShadow = true;
    ear.add(outer);
  } else {
    const outerGeo = new THREE.CylinderGeometry(0.038, 0.05, 0.32, 8);
    outerGeo.scale(0.75, 1, 0.55);
    const outer = new THREE.Mesh(outerGeo, outerMat);
    outer.position.y = 0.15;
    outer.rotation.z = -side * 0.12;
    outer.castShadow = true;
    ear.add(outer);

    const innerGeo = new THREE.CylinderGeometry(0.022, 0.03, 0.24, 8);
    innerGeo.scale(0.75, 1, 0.55);
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.set(0, 0.14, -0.022);
    inner.rotation.z = -side * 0.12;
    ear.add(inner);
  }

  return ear;
}

function buildLeg(species: PetSpecies): THREE.Group {
  const leg = new THREE.Group();

  const thigh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.042, 0.2, 8),
    toonMat(species.bodyColor),
  );
  thigh.position.y = -0.09;
  thigh.castShadow = true;
  leg.add(thigh);

  // White socks
  const pawGeo = new THREE.SphereGeometry(0.05, 8, 6);
  pawGeo.scale(1.05, 0.6, 1.3);
  const paw = new THREE.Mesh(pawGeo, toonMat(species.bellyColor));
  paw.position.set(0, -0.19, -0.015);
  paw.castShadow = true;
  leg.add(paw);

  return leg;
}

function buildTail(species: PetSpecies, root: THREE.Group) {
  if (species.tail === 'pom') {
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), toonMat(species.bellyColor));
    pom.position.set(0, 0.03, 0.07);
    pom.castShadow = true;
    root.add(pom);
    return;
  }

  const bodyMat = toonMat(species.bodyColor);
  const tipMat = toonMat(species.accentColor);

  // 相邻两节必须互相搭上，否则尾巴会断成一串球。
  const curve: [number, number][] = species.tail === 'curl'
    ? [[0.02, 0.02], [0.1, 0.03], [0.15, -0.01]]                    // 翘起来卷到背上
    : [[0.01, 0.04], [0.07, 0.1], [0.13, 0.15], [0.19, 0.19]];      // 细长尾巴，向上弯

  const maxRadius = 0.05 * species.tailFluff;
  for (let i = 0; i < curve.length; i++) {
    const t = i / (curve.length - 1);
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(maxRadius * (1 - 0.36 * t), 8, 6),
      i === curve.length - 1 ? tipMat : bodyMat,
    );
    seg.position.set(0, curve[i][0], curve[i][1]);
    seg.castShadow = true;
    root.add(seg);
  }
}

/**
 * Build one pet. The model faces -Z, matching `EggCharacter` and `NPC`, so
 * `rotation.y = Math.atan2(dx, dz) + Math.PI` points it at its heading.
 */
export function buildPetMesh(
  species: PetSpecies,
  opts: { collar?: number } = {},
): { group: THREE.Group; rig: PetRig } {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  const bodyMat = toonMat(species.bodyColor);
  const bellyMat = toonMat(species.bellyColor);

  // --- Torso ---
  const bodyGeo = new THREE.SphereGeometry(0.2, 14, 12);
  bodyGeo.scale(0.95, 0.9, 1.5);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.26;
  body.castShadow = true;
  bodyGroup.add(body);

  const bellyGeo = new THREE.SphereGeometry(0.16, 12, 10);
  bellyGeo.scale(0.88, 0.72, 1.35);
  const belly = new THREE.Mesh(bellyGeo, bellyMat);
  belly.position.set(0, 0.2, -0.02);
  bodyGroup.add(belly);

  if (species.stripes) {
    for (let i = 0; i < 3; i++) {
      const stripeGeo = new THREE.SphereGeometry(0.05, 8, 6);
      // 扁平而宽，贴着后背的弧面，只露出中间一点点
      stripeGeo.scale(1.9, 0.17, 0.5);
      const stripe = new THREE.Mesh(stripeGeo, toonMat(species.accentColor));
      stripe.position.set(0, 0.428, -0.07 + i * 0.08);
      bodyGroup.add(stripe);
    }
  }

  // --- Tail ---
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.3, 0.26);
  bodyGroup.add(tailRoot);
  buildTail(species, tailRoot);

  // --- Head ---
  const head = new THREE.Group();
  head.position.set(0, 0.45, -0.29);
  bodyGroup.add(head);

  const headGeo = new THREE.SphereGeometry(0.175, 14, 12);
  headGeo.scale(1.06, 0.98, 1.0);
  const headMesh = new THREE.Mesh(headGeo, bodyMat);
  headMesh.castShadow = true;
  head.add(headMesh);

  if (species.muzzle === 'beak') {
    const beakGeo = new THREE.ConeGeometry(0.055, 0.13, 6);
    beakGeo.scale(1, 1, 0.6);
    const beak = new THREE.Mesh(beakGeo, toonMat(species.accentColor));
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, -0.03, -0.19);
    head.add(beak);
  } else {
    const long = species.muzzle === 'long';
    const muzzleGeo = new THREE.SphereGeometry(0.08, 12, 10);
    muzzleGeo.scale(1.15, 0.85, long ? 1.35 : 0.95);
    const muzzle = new THREE.Mesh(muzzleGeo, bellyMat);
    muzzle.position.set(0, -0.04, long ? -0.155 : -0.135);
    head.add(muzzle);

    const noseGeo = new THREE.SphereGeometry(0.024, 8, 6);
    noseGeo.scale(1.2, 0.85, 0.8);
    const nose = new THREE.Mesh(noseGeo, toonMat(NOSE_COLOR));
    nose.position.set(0, -0.012, long ? -0.248 : -0.2);
    head.add(nose);

    // 小嘴：贴在口鼻球的前表面外侧，不然会被球面挡住
    const mouthShape = new THREE.Shape();
    mouthShape.moveTo(-0.026, 0);
    mouthShape.quadraticCurveTo(0, -0.02, 0.026, 0);
    const mouth = new THREE.Mesh(new THREE.ShapeGeometry(mouthShape), toonMat(0x8A5A3A));
    mouth.position.set(0, long ? -0.088 : -0.082, long ? -0.267 : -0.214);
    mouth.rotation.set(-0.2, Math.PI, 0);
    head.add(mouth);
  }

  // --- Eyes (groups so blinking can squash them) ---
  const eyes: THREE.Group[] = [];
  const highlightMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.077, 0.032, -0.142);

    const ballGeo = new THREE.SphereGeometry(0.043, 10, 8);
    ballGeo.scale(1, 1.12, 0.9);
    eye.add(new THREE.Mesh(ballGeo, toonMat(EYE_COLOR)));

    const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), highlightMat);
    highlight.position.set(side * 0.012, 0.018, -0.032);
    eye.add(highlight);

    head.add(eye);
    eyes.push(eye);
  }

  // --- Ears ---
  const ears: THREE.Group[] = [];
  if (species.ear !== 'none') {
    for (const side of [-1, 1]) {
      const ear = buildEar(species, side);
      const floppy = species.ear === 'floppy';
      ear.position.set(side * (floppy ? 0.13 : 0.1), floppy ? 0.05 : 0.13, 0.005);
      head.add(ear);
      ears.push(ear);
    }
  }

  // --- Whiskers ---
  if (species.whiskers) {
    const whiskerMat = toonMat(0xF2F2F2);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const whisker = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0035, 0.0035, 0.17, 4),
          whiskerMat,
        );
        whisker.rotation.z = side * Math.PI / 2;
        whisker.rotation.y = side * (0.12 - i * 0.14);
        whisker.position.set(side * 0.13, -0.045 + i * 0.026, -0.12);
        head.add(whisker);
      }
    }
  }

  // --- Collar (player's cat only) ---
  // 头几乎直接坐在身上，没有真正的脖子，所以项圈要套得比头的下缘更宽，
  // 上半个圈藏进头里，两侧和铃铛露在胸前 —— 看起来就是一条戴着的项圈。
  if (opts.collar !== undefined) {
    const collar = new THREE.Group();
    collar.position.set(0, 0.31, -0.2);

    collar.add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.016, 6, 18), toonMat(opts.collar)));

    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.034, 8, 6),
      toonMat(0xFFD34D, { emissive: 0xFFB300, emissiveIntensity: 0.25 }),
    );
    bell.position.set(0, -0.108, -0.072);
    collar.add(bell);

    bodyGroup.add(collar);
  }

  // --- Legs (root children: the body pitches without dragging the feet) ---
  const legs: THREE.Group[] = [];
  const legSpots: [number, number][] = [
    [-LEG_X, FRONT_Z], [LEG_X, FRONT_Z], [-LEG_X, REAR_Z], [LEG_X, REAR_Z],
  ];
  for (const [x, z] of legSpots) {
    const leg = buildLeg(species);
    leg.position.set(x, HIP_Y, z);
    group.add(leg);
    legs.push(leg);
  }

  group.scale.setScalar(species.scale);

  return {
    group,
    rig: { bodyGroup, head, legs, tailRoot, ears, eyes },
  };
}

// ===================== Speech bubbles =====================

// One texture per line — the vocabulary is tiny and fixed.
const bubbleCache = new Map<string, THREE.CanvasTexture>();

function bubbleTexture(text: string): THREE.CanvasTexture {
  const cached = bubbleCache.get(text);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.roundRect(6, 6, 148, 40, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(205,195,195,0.75)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(72, 46);
  ctx.lineTo(80, 60);
  ctx.lineTo(88, 46);
  ctx.fill();

  ctx.fillStyle = '#5A4A44';
  ctx.font = '20px "Segoe UI", "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 80, 26);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  bubbleCache.set(text, texture);
  return texture;
}

// ===================== Single pet =====================

export type PetState = 'idle' | 'walk' | 'run' | 'sit' | 'happy' | 'flee';

export class Pet {
  group: THREE.Group;
  species: PetSpecies;
  /** Shown in the interaction hint; the player's own cat answers to its name. */
  displayName: string;
  position = new THREE.Vector3();
  state: PetState = 'idle';
  /** 被摸过之后就不再躲着玩家。 */
  friendly = false;

  protected rig: PetRig;
  protected rng: () => number;
  protected targetRotation = 0;
  protected targetX = 0;
  protected targetZ = 0;
  protected stateTimer = 0;
  protected happyTimer = 0;
  protected sitAmount = 0;
  protected walkPhase = 0;

  private getHeight: (x: number, z: number) => number;
  private water: PetWater;
  private homeX: number;
  private homeZ: number;
  private wanderRadius: number;
  private blinkTimer = 2 + Math.random() * 4;
  private blink = 0;
  private earTimer = 2 + Math.random() * 4;
  private earFlick = 0;
  private tailPhase = Math.random() * Math.PI * 2;
  private bobPhase = Math.random() * Math.PI * 2;
  private bubbleTimer = 6 + Math.random() * 10;
  private bubble: THREE.Sprite | null = null;
  private bubbleLife = 0;

  constructor(
    species: PetSpecies,
    x: number,
    z: number,
    getHeight: (x: number, z: number) => number,
    water: PetWater,
    opts: { collar?: number; wanderRadius?: number } = {},
  ) {
    this.species = species;
    this.displayName = species.name;
    this.getHeight = getHeight;
    this.water = water;
    this.homeX = x;
    this.homeZ = z;
    this.wanderRadius = opts.wanderRadius ?? 12;
    // Seed off the spawn point so a reload puts the pet on the same route.
    this.rng = seededRandom(Math.floor((x + 200) * 73 + (z + 200) * 17) + 13);

    const built = buildPetMesh(species, opts);
    this.group = built.group;
    this.rig = built.rig;

    this.position.set(x, getHeight(x, z), z);
    this.group.position.copy(this.position);
  }

  get interactLabel(): string {
    return `按 E 摸摸${this.displayName}`;
  }

  /** Player pets this animal: it stops, faces them and perks up. */
  pet(playerPos: THREE.Vector3) {
    this.friendly = true;
    this.state = 'happy';
    this.happyTimer = 3.2;
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    if (Math.sqrt(dx * dx + dz * dz) > 0.15) {
      this.targetRotation = Math.atan2(dx, dz) + Math.PI;
    }
    this.say(this.species.cry);
  }

  say(text: string) {
    if (this.bubble) this.group.remove(this.bubble);
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({
      map: bubbleTexture(text),
      transparent: true,
      depthWrite: false,
    }));
    this.bubble.scale.set(0.9, 0.36, 1);
    this.bubble.position.set(0, 1.0, 0);
    this.group.add(this.bubble);
    this.bubbleLife = 2.4;
  }

  protected enterIdle(state: 'idle' | 'sit', duration: number) {
    this.state = state;
    this.stateTimer = duration;
  }

  protected walkTo(x: number, z: number, run: boolean, duration = 6) {
    this.state = run ? 'run' : 'walk';
    this.targetX = clamp(x, -88, 88);
    this.targetZ = clamp(z, -88, 88);
    this.stateTimer = duration;
  }

  protected inWater(x: number, z: number): boolean {
    const dx = x - this.water.center.x;
    const dz = z - this.water.center.z;
    return Math.sqrt(dx * dx + dz * dz) < this.water.radius + 1.5;
  }

  private pickWanderTarget() {
    for (let attempt = 0; attempt < 6; attempt++) {
      const angle = this.rng() * Math.PI * 2;
      const dist = 3 + this.rng() * this.wanderRadius;
      const x = this.homeX + Math.cos(angle) * dist;
      const z = this.homeZ + Math.sin(angle) * dist;
      if (this.inWater(x, z)) continue;
      // Mostly a stroll, sometimes a sprint, occasionally a sit.
      const roll = this.rng();
      if (roll < 0.15) this.enterIdle('sit', 2 + this.rng() * 4);
      else this.walkTo(x, z, roll > 0.75, 4 + this.rng() * 4);
      return;
    }
    this.enterIdle('idle', 2 + this.rng() * 2);
  }

  /** Decide what to do this frame. */
  protected think(ctx: PetContext) {
    // 被摸的时候原地开心，谁叫都不理
    if (this.state === 'happy') return;

    // 玩家凑太近会吓一跳（被摸过就不怕了）
    if (!this.friendly && this.state !== 'flee') {
      const dx = this.position.x - ctx.playerPos.x;
      const dz = this.position.z - ctx.playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 2.5 && dist > 0.001) {
        this.walkTo(this.position.x + (dx / dist) * 8, this.position.z + (dz / dist) * 8, true, 1.5);
        this.state = 'flee';
        return;
      }
    }

    if (this.state === 'flee') {
      if (this.stateTimer <= 0) this.enterIdle('idle', 1 + this.rng() * 2);
      return;
    }

    if (this.state === 'walk' || this.state === 'run') {
      const dx = this.targetX - this.position.x;
      const dz = this.targetZ - this.position.z;
      const arrived = Math.sqrt(dx * dx + dz * dz) < 0.5;
      if (arrived || this.stateTimer <= 0) {
        this.enterIdle(this.rng() < 0.3 ? 'sit' : 'idle', 2 + this.rng() * 4);
      }
      return;
    }

    // idle / sit —— 待够了就换个地方
    if (this.stateTimer <= 0) this.pickWanderTarget();
  }

  update(dt: number, ctx: PetContext) {
    this.stateTimer -= dt;
    this.happyTimer -= dt;
    this.think(ctx);

    if (this.state === 'happy' && this.happyTimer <= 0) {
      this.enterIdle('idle', 2 + this.rng() * 2);
    }

    // --- Movement ---
    let moving = false;
    if (this.state === 'walk' || this.state === 'run' || this.state === 'flee') {
      const dx = this.targetX - this.position.x;
      const dz = this.targetZ - this.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0.001) {
        const sprint = this.state === 'flee' ? 2.2 : this.state === 'run' ? 1.9 : 1;
        const step = Math.min(this.species.speed * sprint * dt, dist);
        const nx = this.position.x + (dx / dist) * step;
        const nz = this.position.z + (dz / dist) * step;
        if (this.inWater(nx, nz)) {
          // 前面是湖水，绕不过去就站在岸边
          this.enterIdle('idle', 1.5 + this.rng() * 1.5);
        } else {
          this.position.x = nx;
          this.position.z = nz;
          this.targetRotation = Math.atan2(dx, dz) + Math.PI;
          moving = true;
        }
      }
    }

    let rotDiff = this.targetRotation - this.group.rotation.y;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    this.group.rotation.y += rotDiff * Math.min(dt * 6, 1);

    this.animate(dt, moving);

    // --- Speech bubble ---
    if (this.bubble) {
      this.bubbleLife -= dt;
      const mat = this.bubble.material as THREE.SpriteMaterial;
      mat.opacity = clamp(this.bubbleLife / 0.4, 0, 1);
      if (this.bubbleLife <= 0) {
        this.group.remove(this.bubble);
        this.bubble = null;
      }
    } else {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) {
        this.bubbleTimer = 8 + Math.random() * 12;
        const dx = ctx.playerPos.x - this.position.x;
        const dz = ctx.playerPos.z - this.position.z;
        // 离得太远的宠物就别冒泡打扰玩家了
        if (Math.sqrt(dx * dx + dz * dz) < 14) this.say(this.species.cry);
      }
    }

    // --- Ground + transform ---
    const groundY = this.getHeight(this.position.x, this.position.z);
    this.position.y = groundY;
    let yOffset = 0;
    if (moving) {
      yOffset = this.species.hop
        ? Math.abs(Math.sin(this.walkPhase * 0.9)) * 0.14
        : Math.abs(Math.sin(this.walkPhase * 0.5)) * 0.015;
    } else {
      yOffset = Math.sin(performance.now() * 0.0016 + this.bobPhase) * 0.008;
    }
    if (this.state === 'happy') {
      yOffset += Math.abs(Math.sin(performance.now() * 0.004)) * 0.09;
    }

    const sit = this.sitAmount;
    this.group.position.set(this.position.x, groundY + yOffset - sit * 0.05, this.position.z);
  }

  private animate(dt: number, moving: boolean) {
    const running = this.state === 'run' || this.state === 'flee';
    const happy = this.state === 'happy';
    const sitTarget = this.state === 'sit' ? 1 : 0;
    this.sitAmount = lerp(this.sitAmount, sitTarget, dt * 3.5);
    const sit = this.sitAmount;

    if (moving) this.walkPhase += dt * (running ? 14 : 9);

    // Legs: diagonal trot, or folded under the belly when sitting.
    const gaitAmp = moving ? (running ? 0.75 : 0.5) : 0;
    for (let i = 0; i < this.rig.legs.length; i++) {
      const leg = this.rig.legs[i];
      let target = 0;
      if (i >= 2 && sit > 0.05) {
        target = 1.2 * sit;
      } else if (moving) {
        const phase = this.walkPhase + (i === 0 || i === 3 ? 0 : Math.PI);
        target = gaitAmp * (this.species.hop ? 0.25 : 1) * Math.sin(phase);
      }
      leg.rotation.x = lerp(leg.rotation.x, target, dt * 12);
    }

    // Body: pitches up when sitting (lift it a little so the rear stays above ground),
    // and leans into a hop.
    const hopLean = this.species.hop && moving ? Math.sin(this.walkPhase * 0.9) * 0.12 : 0;
    this.rig.bodyGroup.rotation.x = lerp(
      this.rig.bodyGroup.rotation.x, sit * 0.38 + hopLean, dt * 6,
    );
    this.rig.bodyGroup.position.y = lerp(this.rig.bodyGroup.position.y, sit * 0.05, dt * 6);

    // Tail: swishes faster and lifts when happy.
    const wagSpeed = happy ? 11 : moving ? 5 : 2.4;
    const wagAmp = happy ? 0.5 : moving ? 0.28 : 0.18;
    this.tailPhase += dt * wagSpeed;
    this.rig.tailRoot.rotation.y = Math.sin(this.tailPhase) * wagAmp;
    this.rig.tailRoot.rotation.x = -sit * 0.5 - (happy ? 0.3 : 0)
      + Math.sin(this.tailPhase * 0.7) * 0.1;

    // Head: nods along the walk, lifts and nuzzles when petted. The -sit term keeps
    // the head level while the body pitches up into the sitting pose.
    const nuzzle = happy ? Math.sin(performance.now() * 0.006) * 0.13 : 0;
    this.rig.head.rotation.x = lerp(
      this.rig.head.rotation.x,
      (moving ? Math.sin(this.walkPhase * 0.5) * 0.05 : 0) - (happy ? 0.2 : 0) - sit * 0.38 + nuzzle,
      dt * 8,
    );

    // Body sways a little while being petted
    this.rig.bodyGroup.rotation.z = happy
      ? Math.sin(performance.now() * 0.006) * 0.05
      : lerp(this.rig.bodyGroup.rotation.z, 0, dt * 6);

    // Ears flick, and perk up while being petted.
    this.earTimer -= dt;
    if (this.earTimer <= 0) {
      this.earTimer = 3 + Math.random() * 5;
      this.earFlick = 1;
    }
    this.earFlick = Math.max(0, this.earFlick - dt * 3);
    for (let i = 0; i < this.rig.ears.length; i++) {
      const side = i === 0 ? -1 : 1;
      this.rig.ears[i].rotation.z = -side * (0.3 * this.earFlick + (happy ? 0.12 : 0));
    }

    // Blink
    if (this.blink > 0) {
      this.blink -= dt;
      const closed = this.blink > 0.05 ? 0.12 : 1;
      for (const eye of this.rig.eyes) eye.scale.y = closed;
    } else {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkTimer = 2 + Math.random() * 4;
        this.blink = 0.16;
      }
    }
  }
}

// ===================== The player's companion =====================

export class PlayerPet extends Pet {
  constructor(x: number, z: number, getHeight: (x: number, z: number) => number, water: PetWater) {
    super(PLAYER_CAT, x, z, getHeight, water, { collar: 0xD83A5A, wanderRadius: 6 });
    this.friendly = true;
  }

  protected think(ctx: PetContext) {
    if (this.state === 'happy') return;

    const dx = ctx.playerPos.x - this.position.x;
    const dz = ctx.playerPos.z - this.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // 玩家飞上天了：猫不会飞，就在地上等着
    if (!ctx.playerOnGround && ctx.playerPos.y - this.position.y > 3) {
      if (this.state === 'sit') this.stateTimer = 1;
      else this.enterIdle('sit', 1);
      return;
    }

    // 被甩得太远（传送、坠落回原点）：直接闪现到身边
    if (dist > 40) {
      const angle = this.rng() * Math.PI * 2;
      this.position.x = clamp(ctx.playerPos.x + Math.cos(angle) * 1.8, -88, 88);
      this.position.z = clamp(ctx.playerPos.z + Math.sin(angle) * 1.8, -88, 88);
      this.enterIdle('idle', 0.5);
      return;
    }

    if (dist > 3) {
      this.walkTo(ctx.playerPos.x, ctx.playerPos.z, dist > 8, 3);
      return;
    }

    // 别挡路：贴太近就往旁边让一步
    if (dist < 1.1) {
      const nd = Math.max(dist, 0.001);
      this.walkTo(this.position.x - (dx / nd) * 1.6, this.position.z - (dz / nd) * 1.6, false, 0.6);
      return;
    }

    // 1.1 ~ 3：待在脚边就好（这里不接管进行中的走动）
    if (this.state === 'walk' || this.state === 'run') {
      if (this.stateTimer <= 0) this.enterIdle('idle', 1.5);
      return;
    }

    const wantSit = ctx.playerIdleTime > 2.5;
    if (this.state === 'sit') {
      if (wantSit) this.stateTimer = Math.max(this.stateTimer, 1);
      else this.enterIdle('idle', 2);
      return;
    }

    if (this.state === 'idle' && this.stateTimer <= 0) {
      if (wantSit) {
        this.enterIdle('sit', 3);
      } else if (ctx.playerIdleTime > 5 && this.rng() < 0.35) {
        // 玩家发呆太久，自己在旁边溜达一圈
        const angle = this.rng() * Math.PI * 2;
        const radius = 1.6 + this.rng() * 1.4;
        this.walkTo(
          ctx.playerPos.x + Math.cos(angle) * radius,
          ctx.playerPos.z + Math.sin(angle) * radius,
          false,
          3,
        );
      } else {
        this.stateTimer = 1.5;
      }
    }
  }
}

// ===================== Heart particles =====================

function makeHeartTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FF6B9D';
  ctx.beginPath();
  ctx.arc(22, 24, 13, Math.PI, 0);
  ctx.arc(42, 24, 13, Math.PI, 0);
  ctx.lineTo(32, 54);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(21, 22, 4.5, 3.5, -0.5, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/** Floating hearts that puff out of a pet when it gets petted. */
class HeartPuffs {
  private group = new THREE.Group();
  private texture: THREE.CanvasTexture;
  private particles: {
    sprite: THREE.Sprite;
    vx: number;
    vy: number;
    vz: number;
    life: number;
  }[] = [];

  constructor() {
    this.texture = makeHeartTexture();
    for (let i = 0; i < 20; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.texture,
        transparent: true,
        depthWrite: false,
      }));
      sprite.visible = false;
      this.group.add(sprite);
      this.particles.push({ sprite, vx: 0, vy: 0, vz: 0, life: 0 });
    }
  }

  trigger(x: number, y: number, z: number, count: number) {
    let spawned = 0;
    for (const p of this.particles) {
      if (spawned >= count) return;
      if (p.life > 0) continue;

      const angle = Math.random() * Math.PI * 2;
      p.sprite.position.set(
        x + Math.cos(angle) * 0.18,
        y + Math.random() * 0.12,
        z + Math.sin(angle) * 0.18,
      );
      p.vx = Math.cos(angle) * 0.25;
      p.vz = Math.sin(angle) * 0.25;
      p.vy = 0.7 + Math.random() * 0.4;
      p.life = 1.1 + Math.random() * 0.4;
      p.sprite.scale.setScalar(0.22);
      p.sprite.visible = true;
      spawned++;
    }
  }

  update(dt: number) {
    for (const p of this.particles) {
      if (p.life <= 0) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }

      p.vy -= dt * 0.35;
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      p.sprite.scale.setScalar(0.22 + (1.3 - p.life) * 0.06);
      (p.sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, p.life / 0.5);
    }
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.group);
  }
}

// ===================== Manager =====================

export const MAX_AFFECTION = 100;

const MILESTONES: { at: number; text: string }[] = [
  { at: 20, text: '喵喵开始信任你了！❤️' },
  { at: 50, text: '喵喵很喜欢你！❤️❤️' },
  { at: 80, text: '喵喵离不开你了！❤️❤️❤️' },
];

// Hand-picked spots spread over the map, clear of the lake and the village.
const WILD_SPAWNS: { species: number; x: number; z: number }[] = [
  { species: 0, x: 14, z: 26 },
  { species: 0, x: -46, z: 30 },
  { species: 1, x: -18, z: -12 },
  { species: 1, x: 34, z: 18 },
  { species: 2, x: 8, z: -18 },
  { species: 2, x: 48, z: -6 },
  { species: 3, x: -10, z: 14 },
  { species: 3, x: -52, z: -24 },
  { species: 4, x: 26, z: 40 },
  { species: 4, x: -30, z: 44 },
];

export class PetManager {
  playerPet: PlayerPet;
  wildPets: Pet[] = [];
  petName = '喵喵';
  affection = 0;

  private hearts: HeartPuffs;
  private lastPlayerPos = new THREE.Vector3();
  private playerIdleTime = 0;

  constructor(
    getHeight: (x: number, z: number) => number,
    water: PetWater,
  ) {
    const rng = seededRandom(20240925);

    // 小猫出生在玩家身后一点
    this.playerPet = new PlayerPet(1.6, 2.4, getHeight, water);
    this.playerPet.displayName = this.petName;

    for (const spawn of WILD_SPAWNS) {
      this.wildPets.push(new Pet(
        WILD_SPECIES[spawn.species % WILD_SPECIES.length],
        spawn.x,
        spawn.z,
        getHeight,
        water,
        { wanderRadius: 10 + rng() * 12 },
      ));
    }

    this.hearts = new HeartPuffs();
    this.lastPlayerPos.copy(this.playerPet.position);
  }

  update(dt: number, playerPos: THREE.Vector3, playerOnGround: boolean) {
    // 玩家站住多久了？小猫据此决定要不要坐下
    const moved = Math.hypot(
      playerPos.x - this.lastPlayerPos.x,
      playerPos.z - this.lastPlayerPos.z,
    );
    this.playerIdleTime = moved > 0.02 ? 0 : this.playerIdleTime + dt;
    this.lastPlayerPos.copy(playerPos);

    const ctx: PetContext = { playerPos, playerOnGround, playerIdleTime: this.playerIdleTime };
    this.playerPet.update(dt, ctx);
    for (const pet of this.wildPets) pet.update(dt, ctx);

    this.hearts.update(dt);
  }

  setAffection(value: number) {
    this.affection = clamp(Math.round(value), 0, MAX_AFFECTION);
  }

  /** Nearest pet in range, for the E-key interaction. */
  findNearPet(playerPos: THREE.Vector3, range = 2.2): Pet | null {
    let best: Pet | null = null;
    let bestDist = range;
    for (const pet of [this.playerPet, ...this.wildPets]) {
      const dist = Math.hypot(playerPos.x - pet.position.x, playerPos.z - pet.position.z);
      if (dist < bestDist) {
        bestDist = dist;
        best = pet;
      }
    }
    return best;
  }

  /** Pet an animal. Only the player's own cat builds affection. */
  pet(pet: Pet): { message: string; gained: number } {
    pet.pet(this.lastPlayerPos);
    this.hearts.trigger(pet.position.x, pet.position.y + 0.55, pet.position.z, 5);

    if (pet !== this.playerPet) {
      return { message: `你摸了摸${pet.species.name}，它开心地蹭了蹭你 🐾`, gained: 0 };
    }

    const before = this.affection;
    this.affection = Math.min(MAX_AFFECTION, this.affection + 2);
    const gained = this.affection - before;
    if (gained === 0) {
      return { message: `你和${this.petName}已经很亲密了 ❤️（${MAX_AFFECTION}/${MAX_AFFECTION}）`, gained: 0 };
    }

    const milestone = MILESTONES.find(m => before < m.at && this.affection >= m.at);
    return {
      message: milestone
        ? `${milestone.text}（${this.affection}/${MAX_AFFECTION}）`
        : `摸摸${this.petName} ❤️ 亲密度 +${gained}（${this.affection}/${MAX_AFFECTION}）`,
      gained,
    };
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.playerPet.group);
    for (const pet of this.wildPets) scene.add(pet.group);
    this.hearts.addToScene(scene);
  }
}
