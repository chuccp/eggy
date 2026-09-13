import * as THREE from 'three';
import { toonMat } from '../utils/colors';
import { WING_STYLES, buildWingRig } from '../player/Wings';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===================== Item & Equipment Definitions =====================

export type EquipSlot = 'hat' | 'face' | 'back' | 'wings' | 'held';

export interface InventoryItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Equipment slot. Items without a slot are collectibles: keepable and sellable, but not wearable. */
  slot?: EquipSlot;
  count: number;
  color?: number;       // Visual color
  meshType?: string;    // Visual shape type
}

// All possible equipable items (from shop + treasure)
const EQUIP_DEFS: Record<string, Omit<InventoryItem, 'count'>> = {
  // ---- Hats ----
  hat_red:       { id: 'hat_red',       name: '红色贝雷帽',   icon: '🎩', description: '时尚红色贝雷帽',       slot: 'hat', color: 0xCC2222, meshType: 'beret' },
  hat_crown:     { id: 'hat_crown',     name: '小皇冠',       icon: '👑', description: '闪闪发光的皇冠',       slot: 'hat', color: 0xFFD700, meshType: 'crown' },
  hat_flower:    { id: 'hat_flower',    name: '花环头饰',     icon: '💐', description: '清新花环',             slot: 'hat', color: 0xFF69B4, meshType: 'wreath' },
  hat_wizard:    { id: 'hat_wizard',    name: '巫师帽',       icon: '🧙', description: '神秘的巫师帽',         slot: 'hat', color: 0x4B0082, meshType: 'wizard' },
  hat_straw:     { id: 'hat_straw',     name: '草帽',         icon: '🌾', description: '田园风格草帽',         slot: 'hat', color: 0xF5DEB3, meshType: 'straw' },
  hat_party:     { id: 'hat_party',     name: '派对帽',       icon: '🎉', description: '五彩派对帽',           slot: 'hat', color: 0xFF6B6B, meshType: 'party' },

  // ---- Face accessories ----
  glasses:       { id: 'glasses',       name: '酷炫墨镜',     icon: '🕶️', description: '戴上就是最酷的蛋仔',  slot: 'face', color: 0x222222, meshType: 'glasses' },
  monocle:       { id: 'monocle',       name: '单片眼镜',     icon: '🧐', description: '绅士单片眼镜',         slot: 'face', color: 0xDAA520, meshType: 'monocle' },
  mask_star:     { id: 'mask_star',     name: '星星面具',     icon: '⭐', description: '闪闪星星面具',         slot: 'face', color: 0xFFD700, meshType: 'star_mask' },
  mask_cat:      { id: 'mask_cat',      name: '猫咪面具',     icon: '🐱', description: '可爱猫咪面具',         slot: 'face', color: 0xFFB3BA, meshType: 'cat_mask' },

  // ---- Back accessories ----
  cape:          { id: 'cape',          name: '超人披风',     icon: '🦸', description: '红色超人披风',         slot: 'back', color: 0xEE2222, meshType: 'cape' },
  bow:           { id: 'bow',           name: '蝴蝶结',       icon: '🎀', description: '可爱的蝴蝶结',         slot: 'back', color: 0xFF69B4, meshType: 'bow_back' },
  jetpack:       { id: 'jetpack',       name: '小火箭背包',   icon: '🚀', description: '喷气背包',             slot: 'back', color: 0x666666, meshType: 'jetpack' },

  // ---- Wings (their own slot — swap styles freely without giving up flight) ----
  wings:         { id: 'wings',         name: '小翅膀',       icon: '🦋', description: '背上可爱小翅膀，可飞行', slot: 'wings', color: 0xFFB6C1, meshType: 'wings' },
  fairy_wings:   { id: 'fairy_wings',   name: '精灵之翼',     icon: '🧚', description: '半透明的发光薄翼',      slot: 'wings', color: 0xBFEFFF, meshType: 'fairy_wings' },
  demon_wings:   { id: 'demon_wings',   name: '恶魔之翼',     icon: '🦇', description: '暗夜蝙蝠膜翼',          slot: 'wings', color: 0x3A2A4A, meshType: 'demon_wings' },
  dragon_wings:  { id: 'dragon_wings',  name: '巨龙之翼',     icon: '🐉', description: '坚硬的龙鳞膜翼',        slot: 'wings', color: 0x2F8F4E, meshType: 'dragon_wings' },
  angel_wings:   { id: 'angel_wings',   name: '天使之翼',     icon: '😇', description: '纯白天使翅膀',          slot: 'wings', color: 0xFFFFEE, meshType: 'angel_wings' },
  rainbow_wings: { id: 'rainbow_wings', name: '彩虹之翼',     icon: '🌈', description: '七彩流光羽翼',          slot: 'wings', color: 0xFF6B6B, meshType: 'rainbow_wings' },

  // ---- Held items ----
  balloon:       { id: 'balloon',       name: '气球',         icon: '🎈', description: '牵着一个彩色气球',     slot: 'held', color: 0xFF4444, meshType: 'balloon' },
  lantern:       { id: 'lantern',       name: '小灯笼',       icon: '🏮', description: '温暖的小灯笼',         slot: 'held', color: 0xFF6347, meshType: 'lantern' },
  wand:          { id: 'wand',          name: '魔法棒',       icon: '🪄', description: '闪闪发光的魔法棒',     slot: 'held', color: 0xFFD700, meshType: 'wand' },

  // ---- Wearable treasure items ----
  crown:         { id: 'crown',         name: '小皇冠',       icon: '👑', description: '精致的迷你皇冠',       slot: 'hat', color: 0xFFD700, meshType: 'crown' },
  egg_of_gold:   { id: 'egg_of_gold',   name: '黄金蛋仔',     icon: '🥇', description: '传说中的黄金蛋仔雕像', slot: 'hat', color: 0xFFD700, meshType: 'crown' },

  // ---- Collectibles: keep them, sell them, but they can't be worn ----
  // From treasure chests
  coin_pouch:    { id: 'coin_pouch',    name: '金币袋',       icon: '💰', description: '一小袋金币' },
  apple:         { id: 'apple',         name: '红苹果',       icon: '🍎', description: '新鲜的红苹果' },
  feather:       { id: 'feather',       name: '彩色羽毛',     icon: '🪶', description: '鸟儿掉落的漂亮羽毛' },
  clover:        { id: 'clover',        name: '四叶草',       icon: '🍀', description: '带来好运的四叶草' },
  shell:         { id: 'shell',         name: '海螺壳',       icon: '🐚', description: '海边捡到的海螺' },
  mushroom_item: { id: 'mushroom_item', name: '小蘑菇',       icon: '🍄', description: '可爱的小蘑菇' },
  gem_blue:      { id: 'gem_blue',      name: '蓝宝石',       icon: '💎', description: '闪闪发光的蓝宝石' },
  star_fragment: { id: 'star_fragment', name: '星星碎片',     icon: '⭐', description: '从天上掉落的星星碎片' },
  flower_crown:  { id: 'flower_crown',  name: '花冠',         icon: '💐', description: '用鲜花编成的花冠' },
  crystal:       { id: 'crystal',       name: '水晶石',       icon: '🔮', description: '透明的水晶石' },
  music_box:     { id: 'music_box',     name: '八音盒',       icon: '🎵', description: '会播放美妙旋律的八音盒' },
  gem_ruby:      { id: 'gem_ruby',      name: '红宝石',       icon: '❤️', description: '珍贵的红宝石' },
  rainbow_stone: { id: 'rainbow_stone', name: '彩虹石',       icon: '🌈', description: '蕴含彩虹之力的石头' },
  golden_feather:{ id: 'golden_feather',name: '金色羽毛',     icon: '✨', description: '传说中的金色羽毛' },
  diamond:       { id: 'diamond',       name: '大钻石',       icon: '💠', description: '无价的大钻石' },
  pearl:         { id: 'pearl',         name: '龙珠',         icon: '🐉', description: '传说中龙的宝珠' },
  star_of_love:  { id: 'star_of_love',  name: '爱心之星',     icon: '💝', description: '充满爱意的星星' },
  phoenix_feather:{ id: 'phoenix_feather', name: '凤凰之羽',  icon: '🔥', description: '浴火重生的凤凰羽毛' },

  // From the shops (food / furniture / ice cream)
  bread:         { id: 'bread',         name: '法式面包',     icon: '🥖', description: '刚出炉的香脆面包' },
  croissant:     { id: 'croissant',     name: '牛角面包',     icon: '🥐', description: '酥脆可颂，黄油香浓' },
  cake:          { id: 'cake',          name: '草莓蛋糕',     icon: '🍰', description: '甜蜜草莓装饰的蛋糕' },
  cookie:        { id: 'cookie',        name: '曲奇饼干',     icon: '🍪', description: '巧克力豆曲奇' },
  donut:         { id: 'donut',         name: '甜甜圈',       icon: '🍩', description: '彩虹糖霜甜甜圈' },
  pretzel:       { id: 'pretzel',       name: '蝴蝶饼',       icon: '🥨', description: '咸香蝴蝶饼' },
  cupcake:       { id: 'cupcake',       name: '纸杯蛋糕',     icon: '🧁', description: '粉色奶油纸杯蛋糕' },
  pie:           { id: 'pie',           name: '苹果派',       icon: '🥧', description: '经典苹果派' },
  scarf:         { id: 'scarf',         name: '彩色围巾',     icon: '🧣', description: '温暖的彩色围巾' },
  plant:         { id: 'plant',         name: '小盆栽',       icon: '🪴', description: '清新小盆栽' },
  painting:      { id: 'painting',      name: '风景画',       icon: '🖼️', description: '美丽风景画' },
  candle:        { id: 'candle',        name: '香薰蜡烛',     icon: '🕯️', description: '薰衣草香味蜡烛' },
  clock:         { id: 'clock',         name: '挂钟',         icon: '🕐', description: '可爱猫咪挂钟' },
  cushion:       { id: 'cushion',       name: '抱枕',         icon: '🛋️', description: '柔软的蛋形抱枕' },
  rug_fancy:     { id: 'rug_fancy',     name: '波斯地毯',     icon: '🧶', description: '精美的手工波斯地毯' },
  vanilla:       { id: 'vanilla',       name: '香草冰淇淋',   icon: '🍦', description: '经典香草味' },
  chocolate:     { id: 'chocolate',     name: '巧克力冰淇淋', icon: '🍫', description: '浓郁巧克力味' },
  strawberry:    { id: 'strawberry',    name: '草莓冰淇淋',   icon: '🍓', description: '新鲜草莓味' },
  matcha:        { id: 'matcha',        name: '抹茶冰淇淋',   icon: '🍵', description: '日式抹茶味' },
  mango:         { id: 'mango',         name: '芒果冰淇淋',   icon: '🥭', description: '热带芒果味' },
  sundae:        { id: 'sundae',        name: '超级圣代',     icon: '🍨', description: '三层混合圣代' },
  popsicle:      { id: 'popsicle',      name: '水果冰棒',     icon: '🧊', description: '清凉水果冰棒' },
};

