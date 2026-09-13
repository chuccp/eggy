import * as THREE from 'three';
import { EggCharacter } from '../player/EggCharacter';
import { OUTFITS } from '../player/Outfit';
import { seededRandom } from '../utils/math';

interface NPCState {
  type: 'idle' | 'walking' | 'greeting';
  timer: number;
  targetPos?: THREE.Vector3;
}

const NPC_COLORS = [
  0xFFB3BA, // pink
  0xFFDFBA, // orange
  0xFFFFBA, // yellow
  0xBAFFC9, // green
  0xBAE1FF, // blue
  0xE8BAFF, // purple
  0xFFC8DD, // rose
  0xC9BAFF, // lavender
];

const GREETINGS = [
  '你好呀~',
  '今天天气真好！',
  '欢迎来玩！',
  '嘿嘿，你好！',
  '一起去冒险吧！',
  '你真可爱！',
  '嘿嘿嘿~',
  '加油哦！',
  '要开心呀~',
  '来和我玩吧！',
  '午安~',
  '看到你真高兴！',
];

export const NPC_RADIUS = 0.45;

export class NPC {
  character: EggCharacter;
  radius = NPC_RADIUS;
  private state: NPCState = { type: 'idle', timer: 2 + Math.random() * 3 };
  private targetRotation = 0;
  private speed = 2 + Math.random();
  private wanderRadius: number;
  private homePos: THREE.Vector3;
  private pushBackX = 0;
  private pushBackZ = 0;

  // Dialogue state
  private speechBubble: THREE.Sprite | null = null;
  private speechTimer = 0;
  private greetingIndex = 0;

  constructor(x: number, z: number, colorIndex: number, getHeight: (x: number, z: number) => number) {
    const color = NPC_COLORS[colorIndex % NPC_COLORS.length];
    // Outfit 0 belongs to the player, so NPCs start from index 1 — every NPC dresses differently.
    const outfit = OUTFITS[(colorIndex + 1) % OUTFITS.length];
    this.character = new EggCharacter(color, outfit);
    const y = getHeight(x, z) + 0.65;
    this.character.position.set(x, y, z);
    this.character.group.position.copy(this.character.position);
    this.homePos = new THREE.Vector3(x, y, z);
    this.wanderRadius = 15 + Math.random() * 20;
    this.greetingIndex = colorIndex % GREETINGS.length;
  }

  applyPush(forceX: number, forceZ: number) {
    this.pushBackX += forceX;
    this.pushBackZ += forceZ;
  }

  /** Show a greeting speech bubble above the NPC; returns the line spoken. */
  greet(): string {
    // Remove old bubble
    if (this.speechBubble) {
      this.character.group.remove(this.speechBubble);
      this.speechBubble = null;
    }

    const msg = GREETINGS[this.greetingIndex % GREETINGS.length];
    this.greetingIndex = (this.greetingIndex + 1) % GREETINGS.length;

    // Create canvas texture for speech bubble
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 80;

    // Bubble background
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.roundRect(10, 5, 236, 55, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,200,200,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bubble tail
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.moveTo(120, 60);
    ctx.lineTo(128, 75);
    ctx.lineTo(136, 60);
    ctx.fill();

    // Text
    ctx.fillStyle = '#444';
    ctx.font = '22px "Segoe UI", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    this.speechBubble = new THREE.Sprite(spriteMat);
    this.speechBubble.scale.set(1.8, 0.6, 1);
    this.speechBubble.position.set(0, 1.6, 0);
    this.character.group.add(this.speechBubble);

    this.speechTimer = 3.0; // Show for 3 seconds

    // Switch to greeting state briefly
    this.state = { type: 'greeting', timer: 2.0 };

    return msg;
  }

  /** Check if player is close enough to interact */
  isNearPlayer(playerPos: THREE.Vector3, range = 3.0): boolean {
    const dx = playerPos.x - this.character.position.x;
    const dz = playerPos.z - this.character.position.z;
    return Math.sqrt(dx * dx + dz * dz) < range;
  }

  get interactLabel(): string { return '按 E 打招呼'; }

  update(dt: number, getHeight: (x: number, z: number) => number) {
    this.state.timer -= dt;

    // Update speech bubble timer
    if (this.speechTimer > 0) {
      this.speechTimer -= dt;
      if (this.speechTimer <= 0 && this.speechBubble) {
        this.character.group.remove(this.speechBubble);
        this.speechBubble = null;
      }
    }

    // Apply push-back decay
    this.character.position.x += this.pushBackX * dt;
    this.character.position.z += this.pushBackZ * dt;
    this.pushBackX *= Math.max(0, 1 - dt * 8);
    this.pushBackZ *= Math.max(0, 1 - dt * 8);

    if (this.state.type === 'greeting') {
      // Stay still, face player direction
      this.character.update(dt, false, false);
      if (this.state.timer <= 0) {
        this.state = { type: 'idle', timer: 3 + Math.random() * 3 };
      }
    } else if (this.state.type === 'idle') {
      if (this.state.timer <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * this.wanderRadius;
        const tx = this.homePos.x + Math.cos(angle) * dist;
        const tz = this.homePos.z + Math.sin(angle) * dist;
        this.state = {
          type: 'walking',
          timer: 8 + Math.random() * 5,
          targetPos: new THREE.Vector3(
            Math.max(-90, Math.min(90, tx)),
            0,
            Math.max(-90, Math.min(90, tz)),
          ),
        };
      }
      this.character.update(dt, false, false);
    } else {
      const target = this.state.targetPos!;
      const dx = target.x - this.character.position.x;
      const dz = target.z - this.character.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 1 || this.state.timer <= 0) {
        this.state = { type: 'idle', timer: 3 + Math.random() * 5 };
      } else {
        const moveX = (dx / dist) * this.speed * dt;
        const moveZ = (dz / dist) * this.speed * dt;
        this.character.position.x += moveX;
        this.character.position.z += moveZ;
        this.targetRotation = Math.atan2(dx, dz) + Math.PI;
      }

      let rotDiff = this.targetRotation - this.character.group.rotation.y;
      while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
      while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
      this.character.group.rotation.y += rotDiff * Math.min(dt * 6, 1);

      this.character.update(dt, true, false);
    }

    // Ground height
    const groundY = getHeight(this.character.position.x, this.character.position.z) + 0.65;
    this.character.position.y = groundY;
    this.character.group.position.y = groundY + Math.sin(Date.now() * 0.003) * 0.02;
    this.character.group.position.x = this.character.position.x;
    this.character.group.position.z = this.character.position.z;
  }
}

