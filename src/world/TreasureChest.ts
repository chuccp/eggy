import * as THREE from 'three';
import { seededRandom } from '../utils/math';

// ===================== Loot tables =====================

export interface LootItem {
  id: string;
  name: string;
  icon: string;
  coins: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  description: string;
}

const LOOT_TABLE: LootItem[] = [
  // Common (50%)
  { id: 'coin_pouch', name: '金币袋', icon: '💰', coins: 15, rarity: 'common', description: '一小袋金币' },
  { id: 'apple', name: '红苹果', icon: '🍎', coins: 10, rarity: 'common', description: '新鲜的红苹果' },
  { id: 'feather', name: '彩色羽毛', icon: '🪶', coins: 12, rarity: 'common', description: '鸟儿掉落的漂亮羽毛' },
  { id: 'clover', name: '四叶草', icon: '🍀', coins: 10, rarity: 'common', description: '带来好运的四叶草' },
  { id: 'shell', name: '海螺壳', icon: '🐚', coins: 8, rarity: 'common', description: '海边捡到的海螺' },
  { id: 'mushroom_item', name: '小蘑菇', icon: '🍄', coins: 10, rarity: 'common', description: '可爱的小蘑菇' },

  // Uncommon (25%)
  { id: 'gem_blue', name: '蓝宝石', icon: '💎', coins: 30, rarity: 'uncommon', description: '闪闪发光的蓝宝石' },
  { id: 'star_fragment', name: '星星碎片', icon: '⭐', coins: 35, rarity: 'uncommon', description: '从天上掉落的星星碎片' },
  { id: 'flower_crown', name: '花冠', icon: '💐', coins: 25, rarity: 'uncommon', description: '用鲜花编成的花冠' },
  { id: 'crystal', name: '水晶石', icon: '🔮', coins: 28, rarity: 'uncommon', description: '透明的水晶石' },
  { id: 'music_box', name: '八音盒', icon: '🎵', coins: 32, rarity: 'uncommon', description: '会播放美妙旋律的八音盒' },

  // Rare (15%)
  { id: 'crown', name: '小皇冠', icon: '👑', coins: 60, rarity: 'rare', description: '精致的迷你皇冠' },
  { id: 'gem_ruby', name: '红宝石', icon: '❤️', coins: 55, rarity: 'rare', description: '珍贵的红宝石' },
  { id: 'rainbow_stone', name: '彩虹石', icon: '🌈', coins: 50, rarity: 'rare', description: '蕴含彩虹之力的石头' },
  { id: 'golden_feather', name: '金色羽毛', icon: '✨', coins: 65, rarity: 'rare', description: '传说中的金色羽毛' },

  // Epic (8%)
  { id: 'diamond', name: '大钻石', icon: '💠', coins: 100, rarity: 'epic', description: '无价的大钻石' },
  { id: 'pearl', name: '龙珠', icon: '🐉', coins: 120, rarity: 'epic', description: '传说中龙的宝珠' },
  { id: 'star_of_love', name: '爱心之星', icon: '💝', coins: 90, rarity: 'epic', description: '充满爱意的星星' },

  // Legendary (2%)
  { id: 'egg_of_gold', name: '黄金蛋仔', icon: '🥇', coins: 200, rarity: 'legendary', description: '传说中的黄金蛋仔雕像！' },
  { id: 'phoenix_feather', name: '凤凰之羽', icon: '🔥', coins: 250, rarity: 'legendary', description: '浴火重生的凤凰羽毛' },
];

function rollLoot(): LootItem {
  const r = Math.random();
  let pool: LootItem[];
  if (r < 0.02) pool = LOOT_TABLE.filter(i => i.rarity === 'legendary');
  else if (r < 0.10) pool = LOOT_TABLE.filter(i => i.rarity === 'epic');
  else if (r < 0.25) pool = LOOT_TABLE.filter(i => i.rarity === 'rare');
  else if (r < 0.50) pool = LOOT_TABLE.filter(i => i.rarity === 'uncommon');
  else pool = LOOT_TABLE.filter(i => i.rarity === 'common');
  return pool[Math.floor(Math.random() * pool.length)];
}