// Base value of each item, in coins. Shop goods match their shelf price.
// Shops buy back at half value (see getSellPrice).
// Base value of each item, in coins. Shop goods match their shelf price.
const ITEM_VALUES: Record<string, number> = {
  // Hats
  hat_red: 30, hat_crown: 80, hat_flower: 25, hat_wizard: 70, hat_straw: 20, hat_party: 40,
  // Face
  glasses: 35, monocle: 30, mask_star: 45, mask_cat: 40,
  // Back
  cape: 60, bow: 15, jetpack: 90,
  // Wings
  wings: 100, fairy_wings: 80, demon_wings: 140, dragon_wings: 170,
  angel_wings: 220, rainbow_wings: 260,
  // Held
  balloon: 10, lantern: 12, wand: 50,
  // Wearable treasure
  crown: 60, egg_of_gold: 200,
  // Treasure collectibles (values mirror the chest loot table)
  coin_pouch: 15, apple: 10, feather: 12, clover: 10, shell: 8, mushroom_item: 10,
  gem_blue: 30, star_fragment: 35, flower_crown: 25, crystal: 28, music_box: 32,
  gem_ruby: 55, rainbow_stone: 50, golden_feather: 65, diamond: 100, pearl: 120,
  star_of_love: 90, phoenix_feather: 250,
  // Shop goods (values mirror their shelf price)
  bread: 10, croissant: 15, cake: 25, cookie: 8, donut: 12, pretzel: 9,
  cupcake: 18, pie: 20, scarf: 20,
  plant: 15, painting: 40, candle: 20, clock: 30, cushion: 12, rug_fancy: 50,
  vanilla: 8, chocolate: 10, strawberry: 10, matcha: 12, mango: 12, sundae: 25, popsicle: 6,
};