export class NPCManager {
  npcs: NPC[] = [];

  constructor(getHeight: (x: number, z: number) => number) {
    const positions: [number, number][] = [
      [10, 10],
      [-15, 8],
      [20, -15],
      [-18, -2],
      [5, -30],
      [-10, 25],
      [30, 5],
      [-35, 15],
      [15, 35],
      [-8, -40],
    ];

    positions.forEach(([x, z], i) => {
      this.npcs.push(new NPC(x, z, i, getHeight));
    });
  }

  update(dt: number, getHeight: (x: number, z: number) => number) {
    for (const npc of this.npcs) {
      npc.update(dt, getHeight);
    }
  }

  /** Find nearest NPC in range for interaction */
  findNearNPC(playerPos: THREE.Vector3, range = 3.0): NPC | null {
    let best: NPC | null = null;
    let bestDist = range;
    for (const npc of this.npcs) {
      const dx = playerPos.x - npc.character.position.x;
      const dz = playerPos.z - npc.character.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        best = npc;
      }
    }
    return best;
  }

  resolveCollisions(playerPos: THREE.Vector3, playerRadius: number): { pushX: number; pushZ: number } {
    let totalPushX = 0;
    let totalPushZ = 0;
    const BOUNCE_FORCE = 8;

    for (const npc of this.npcs) {
      const dx = playerPos.x - npc.character.position.x;
      const dz = playerPos.z - npc.character.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minDist = playerRadius + npc.radius;

      if (dist < minDist && dist > 0.01) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const nz = dz / dist;
        const playerPush = overlap * (2 / 3) * BOUNCE_FORCE;
        totalPushX += nx * playerPush;
        totalPushZ += nz * playerPush;
        const npcPush = overlap * (1 / 3) * BOUNCE_FORCE;
        npc.applyPush(-nx * npcPush, -nz * npcPush);
        npc.character.onLand();
      }
    }

    for (let i = 0; i < this.npcs.length; i++) {
      for (let j = i + 1; j < this.npcs.length; j++) {
        const a = this.npcs[i];
        const b = this.npcs[j];
        const dx = a.character.position.x - b.character.position.x;
        const dz = a.character.position.z - b.character.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const minDist = a.radius + b.radius;

        if (dist < minDist && dist > 0.01) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const nz = dz / dist;
          const push = overlap * 0.5 * BOUNCE_FORCE;
          a.applyPush(nx * push, nz * push);
          b.applyPush(-nx * push, -nz * push);
        }
      }
    }

    return { pushX: totalPushX, pushZ: totalPushZ };
  }

  addToScene(scene: THREE.Scene) {
    for (const npc of this.npcs) {
      scene.add(npc.character.group);
    }
  }
}