function rollLootOfRarity(rarity: LootItem['rarity']): LootItem {
  const pool = LOOT_TABLE.filter(i => i.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

const RARITY_COLORS: Record<string, number> = {
  common: 0xBBBBBB,
  uncommon: 0x2ECC71,
  rare: 0x3498DB,
  epic: 0x9B59B6,
  legendary: 0xFFD700,
};

const RARITY_GLOW: Record<string, number> = {
  common: 0.1,
  uncommon: 0.2,
  rare: 0.35,
  epic: 0.5,
  legendary: 0.8,
};

// ===================== Single treasure chest =====================

export class TreasureChest {
  group: THREE.Group;
  loot: LootItem;
  x: number;
  z: number;
  baseY: number;
  collected = false;
  glowLight: THREE.PointLight;
  private time = 0;
  private glowRing: THREE.Mesh;
  private lid: THREE.Mesh;
  private openAnim = 0;
  private sparkleTime = 0;
  private sparkleGroup: THREE.Group;

  constructor(x: number, z: number, getHeight: (x: number, z: number) => number, forcedRarity?: LootItem['rarity']) {
    this.x = x;
    this.z = z;
    this.baseY = getHeight(x, z);
    this.loot = forcedRarity ? rollLootOfRarity(forcedRarity) : rollLoot();

    this.group = new THREE.Group();
    this.group.position.set(x, this.baseY, z);

    const color = RARITY_COLORS[this.loot.rarity];
    const chestMat = new THREE.MeshToonMaterial({ color: 0x8B4513 });
    const accentMat = new THREE.MeshToonMaterial({ color });
    const metalMat = new THREE.MeshToonMaterial({ color: 0xDAA520 });

    // Chest body
    const bodyGeo = new THREE.BoxGeometry(0.7, 0.45, 0.5);
    const body = new THREE.Mesh(bodyGeo, chestMat);
    body.position.y = 0.25;
    body.castShadow = true;
    this.group.add(body);

    // Lid
    const lidGeo = new THREE.BoxGeometry(0.72, 0.12, 0.52);
    this.lid = new THREE.Mesh(lidGeo, chestMat);
    this.lid.position.set(0, 0.52, -0.2);
    this.lid.castShadow = true;
    this.group.add(this.lid);

    // Lid top (rounded accent)
    const lidTopGeo = new THREE.BoxGeometry(0.68, 0.04, 0.48);
    const lidTop = new THREE.Mesh(lidTopGeo, accentMat);
    lidTop.position.set(0, 0.58, -0.2);
    this.group.add(lidTop);

    // Metal bands
    for (const dz of [-0.15, 0.15]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.04, 0.06), metalMat);
      band.position.set(0, 0.25, dz);
      this.group.add(band);
    }

    // Lock
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.06), metalMat);
    lock.position.set(0, 0.35, 0.26);
    this.group.add(lock);

    // Glow ring on ground
    const ringGeo = new THREE.RingGeometry(0.5, 0.65, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    this.glowRing = new THREE.Mesh(ringGeo, ringMat);
    this.glowRing.position.y = 0.02;
    this.group.add(this.glowRing);

    // Sparkle particles (stars around chest)
    this.sparkleGroup = new THREE.Group();
    const sparkleGeo = new THREE.OctahedronGeometry(0.04, 0);
    const sparkleMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 6; i++) {
      const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat.clone());
      const angle = (i / 6) * Math.PI * 2;
      sparkle.position.set(Math.cos(angle) * 0.6, 0.5, Math.sin(angle) * 0.6);
      sparkle.userData.angle = angle;
      this.sparkleGroup.add(sparkle);
    }
    this.group.add(this.sparkleGroup);

    // Point light for glow
    this.glowLight = new THREE.PointLight(color, RARITY_GLOW[this.loot.rarity], 4);
    this.glowLight.position.y = 0.6;
    this.group.add(this.glowLight);
  }

  update(dt: number, playerPos: THREE.Vector3): boolean {
    if (this.collected) return false;

    this.time += dt;

    // Float animation
    this.group.position.y = this.baseY + Math.sin(this.time * 2) * 0.08;

    // Glow ring pulse
    const ringMat = this.glowRing.material as THREE.MeshBasicMaterial;
    ringMat.opacity = 0.2 + Math.sin(this.time * 3) * 0.15;
    this.glowRing.rotation.y += dt * 0.5;

    // Sparkle rotation
    this.sparkleGroup.rotation.y += dt * 1.5;
    for (const s of this.sparkleGroup.children) {
      const mesh = s as THREE.Mesh;
      const a = (mesh.userData.angle ?? 0) + this.time * 2;
      mesh.position.y = 0.5 + Math.sin(a * 2) * 0.3;
      mesh.rotation.x += dt * 3;
      mesh.rotation.z += dt * 2;
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(a * 3) * 0.4;
    }

    // Open animation
    if (this.openAnim > 0) {
      this.openAnim -= dt * 3;
      this.lid.rotation.x = -Math.min(1 - this.openAnim, 0.8);
      if (this.openAnim <= 0) {
        this.collected = true;
        this.group.visible = false;
        return true;
      }
      return false;
    }

    // Check proximity
    const dx = playerPos.x - this.x;
    const dz = playerPos.z - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 2.0) {
      this.openAnim = 1; // Trigger open animation
    }

    return false;
  }
}