/** Coins the shop pays for one of this item (half its value). */
export function getSellPrice(id: string): number {
  return Math.max(1, Math.floor((ITEM_VALUES[id] ?? 2) / 2));
}

/** True when the item can be worn (has an equipment slot). */
export function isEquippable(id: string): boolean {
  return EQUIP_DEFS[id]?.slot !== undefined;
}

// ===================== Inventory Data =====================

export class Inventory {
  items: Map<string, InventoryItem> = new Map();
  equipped: Record<EquipSlot, InventoryItem | null> = {
    hat: null, face: null, back: null, wings: null, held: null,
  };

  onChange?: () => void;

  addItem(id: string, count = 1) {
    const def = EQUIP_DEFS[id];
    if (!def) return;
    const existing = this.items.get(id);
    if (existing) {
      existing.count += count;
    } else {
      this.items.set(id, { ...def, count });
    }
    this.onChange?.();
  }

  removeItem(id: string, count = 1): boolean {
    const item = this.items.get(id);
    if (!item || item.count < count) return false;
    item.count -= count;
    if (item.count <= 0) {
      this.items.delete(id);
      // If it was equipped, unequip
      for (const slot of Object.keys(this.equipped) as EquipSlot[]) {
        if (this.equipped[slot]?.id === id) {
          this.equipped[slot] = null;
        }
      }
    }
    this.onChange?.();
    return true;
  }

