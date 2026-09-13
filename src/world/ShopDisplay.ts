import * as THREE from 'three';
import { toonMat } from '../utils/colors';
import { worldPos } from '../utils/math';
import { createEquipMesh, EQUIP_DEFS } from './Inventory';
import { SHOP_CATALOGS, type ShopItem } from './Shop';
import type { Houses } from './Houses';

/** How close the player must be to see a price tag / buy the item. */
const LABEL_RANGE = 5;
const BUY_RANGE = 1.7;
const COUNTER_RANGE = 1.5;
/**
 * Goods sit this far in front of the counter so the two zones never overlap:
 * standing at the counter gives you the sell prompt, stepping up to the goods the buy prompt.
 */
const DISPLAY_OFFSET = 2.4;

/** Simple stand-in model for goods that have no wearable mesh (food, furniture…). */
function placeholderMesh(id: string): THREE.Mesh {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffff;
  const hue = (hash % 360) / 360;
  const color = new THREE.Color().setHSL(hue, 0.55, 0.68).getHex();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), toonMat(color));
  mesh.position.y = 0.15;
  return mesh;
}

function labelSprite(item: ShopItem): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 240, 112, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(180,190,220,0.9)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#333';
  ctx.font = '30px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillText(item.icon, 128, 48);

  ctx.font = 'bold 22px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillStyle = '#2d3555';
  ctx.fillText(item.name.length > 7 ? item.name.slice(0, 7) + '…' : item.name, 128, 82);

  ctx.font = 'bold 22px "Segoe UI", "PingFang SC", sans-serif';
  ctx.fillStyle = '#B8860B';
  ctx.fillText(`💰 ${item.price}`, 128, 110);

  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false,
  }));
  sprite.scale.set(1.0, 0.5, 1);
  return sprite;
}

/** A single product sitting on a shop counter or rack. */
export class ShopDisplay {
  group: THREE.Group;
  item: ShopItem;
  x: number;
  z: number;
  private label: THREE.Sprite;

  constructor(item: ShopItem, x: number, y: number, z: number) {
    this.item = item;
    this.x = x;
    this.z = z;

    this.group = new THREE.Group();
    this.group.position.set(x, y, z);

    // Pedestal
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 0.1, 12),
      toonMat(0xE8D5B7),
    );
    pedestal.position.y = 0.05;
    pedestal.receiveShadow = true;
    this.group.add(pedestal);

    // The goods themselves
    const def = EQUIP_DEFS[item.id];
    const mesh = def ? createEquipMesh({ ...def, count: 1 }) : null;
    if (mesh) {
      mesh.position.y = 0.12;
      mesh.scale.setScalar(0.7);
      this.group.add(mesh);
    } else {
      const placeholder = placeholderMesh(item.id);
      placeholder.position.y = 0.12;
      placeholder.castShadow = true;
      this.group.add(placeholder);
    }

    this.label = labelSprite(item);
    this.label.position.set(0, 0.95, 0);
    this.label.visible = false;
    this.group.add(this.label);
  }

  isNear(px: number, pz: number, range = BUY_RANGE): boolean {
    return Math.hypot(px - this.x, pz - this.z) < range;
  }

  /** Price tag fades in as the player walks up. */
  setLabelVisible(visible: boolean) {
    this.label.visible = visible;
  }

  get interactLabel(): string {
    return `按 E 购买 ${this.item.icon} ${this.item.name}  💰${this.item.price}`;
  }
}

/** A shop's counter — walk up and press E to sell what you are carrying. */
export interface ShopCounter {
  x: number;
  z: number;
  shopType: string;
  name: string;
}

/**
 * Puts each shop's catalogue on the counter as physical goods, so buying happens by
 * walking up to an item and pressing E instead of through a menu.
 */
export class ShopDisplayManager {
  displays: ShopDisplay[] = [];
  counters: ShopCounter[] = [];

  constructor(houses: Houses) {
    for (const house of houses.houses) {
      const shopType = house.def.shopType;
      if (!shopType) continue;
      const catalog = SHOP_CATALOGS[shopType];
      if (!catalog || catalog.length === 0) continue;

      const { angle, x: hx, z: hz } = house.def;
      const baseY = house.group.position.y;

      // Prefer the counter as the display surface, else the first rack
      const anchors = house.def.interior.filter(i =>
        i.type === 'counter' || i.type === 'rack' || i.type === 'display_case');
      const anchor = anchors.find(i => i.type === 'counter') ?? anchors[0];
      if (!anchor) continue;

      // The counter itself is the sell point
      const [cx, cz] = worldPos(anchor.x, anchor.z, -angle, hx, hz);
      this.counters.push({ x: cx, z: cz, shopType, name: house.def.name });

      // Lay the goods out in rows on the counter, spacing 0.8, 5 per row
      const perRow = 5;
      catalog.forEach((item, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        const inRow = Math.min(perRow, catalog.length - row * perRow);
        const lx = anchor.x + (col - (inRow - 1) / 2) * 0.8;
        const lz = anchor.z + DISPLAY_OFFSET + row * 0.85;
        const [wx, wz] = worldPos(lx, lz, -angle, hx, hz);
        this.displays.push(new ShopDisplay(item, wx, baseY + 0.55, wz));
      });
    }
  }

  /** Nearest purchasable item within range. */
  findNear(px: number, pz: number): ShopDisplay | null {
    let best: ShopDisplay | null = null;
    let bestDist = BUY_RANGE;
    for (const d of this.displays) {
      const dist = Math.hypot(px - d.x, pz - d.z);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    }
    return best;
  }

  /** Nearest shop counter (used for selling). */
  findNearCounter(px: number, pz: number): ShopCounter | null {
    let best: ShopCounter | null = null;
    let bestDist = COUNTER_RANGE;
    for (const c of this.counters) {
      const dist = Math.hypot(px - c.x, pz - c.z);
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    return best;
  }

  /**
   * Only the item the player is standing at shows its price tag — showing a whole row
   * at once made the labels overlap into an unreadable pile.
   */
  update(playerPos: THREE.Vector3) {
    let nearest: ShopDisplay | null = null;
    let bestDist = LABEL_RANGE;
    for (const d of this.displays) {
      d.setLabelVisible(false);
      const dist = Math.hypot(playerPos.x - d.x, playerPos.z - d.z);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = d;
      }
    }
    nearest?.setLabelVisible(true);
  }

  addToScene(scene: THREE.Scene) {
    for (const d of this.displays) scene.add(d.group);
  }
}