// ===================== Chest Spawner =====================

export class TreasureChestManager {
  private chests: TreasureChest[] = [];
  private spawnTimer = 0;
  private spawnInterval: number; // Seconds between spawns
  private maxChests: number;
  private getHeight: (x: number, z: number) => number;
  private scene: THREE.Scene | null = null;

  // Callback when chest is collected
  onCollect?: (loot: LootItem) => void;

  constructor(getHeight: (x: number, z: number) => number, spawnInterval = 15, maxChests = 5) {
    this.getHeight = getHeight;
    this.spawnInterval = spawnInterval;
    this.maxChests = maxChests;
  }

  addToScene(scene: THREE.Scene) {
    this.scene = scene;
    // Spawn initial chests
    for (let i = 0; i < 3; i++) {
      this.spawnChest();
    }
  }

  /** Add a pre-built chest (e.g. underwater treasure) */
  addChest(chest: TreasureChest) {
    this.chests.push(chest);
    if (this.scene) this.scene.add(chest.group);
  }

  private spawnChest() {
    if (this.chests.filter(c => !c.collected).length >= this.maxChests) return;

    // Random position avoiding center and edges
    const rng = Math.random;
    let x: number, z: number;
    let attempts = 0;
    do {
      x = (rng() - 0.5) * 160;
      z = (rng() - 0.5) * 160;
      attempts++;
    } while (
      attempts < 30 && (
        (Math.abs(x) < 5 && Math.abs(z) < 5) || // Avoid fountain
        Math.sqrt(x * x + z * z) > 85 // Stay within bounds
      )
    );

    const chest = new TreasureChest(x, z, this.getHeight);
    this.chests.push(chest);
    if (this.scene) this.scene.add(chest.group);
  }

  update(dt: number, playerPos: THREE.Vector3) {
    // Spawn timer
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnChest();
    }

    // Update existing chests
    for (const chest of this.chests) {
      if (chest.collected) continue;
      const collected = chest.update(dt, playerPos);
      if (collected) {
        this.onCollect?.(chest.loot);
      }
    }
  }

  /** Get count of active (uncollected) chests */
  getActiveCount(): number {
    return this.chests.filter(c => !c.collected).length;
  }
}