  hasItem(id: string): boolean {
    return (this.items.get(id)?.count ?? 0) > 0;
  }

  equip(id: string): boolean {
    const item = this.items.get(id);
    if (!item || !item.slot) return false; // collectibles can't be worn
    // Replaces whatever was in that slot
    this.equipped[item.slot] = item;
    this.onChange?.();
    return true;
  }

  unequip(slot: EquipSlot) {
    this.equipped[slot] = null;
    this.onChange?.();
  }

  getEquipped(slot: EquipSlot): InventoryItem | null {
    return this.equipped[slot];
  }

  /** Get all items, grouped by slot */
  getItemsBySlot(slot: EquipSlot): InventoryItem[] {
    const result: InventoryItem[] = [];
    for (const item of this.items.values()) {
      if (item.slot === slot && item.count > 0) result.push(item);
    }
    return result;
  }

  /** Get every item currently held (any slot), in insertion order */
  getAllItems(): InventoryItem[] {
    return [...this.items.values()].filter(item => item.count > 0);
  }

  /** Get total item count */
  getTotalCount(): number {
    let total = 0;
    for (const item of this.items.values()) total += item.count;
    return total;
  }
}

// ===================== 3D Equipment Meshes =====================

export function createEquipMesh(item: InventoryItem): THREE.Group | null {
  if (!item.meshType) return null;
  // Wing styles are animated rigs rather than static meshes
  const wingStyle = WING_STYLES[item.meshType];
  if (wingStyle) return buildWingRig(wingStyle).group;

  const group = new THREE.Group();
  const color = item.color ?? 0xFFFFFF;
  const mat = toonMat(color);

  switch (item.meshType) {
    case 'beret': {
      const beret = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      beret.scale.set(1.2, 0.5, 1.0);
      beret.position.y = 0.1;
      group.add(beret);
      const nub = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), mat);
      nub.position.set(0, 0.25, 0);
      group.add(nub);
      break;
    }
    case 'crown': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.12, 16), mat);
      base.position.y = 0.06;
      group.add(base);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 4), mat);
        spike.position.set(Math.cos(a) * 0.26, 0.18, Math.sin(a) * 0.26);
        group.add(spike);
        const gem = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), toonMat(0xFF0000));
        gem.position.set(Math.cos(a) * 0.26, 0.12, Math.sin(a) * 0.26);
        group.add(gem);
      }
      break;
    }
    case 'wreath': {
      const torus = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.06, 8, 16), toonMat(0x228B22));
      torus.rotation.x = Math.PI / 2;
      torus.position.y = 0.15;
      group.add(torus);
      const flowerColors = [0xFF69B4, 0xFFD700, 0xFF6347, 0xDDA0DD];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const flower = new THREE.Mesh(
          new THREE.SphereGeometry(0.05, 6, 4),
          toonMat(flowerColors[i % 4]),
        );
        flower.position.set(Math.cos(a) * 0.28, 0.18, Math.sin(a) * 0.28);
        group.add(flower);
      }
      break;
    }
    case 'wizard': {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.6, 8), mat);
      cone.position.y = 0.4;
      group.add(cone);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 16), mat);
      brim.position.y = 0.02;
      group.add(brim);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), toonMat(0xFFD700));
      star.position.set(0.15, 0.5, 0);
      group.add(star);
      break;
    }
    case 'straw': {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 16), mat);
      brim.position.y = 0.02;
      group.add(brim);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      dome.position.y = 0.03;
      group.add(dome);
      const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.02, 6, 16), toonMat(0xCC2222));
      ribbon.rotation.x = Math.PI / 2;
      ribbon.position.y = 0.08;
      group.add(ribbon);
      break;
    }
    case 'party': {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 8), mat);
      cone.position.y = 0.3;
      cone.rotation.z = 0.15;
      group.add(cone);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), toonMat(0xFFFFFF));
      pom.position.set(0, 0.52, 0);
      group.add(pom);
      break;
    }
    case 'glasses': {
      const frameMat = toonMat(color);
      for (const side of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 12), frameMat);
        lens.position.set(side * 0.12, 0, 0);
        group.add(lens);
        const lensFill = new THREE.Mesh(
          new THREE.CircleGeometry(0.09, 12),
          toonMat(0x222222, { transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
        );
        lensFill.position.set(side * 0.12, 0, 0.01);
        group.add(lensFill);
      }
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.06, 4), frameMat);
      bridge.rotation.z = Math.PI / 2;
      bridge.position.y = 0;
      group.add(bridge);
      break;
    }
    case 'monocle': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 12), mat);
      ring.position.set(0.12, 0, 0);
      group.add(ring);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.3, 4), toonMat(0xDAA520));
      chain.position.set(0.12, -0.15, 0);
      group.add(chain);
      break;
    }
    case 'star_mask': {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), mat);
      star.scale.set(1.5, 0.8, 0.3);
      group.add(star);
      break;
    }
    case 'cat_mask': {
      const mask = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mat);
      mask.scale.set(1.5, 0.6, 0.3);
      group.add(mask);
      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), mat);
        ear.position.set(side * 0.18, 0.12, 0);
        group.add(ear);
      }
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: 0x222222 }));
        eye.position.set(side * 0.08, 0.03, -0.06);
        group.add(eye);
      }
      break;
    }
    case 'cape': {
      const capeGeo = new THREE.PlaneGeometry(0.6, 0.8, 4, 6);
      const cape = new THREE.Mesh(capeGeo, toonMat(color, { side: THREE.DoubleSide }));
      cape.position.set(0, -0.1, 0.35);
      cape.rotation.x = 0.2;
      group.add(cape);
      break;
    }
    case 'bow_back': {
      for (const side of [-1, 1]) {
        const loop = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12), mat);
        loop.position.set(side * 0.1, 0, 0.15);
        loop.rotation.y = side * 0.3;
        group.add(loop);
      }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), mat);
      knot.position.set(0, 0, 0.15);
      group.add(knot);
      break;
    }
    case 'jetpack': {
      const bodyMat = toonMat(color);
      for (const side of [-1, 1]) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8), bodyMat);
        tank.position.set(side * 0.15, 0, 0.2);
        group.add(tank);
        const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 6), toonMat(0xFF4500));
        nozzle.position.set(side * 0.15, -0.25, 0.2);
        group.add(nozzle);
      }
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.1), bodyMat);
      frame.position.set(0, 0.1, 0.2);
      group.add(frame);
      break;
    }
    case 'balloon': {
      const string = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, 1.0, 4),
        toonMat(0xCCCCCC),
      );
      string.position.set(0.4, 0.5, 0);
      group.add(string);
      const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat);
      balloon.position.set(0.4, 1.1, 0);
      balloon.scale.set(1, 1.2, 1);
      group.add(balloon);
      break;
    }
    case 'lantern': {
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.06, 0.01, 4, 8),
        toonMat(0x888888),
      );
      handle.position.set(0.4, 0.3, 0);
      group.add(handle);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8), mat);
      body.position.set(0.4, 0.15, 0);
      group.add(body);
      const glow = new THREE.PointLight(0xFF6347, 0.5, 3);
      glow.position.set(0.4, 0.15, 0);
      group.add(glow);
      break;
    }
    case 'wand': {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.5, 6), mat);
      stick.position.set(0.4, 0.2, 0);
      stick.rotation.z = -0.3;
      group.add(stick);
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), toonMat(0xFFD700, { emissive: 0xFFD700, emissiveIntensity: 0.5 }));
      tip.position.set(0.45, 0.48, 0);
      group.add(tip);
      const glow = new THREE.PointLight(0xFFD700, 0.3, 2);
      glow.position.set(0.45, 0.48, 0);
      group.add(glow);
      break;
    }
    default:
      return null;
  }
  return group;
}

// ===================== Inventory UI =====================

export class InventoryUI {
  private container: HTMLElement | null = null;
  private visible = false;
  private inventory: Inventory;
  private selectedSlot: EquipSlot = 'hat';
  private selectedIndex = 0;
  onClose?: () => void;

  constructor(inventory: Inventory) {
    this.inventory = inventory;
  }

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  show() {
    this.visible = true;
    this.render();
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.onClose?.();
  }

  isVisible(): boolean { return this.visible; }

  handleKey(key: string): boolean {
    if (!this.visible) return false;
    const slots: EquipSlot[] = ['hat', 'face', 'back', 'wings', 'held'];
    const items = this.inventory.getAllItems();

    if (key === 'Escape' || key === 'KeyI' || key === 'KeyQ') {
      this.hide();
      return true;
    }
    // Tab cycles the highlighted equipment slot
    if (key === 'Tab') {
      const idx = slots.indexOf(this.selectedSlot);
      this.selectedSlot = slots[(idx + 1) % slots.length];
      this.render();
      return true;
    }
    // Navigate the item grid
    if (key === 'ArrowLeft' || key === 'KeyA') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.render();
      return true;
    }
    if (key === 'ArrowRight' || key === 'KeyD') {
      this.selectedIndex = Math.min(items.length - 1, this.selectedIndex + 1);
      this.render();
      return true;
    }
    // Equip / unequip the selected item
    if (key === 'Enter' || key === 'KeyE') {
      const item = items[this.selectedIndex];
      if (item?.slot) {
        if (this.inventory.getEquipped(item.slot)?.id === item.id) {
          this.inventory.unequip(item.slot);
        } else {
          this.inventory.equip(item.id);
          this.selectedSlot = item.slot;
        }
        this.render();
      }
      return true;
    }
    // Unequip the highlighted slot
    if (key === 'KeyR') {
      this.inventory.unequip(this.selectedSlot);
      this.render();
      return true;
    }
    return false;
  }

  private render() {
    if (this.container) this.container.remove();

    const slots: { id: EquipSlot; label: string; icon: string }[] = [
      { id: 'hat',   label: '头部',  icon: '🎩' },
      { id: 'face',  label: '面部',  icon: '👓' },
      { id: 'back',  label: '背部',  icon: '🦸' },
      { id: 'wings', label: '翅膀',  icon: '🪽' },
      { id: 'held',  label: '手持',  icon: '🎈' },
    ];

    const items = this.inventory.getAllItems();
    if (this.selectedIndex >= items.length) this.selectedIndex = Math.max(0, items.length - 1);

    this.container = document.createElement('div');
    this.container.id = 'inventory-ui';
    this.container.innerHTML = `
      <style>
        #inventory-ui {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          z-index: 100; pointer-events: all;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(6px);
          font-family: 'Segoe UI', 'PingFang SC', sans-serif;
        }
        .inv-panel {
          background: linear-gradient(135deg, #f2f5ff, #e6ecff);
          border-radius: 18px;
          width: 600px;
          max-height: 86vh;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.35);
          border: 2px solid rgba(150,170,255,0.45);
          display: flex; flex-direction: column;
        }
        .inv-header {
          padding: 13px 18px;
          background: linear-gradient(135deg, #c8d6ff, #b0c4ff);
          border-bottom: 2px solid rgba(150,170,255,0.35);
          display: flex; align-items: center; gap: 12px;
        }
        .inv-title { font-size: 19px; font-weight: 700; color: #2d3555; }
        .inv-capacity { margin-left: auto; font-size: 13px; color: #55618c; }
        .inv-close {
          width: 30px; height: 30px; flex: none;
          border-radius: 9px;
          border: 1px solid rgba(120,90,160,0.3);
          background: rgba(255,255,255,0.55);
          color: #5a4a7a; font-size: 15px; font-weight: 700; line-height: 1;
          cursor: pointer; transition: all 0.15s;
        }
        .inv-close:hover {
          background: rgba(255,100,100,0.9); color: #fff; border-color: transparent;
        }
        .inv-body { display: flex; gap: 16px; padding: 14px 18px; overflow: hidden; }
        .inv-section-title {
          font-size: 12px; font-weight: 700; color: #66739c;
          letter-spacing: 2px; margin-bottom: 8px;
        }
        .inv-equip { flex: 0 0 152px; }
        .inv-equip-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .inv-eq-slot {
          position: relative; aspect-ratio: 1 / 1;
          border-radius: 12px;
          background: rgba(255,255,255,0.45);
          border: 2px dashed rgba(140,160,220,0.55);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 3px; cursor: pointer; transition: all 0.15s; user-select: none;
        }
        .inv-eq-slot:hover { background: rgba(255,255,255,0.8); }
        .inv-eq-slot.filled {
          border-style: solid; border-color: rgba(110,165,255,0.75);
          background: rgba(202,222,255,0.6);
        }
        .inv-eq-slot.active { box-shadow: 0 0 0 3px rgba(100,140,255,0.4); }
        .inv-eq-icon { font-size: 25px; opacity: 0.32; }
        .inv-eq-slot.filled .inv-eq-icon { opacity: 1; }
        .inv-eq-label { font-size: 10px; color: #66739c; }
        .inv-bag { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .inv-grid {
          display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px;
          align-content: start;
          overflow-y: auto; padding-right: 4px; max-height: 42vh;
        }
        .inv-tile {
          position: relative; aspect-ratio: 1 / 1;
          border-radius: 12px;
          background: rgba(255,255,255,0.55);
          border: 2px solid rgba(180,195,235,0.7);
          display: flex; align-items: center; justify-content: center;
          font-size: 26px; cursor: pointer; transition: all 0.15s; user-select: none;
        }
        .inv-tile:hover {
          background: #fff; transform: translateY(-2px);
          box-shadow: 0 6px 14px rgba(80,110,200,0.28);
        }
        .inv-tile.selected { border-color: rgba(90,130,255,0.95); box-shadow: 0 0 0 3px rgba(100,140,255,0.3); }
        .inv-tile.equipped { border-color: rgba(70,190,110,0.95); background: rgba(216,250,226,0.8); }
        .inv-tile.collectible { background: rgba(255,250,235,0.8); border-color: rgba(228,203,150,0.9); }
        .inv-tile-count {
          position: absolute; right: 3px; bottom: 2px;
          font-size: 10px; font-weight: 700; color: #55618c;
          background: rgba(255,255,255,0.9); border-radius: 6px; padding: 0 4px;
        }
        .inv-tile-eq {
          position: absolute; left: 3px; top: 3px;
          width: 15px; height: 15px; border-radius: 50%;
          background: #46be6e; color: #fff; font-size: 10px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
        }
        .inv-empty { text-align: center; padding: 34px 10px; color: #9aa4c4; font-size: 13px; line-height: 1.7; }
        .inv-info {
          display: flex; align-items: baseline; gap: 10px;
          padding: 10px 18px; min-height: 46px;
          background: rgba(255,255,255,0.5);
          border-top: 1px solid rgba(150,170,255,0.3);
          font-size: 13px; color: #55618c;
        }
        .inv-info b { color: #2d3555; font-size: 14px; white-space: nowrap; }
        .inv-footer {
          padding: 8px 18px;
          background: rgba(200,214,255,0.35);
          border-top: 1px solid rgba(150,170,255,0.25);
          font-size: 12px; color: #66739c;
        }
        .inv-footer kbd {
          background: rgba(0,0,0,0.08); border-radius: 4px;
          padding: 2px 7px; font-family: monospace; font-size: 11px;
          margin: 0 1px;
        }
      </style>
      <div class="inv-panel">
        <div class="inv-header">
          <span class="inv-title">🎒 物品栏</span>
          <span class="inv-capacity">共 ${this.inventory.getTotalCount()} 件</span>
          <button class="inv-close" id="inv-close" title="关闭 (I)">✕</button>
        </div>
        <div class="inv-body">
          <div class="inv-equip">
            <div class="inv-section-title">装备栏</div>
            <div class="inv-equip-grid">
              ${slots.map(s => {
                const eq = this.inventory.getEquipped(s.id);
                return `
                  <div class="inv-eq-slot ${s.id === this.selectedSlot ? 'active' : ''} ${eq ? 'filled' : ''}"
                       data-slot="${s.id}"
                       title="${eq ? escapeHtml(eq.name) + '（点击卸下）' : s.label}">
                    <span class="inv-eq-icon">${eq ? escapeHtml(eq.icon) : s.icon}</span>
                    <span class="inv-eq-label">${s.label}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          <div class="inv-bag">
            <div class="inv-section-title">背包</div>
            ${items.length === 0 ? `
              <div class="inv-empty">
                背包空空如也<br>
                去商店购买、开宝箱，或在野外捡装备吧！
              </div>
            ` : `
              <div class="inv-grid">
                ${items.map((item, i) => {
                  const equipped = item.slot
                    ? this.inventory.getEquipped(item.slot)?.id === item.id
                    : false;
                  const collectible = !item.slot;
                  return `
                    <div class="inv-tile ${i === this.selectedIndex ? 'selected' : ''} ${equipped ? 'equipped' : ''} ${collectible ? 'collectible' : ''}"
                         data-index="${i}" data-id="${item.id}"
                         title="${escapeHtml(item.name)}">
                      <span>${escapeHtml(item.icon)}</span>
                      ${item.count > 1 ? `<span class="inv-tile-count">x${item.count}</span>` : ''}
                      ${equipped ? `<span class="inv-tile-eq">✓</span>` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>
        <div class="inv-info" id="inv-info"></div>
        <div class="inv-footer">
          <span><kbd>A</kbd><kbd>D</kbd> 选择 · <kbd>E</kbd> 装备/卸下 · <kbd>点击</kbd> 装备 · <kbd>R</kbd> 卸下 · <kbd>I</kbd> 关闭</span>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    // Close button
    this.container.querySelector('#inv-close')?.addEventListener('click', () => this.hide());

    // Equipment slots: click to select the slot, or unequip if it holds something
    this.container.querySelectorAll('.inv-eq-slot').forEach(el => {
      el.addEventListener('click', () => {
        const slot = (el as HTMLElement).dataset.slot as EquipSlot;
        this.selectedSlot = slot;
        if (this.inventory.getEquipped(slot)) this.inventory.unequip(slot);
        this.render();
      });
    });

    // Item tiles: click to equip / unequip, hover to preview the name
    this.container.querySelectorAll('.inv-tile').forEach(el => {
      const index = parseInt((el as HTMLElement).dataset.index ?? '0');
      const item = items[index];
      el.addEventListener('mouseenter', () => this.showInfo(item));
      el.addEventListener('click', () => {
        this.selectedIndex = index;
        if (!item.slot) {
          // Collectible: just select it, nothing to wear
          this.render();
          return;
        }
        if (this.inventory.getEquipped(item.slot)?.id === item.id) {
          this.inventory.unequip(item.slot);
        } else {
          this.inventory.equip(item.id);
          this.selectedSlot = item.slot;
        }
        this.render();
      });
    });

    const grid = this.container.querySelector('.inv-grid');
    grid?.addEventListener('mouseleave', () => this.showInfo(items[this.selectedIndex]));

    this.showInfo(items[this.selectedIndex]);
  }

  /** Update the info strip with the given item (or the empty-bag hint) */
  private showInfo(item: InventoryItem | undefined) {
    const el = this.container?.querySelector('#inv-info');
    if (!el) return;
    if (!item) {
      el.textContent = '背包空空如也';
      return;
    }
    const hint = item.slot ? '点击装备' : '收集品 · 只能出售';
    el.innerHTML = `<b>${escapeHtml(item.icon)} ${escapeHtml(item.name)}</b>`
      + `<span>${escapeHtml(item.description)}</span>`
      + `<span style="margin-left:auto;color:#8a93b5;font-size:12px;white-space:nowrap;">${hint}</span>`;
  }
}

export { EQUIP_DEFS };
