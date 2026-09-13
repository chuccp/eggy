import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonMat } from '../utils/colors';
import { worldPos } from '../utils/math';
import type { Collider } from './Terrain';

export interface HouseDef {
  name: string;
  x: number;
  z: number;
  angle: number;
  width: number;
  depth: number;
  height: number;
  wallColor: number;
  roofColor: number;
  doorWidth: number;
  doorHeight: number;
  interior: InteriorItem[];
  exterior: ExteriorDecor[];
  shopType?: string;
  icon?: string;
}

export interface InteriorItem {
  type: string;
  x: number; z: number; y?: number;
  color?: number;
  label?: string;
}

export interface ExteriorDecor {
  type: string;
  x: number; z: number;
  color?: number;
  scale?: number;
}

/** A bed inside a house, resolved to world space so the player can lie on it. */
export interface BedSpot {
  x: number; z: number;     // bed centre (where the character lies down)
  y: number;                // mattress top
  yaw: number;              // along the bed's long axis
  standX: number;           // where the character stands after getting up
  standZ: number;
}

export interface BuiltHouse {
  def: HouseDef;
  group: THREE.Group;
  doorWorldPos: THREE.Vector3;
  doorForward: THREE.Vector3;
  beds: BedSpot[];
}

/** A static box standing in for one roof slope, so the player can land on the roof. */
export interface RoofSlope {
  x: number; y: number; z: number;
  halfX: number; halfY: number; halfZ: number;
  rotY: number; rotZ: number;
}

// Roof shape constants — shared by the visible mesh and its collision box so the two
// can never drift apart.
const ROOF_RISE = 2.2;      // ridge height above the eaves
const ROOF_OVERHANG = 0.6;  // how far the eaves stick out past the walls
const ROOF_SLAB_HALF = 0.5; // half thickness of the collision slab (1m of solid roof)

// ===================== House definitions =====================

const HOUSE_DEFS: HouseDef[] = [
  {
    name: '温馨小屋', x: 15, z: 15, angle: -Math.PI / 4,
    width: 5, depth: 3.5, height: 3.8,
    wallColor: 0xFFF5E6, roofColor: 0xD2691E,
    doorWidth: 2.2, doorHeight: 2.5,
    icon: '🏠',
    interior: [
      { type: 'sofa', x: -3.5, z: -0.5, color: 0x6B8E9B },
      { type: 'tv', x: 4, z: -0.5 },
      { type: 'table', x: 0, z: -0.5, color: 0xC19A6B },
      { type: 'rug', x: 0, z: -0.5, color: 0xE8B4B8 },
      { type: 'bed', x: 3.5, z: -2, color: 0xA0522D },
      { type: 'bookshelf', x: -3.8, z: -2.5, color: 0x8B6914 },
      { type: 'lamp', x: -3.5, z: 1.5, color: 0xFFE4B5 },
      { type: 'picture', x: 0.5, z: -3.3, color: 0x87CEEB },
    ],
    exterior: [
      { type: 'flower_row', x: 0, z: 7, color: 0xFF69B4 },
      { type: 'mailbox', x: -5.5, z: 0, color: 0x4169E1 },
      { type: 'welcome_mat', x: 0, z: 4 },
      { type: 'chimney', x: 2, z: -1 },
      { type: 'garden_light', x: 5.5, z: 6, color: 0xFFE4B5 },
      { type: 'garden_light', x: -5.5, z: 6, color: 0xFFE4B5 },
    ],
  },
  {
    name: '甜蜜面包店', x: -20, z: 20, angle: Math.PI / 6,
    width: 4.5, depth: 4, height: 4,
    wallColor: 0xFFE4C4, roofColor: 0xCD853F,
    doorWidth: 2.4, doorHeight: 2.8,
    icon: '🍞',
    shopType: 'bakery',
    interior: [
      { type: 'counter', x: 0, z: -2, color: 0xDEB887, label: '面包柜台' },
      { type: 'display_case', x: -2.5, z: -1, color: 0xE8D5B7, label: '甜点展示柜' },
      { type: 'table', x: 2.5, z: 1, color: 0xC19A6B },
      { type: 'chair', x: 2.5, z: 2, color: 0xA0522D },
      { type: 'chair', x: 3.5, z: 1, color: 0xA0522D },
      { type: 'shelf', x: -3.5, z: -2, color: 0x8B6914 },
      { type: 'oven', x: 3, z: -3, color: 0x666666 },
      { type: 'lamp', x: 0, z: 0, color: 0xFFF5E6 },
    ],
    exterior: [
      { type: 'awning', x: 0, z: 4, color: 0xFF6B6B },
      { type: 'sign', x: 0, z: 6, color: 0xFFD700, scale: 1.2 },
      { type: 'flower_pot', x: 4, z: 5, color: 0xFF69B4 },
      { type: 'flower_pot', x: -4, z: 5, color: 0xFFD700 },
      { type: 'bench_ext', x: 5, z: 2, color: 0xA0522D },
      { type: 'chimney', x: 1, z: -2 },
    ],
  },
  {
    name: '时尚服装店', x: 30, z: -20, angle: -Math.PI / 3,
    width: 5, depth: 4.5, height: 4.2,
    wallColor: 0xF0E6FF, roofColor: 0x9B59B6,
    doorWidth: 2.4, doorHeight: 2.8,
    icon: '👗',
    shopType: 'clothing',
    interior: [
      { type: 'rack', x: -3, z: -1, color: 0x888888, label: '衣架' },
      { type: 'rack', x: -3, z: 2, color: 0x888888, label: '衣架' },
      { type: 'mirror', x: 3.5, z: 0, color: 0xC0C0C0, label: '试衣镜' },
      { type: 'counter', x: 0, z: -3, color: 0xDEB887, label: '收银台' },
      { type: 'mannequin', x: 1, z: 1, color: 0xFFB3BA },
      { type: 'mannequin', x: -1, z: 1, color: 0xBAE1FF },
      { type: 'rug', x: 0, z: 0, color: 0xD8BFD8 },
      { type: 'lamp', x: 0, z: 0, color: 0xFFF0F5 },
    ],
    exterior: [
      { type: 'awning', x: 0, z: 4.5, color: 0x9B59B6 },
      { type: 'sign', x: 0, z: 7, color: 0xE8BAFF, scale: 1.2 },
      { type: 'flower_pot', x: 4.5, z: 6, color: 0xE8BAFF },
      { type: 'flower_pot', x: -4.5, z: 6, color: 0xFFB3BA },
      { type: 'garden_light', x: 5, z: 5, color: 0xE8BAFF },
      { type: 'garden_light', x: -5, z: 5, color: 0xE8BAFF },
    ],
  },
  {
    name: '家具小馆', x: -52, z: -34, angle: Math.PI / 3,
    width: 5.5, depth: 4, height: 3.5,
    wallColor: 0xF5DEB3, roofColor: 0x8B4513,
    doorWidth: 2.4, doorHeight: 2.6,
    icon: '🪑',
    shopType: 'furniture',
    interior: [
      { type: 'sofa', x: -3, z: 0, color: 0x6B8E9B },
      { type: 'table', x: 0, z: 0, color: 0xC19A6B },
      { type: 'chair', x: 3, z: 0, color: 0xA0522D },
      { type: 'shelf', x: -4, z: -2.5, color: 0x8B6914 },
      { type: 'counter', x: 0, z: -3, color: 0xDEB887, label: '收银台' },
      { type: 'lamp', x: 0, z: 0, color: 0xFFE4B5 },
      { type: 'rug', x: 0, z: 0, color: 0xDEB887 },
    ],
    exterior: [
      { type: 'awning', x: 0, z: 4, color: 0xCD853F },
      { type: 'sign', x: 0, z: 6.5, color: 0xFFD700, scale: 1.2 },
      { type: 'flower_row', x: 0, z: 7, color: 0xFF8C00 },
      { type: 'bench_ext', x: -5, z: 2, color: 0xA0522D },
    ],
  },
  {
    name: '冰淇淋小屋', x: -10, z: -35, angle: 0,
    width: 3.5, depth: 3, height: 3.5,
    wallColor: 0xFFE4E1, roofColor: 0xFF69B4,
    doorWidth: 2.2, doorHeight: 2.4,
    icon: '🍦',
    shopType: 'icecream',
    interior: [
      { type: 'counter', x: 0, z: -1.5, color: 0xFFB6C1, label: '冰淇淋柜台' },
      { type: 'display_case', x: -2, z: 0, color: 0xE8D5B7, label: '冰淇淋展示' },
      { type: 'table', x: 1.5, z: 1, color: 0xFFFFFF },
      { type: 'chair', x: 1.5, z: 2, color: 0xFFB3BA },
      { type: 'lamp', x: 0, z: 0, color: 0xFFF0F5 },
    ],
    exterior: [
      { type: 'awning', x: 0, z: 3, color: 0xFFB6C1 },
      { type: 'sign', x: 0, z: 5.5, color: 0xFFE66D, scale: 1 },
      { type: 'flower_pot', x: 3.5, z: 5, color: 0xFF69B4 },
      { type: 'flower_pot', x: -3.5, z: 5, color: 0xFFE66D },
      { type: 'garden_light', x: 3, z: 5, color: 0xFFB6C1 },
    ],
  },
];

// ===================== Builders =====================

function addWallMesh(parent: THREE.Group, w: number, h: number, x: number, y: number, z: number, ry: number, mat: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.15), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
}

function buildInteriorItem(group: THREE.Group, item: InteriorItem) {
  const { x, z } = item;
  const y = item.y ?? 0;

  switch (item.type) {
    case 'sofa': {
      const mat = toonMat(item.color ?? 0x6B8E9B);
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.3), mat);
      back.position.set(x, y + 0.65, z);
      group.add(back);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 0.6), mat);
      seat.position.set(x, y + 0.35, z + 0.35);
      group.add(seat);
      const cushionMat = toonMat(0xFFB3BA);
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.15, 0.12), cushionMat);
        c.position.set(x + (i - 1) * 0.65, y + 0.9, z + 0.1);
        group.add(c);
      }
      break;
    }
    case 'tv': {
      const standMat = toonMat(0xD2B48C);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.4), standMat);
      stand.position.set(x, y + 0.3, z);
      group.add(stand);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.06), toonMat(0x111111));
      screen.position.set(x, y + 1.0, z);
      group.add(screen);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.02), new THREE.MeshBasicMaterial({ color: 0x335577, transparent: true, opacity: 0.3 }));
      glow.position.set(x, y + 1.0, z + 0.04);
      group.add(glow);
      break;
    }
    case 'table': {
      const mat = toonMat(item.color ?? 0xC19A6B);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.6), mat);
      top.position.set(x, y + 0.42, z);
      group.add(top);
      for (const dx of [-0.4, 0.4]) {
        for (const dz of [-0.2, 0.2]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), mat);
          leg.position.set(x + dx, y + 0.2, z + dz);
          group.add(leg);
        }
      }
      break;
    }
    case 'rug': {
      const mat = toonMat(item.color ?? 0xE8B4B8, { side: THREE.DoubleSide });
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.0), mat);
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(x, y + 0.07, z);
      group.add(rug);
      break;
    }
    case 'bed': {
      const frameMat = toonMat(item.color ?? 0xA0522D);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 2.2), frameMat);
      frame.position.set(x, y + 0.2, z);
      group.add(frame);
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 2.0), toonMat(0xFFF5E6));
      mattress.position.set(x, y + 0.45, z);
      group.add(mattress);
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.4), toonMat(0xE8E8E8));
      pillow.position.set(x, y + 0.6, z - 0.7);
      group.add(pillow);
      const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.4), toonMat(0x95E1D3));
      blanket.position.set(x, y + 0.6, z + 0.3);
      group.add(blanket);
      const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, 0.1), frameMat);
      headboard.position.set(x, y + 0.7, z - 1.0);
      group.add(headboard);
      break;
    }
    case 'bookshelf': {
      const mat = toonMat(item.color ?? 0x8B6914);
      const unit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 0.35), mat);
      unit.position.set(x, y + 1.0, z);
      group.add(unit);
      for (let sy = 0; sy < 3; sy++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 0.3), mat);
        shelf.position.set(x, y + 0.6 + sy * 0.6, z);
        group.add(shelf);
      }
      const bookColors = [0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0x9B59B6, 0x3498DB];
      for (let sy = 0; sy < 3; sy++) {
        for (let bi = 0; bi < 4; bi++) {
          const book = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.35 + Math.random() * 0.15, 0.2),
            toonMat(bookColors[(sy * 4 + bi) % bookColors.length]),
          );
          book.position.set(x - 0.4 + bi * 0.22, y + 0.8 + sy * 0.6, z);
          group.add(book);
        }
      }
      break;
    }
    case 'lamp': {
      const lampMat = toonMat(0x333333);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12), lampMat);
      base.position.set(x, y + 0.05, z);
      group.add(base);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), lampMat);
      pole.position.set(x, y + 0.85, z);
      group.add(pole);
      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.3, 0.35, 12, 1, true),
        toonMat(item.color ?? 0xFFF5E6, { side: THREE.DoubleSide }),
      );
      shade.position.set(x, y + 1.7, z);
      group.add(shade);
      const light = new THREE.PointLight(item.color ?? 0xFFE4B5, 0.5, 5);
      light.position.set(x, y + 1.6, z);
      group.add(light);
      break;
    }
    case 'picture': {
      const darkWood = toonMat(0x8B4513);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.05), darkWood);
      frame.position.set(x, y + 2.2, z);
      group.add(frame);
      const pic = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.5),
        new THREE.MeshBasicMaterial({ color: item.color ?? 0x87CEEB }),
      );
      pic.position.set(x, y + 2.2, z + 0.03);
      group.add(pic);
      break;
    }
    case 'counter': {
      const mat = toonMat(item.color ?? 0xDEB887);
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.9, 0.6), mat);
      top.position.set(x, y + 0.45, z);
      group.add(top);
      const counterTop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.65), toonMat(0xF5F5DC));
      counterTop.position.set(x, y + 0.92, z);
      group.add(counterTop);
      break;
    }
    case 'display_case': {
      const glassMat = toonMat(0xCCDDEE, { transparent: true, opacity: 0.4 });
      const c = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.5), glassMat);
      c.position.set(x, y + 0.5, z);
      group.add(c);
      const baseMat = toonMat(item.color ?? 0xE8D5B7);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.55), baseMat);
      base.position.set(x, y + 0.05, z);
      group.add(base);
      break;
    }
    case 'shelf': {
      const mat = toonMat(item.color ?? 0x8B6914);
      const unit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.3), mat);
      unit.position.set(x, y + 0.75, z);
      group.add(unit);
      for (let sy = 0; sy < 3; sy++) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.25), mat);
        shelf.position.set(x, y + 0.3 + sy * 0.5, z);
        group.add(shelf);
      }
      break;
    }
    case 'oven': {
      const mat = toonMat(item.color ?? 0x666666);
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.8), mat);
      body.position.set(x, y + 0.5, z);
      group.add(body);
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.05), toonMat(0x222222));
      door.position.set(x, y + 0.4, z + 0.42);
      group.add(door);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), toonMat(0xCCCCCC));
      handle.rotation.z = Math.PI / 2;
      handle.position.set(x, y + 0.7, z + 0.45);
      group.add(handle);
      break;
    }
    case 'chair': {
      const mat = toonMat(item.color ?? 0xA0522D);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), mat);
      seat.position.set(x, y + 0.45, z);
      group.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), mat);
      back.position.set(x, y + 0.7, z - 0.22);
      group.add(back);
      for (const dx of [-0.2, 0.2]) {
        for (const dz of [-0.2, 0.2]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 4), mat);
          leg.position.set(x + dx, y + 0.22, z + dz);
          group.add(leg);
        }
      }
      break;
    }
    case 'rack': {
      const mat = toonMat(item.color ?? 0x888888);
      const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 6), mat);
      pole1.position.set(x, y + 1.0, z);
      group.add(pole1);
      const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0, 6), mat);
      pole2.position.set(x + 1.2, y + 1.0, z);
      group.add(pole2);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6), mat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(x + 0.6, y + 1.8, z);
      group.add(bar);
      const bar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6), mat);
      bar2.rotation.z = Math.PI / 2;
      bar2.position.set(x + 0.6, y + 1.2, z);
      group.add(bar2);
      const clothesColors = [0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0x9B59B6];
      for (let i = 0; i < 4; i++) {
        const shirt = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.4, 0.05),
          toonMat(clothesColors[i]),
        );
        shirt.position.set(x + 0.15 + i * 0.28, y + 1.4, z);
        group.add(shirt);
      }
      break;
    }
    case 'mirror': {
      const mirrorMat = toonMat(0xDDDDDD, { emissive: 0x444444, emissiveIntensity: 0.1 });
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.8), mirrorMat);
      mirror.position.set(x, y + 1.2, z);
      group.add(mirror);
      const frameMat = toonMat(0xD4AF37);
      for (const dz of [-0.38, 0.38]) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.05), frameMat);
        f.position.set(x, y + 1.2, z + dz);
        group.add(f);
      }
      break;
    }
    case 'mannequin': {
      const mat = toonMat(item.color ?? 0xFFB3BA);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 1.0, 8), mat);
      body.position.set(x, y + 0.7, z);
      group.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), mat);
      head.position.set(x, y + 1.35, z);
      group.add(head);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 12), toonMat(0x888888));
      base.position.set(x, y + 0.05, z);
      group.add(base);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), toonMat(0x888888));
      pole.position.set(x, y + 0.15, z);
      group.add(pole);
      break;
    }
  }
}

function buildExteriorDecor(group: THREE.Group, item: ExteriorDecor) {
  const { x, z } = item;

  switch (item.type) {
    case 'flower_row': {
      const colors = [item.color ?? 0xFF69B4, 0xFFD700, 0xFF6347];
      for (let i = 0; i < 8; i++) {
        const fx = x - 3.5 + i * 1;
        const fg = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), toonMat(colors[i % 3]));
        fg.position.set(fx, 0.15, z);
        group.add(fg);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), toonMat(0x228B22));
        stem.position.set(fx, 0, z);
        group.add(stem);
      }
      break;
    }
    case 'mailbox': {
      const mb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.25), toonMat(item.color ?? 0x4169E1));
      mb.position.set(x, 0.7, z);
      group.add(mb);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), toonMat(0x8B4513));
      post.position.set(x, 0.25, z);
      group.add(post);
      break;
    }
    case 'welcome_mat': {
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.6), toonMat(0xCD853F));
      mat.rotation.x = -Math.PI / 2;
      mat.position.set(x, 0.06, z);
      group.add(mat);
      break;
    }
    case 'chimney': {
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), toonMat(0xA0522D));
      chimney.position.set(x, 4.5, z);
      chimney.castShadow = true;
      group.add(chimney);
      break;
    }
    case 'garden_light': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.2, 6), toonMat(0x444444));
      pole.position.set(x, 0.6, z);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: item.color ?? 0xFFE4B5 }));
      bulb.position.set(x, 1.25, z);
      group.add(bulb);
      const light = new THREE.PointLight(item.color ?? 0xFFE4B5, 0.3, 4);
      light.position.set(x, 1.25, z);
      group.add(light);
      break;
    }
    case 'awning': {
      const awningMat = toonMat(item.color ?? 0xFF6B6B, { side: THREE.DoubleSide });
      const awning = new THREE.Mesh(new THREE.BoxGeometry(8, 0.05, 1.5), awningMat);
      awning.position.set(x, 2.8, z);
      awning.rotation.x = -0.15;
      awning.castShadow = true;
      group.add(awning);
      for (let i = 0; i < 3; i++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(8, 0.06, 0.3),
          toonMat(0xFFFFFF, { side: THREE.DoubleSide }),
        );
        stripe.position.set(x, 2.8, z + 0.3 - i * 0.45);
        stripe.rotation.x = -0.15;
        group.add(stripe);
      }
      break;
    }
    case 'sign': {
      const signMat = toonMat(item.color ?? 0xFFD700);
      const s = item.scale ?? 1;
      const signBoard = new THREE.Mesh(new THREE.BoxGeometry(1.5 * s, 0.6 * s, 0.08), signMat);
      signBoard.position.set(x, 3.2, z);
      group.add(signBoard);
      const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), toonMat(0x8B4513));
      signPost.position.set(x, 2.5, z);
      group.add(signPost);
      break;
    }
    case 'flower_pot': {
      const potMat = toonMat(0xCD853F);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.25, 8), potMat);
      pot.position.set(x, 0.12, z);
      group.add(pot);
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), toonMat(item.color ?? 0xFF69B4));
      flower.position.set(x, 0.35, z);
      group.add(flower);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 4), toonMat(0x228B22));
      stem.position.set(x, 0.2, z);
      group.add(stem);
      break;
    }
    case 'bench_ext': {
      const mat = toonMat(item.color ?? 0xA0522D);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.5), mat);
      seat.position.set(x, 0.45, z);
      group.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.06), mat);
      back.position.set(x, 0.7, z - 0.22);
      group.add(back);
      for (const lx of [-0.6, 0.6]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.06), mat);
        leg.position.set(x + lx, 0.225, z);
        group.add(leg);
      }
      break;
    }
  }
}

// ===================== Pixel Art Easter Egg =====================

/** 8×8 pixel art: a cute smiling egg face */
const PIXEL_ART_GRID: (number | null)[][] = [
  [null, null, 5,    5,    5,    5,    null, null],
  [null, 5,    1,    1,    1,    1,    5,    null],
  [5,    1,    2,    1,    1,    2,    1,    5   ],
  [5,    1,    1,    1,    1,    1,    1,    5   ],
  [5,    1,    1,    1,    1,    1,    1,    5   ],
  [5,    1,    3,    4,    4,    3,    1,    5   ],
  [null, 5,    1,    1,    1,    1,    5,    null],
  [null, null, 5,    5,    5,    5,    null, null],
];

const PIXEL_COLORS: Record<number, number> = {
  1: 0xFFFFBA, // egg body – yellow
  2: 0x222222, // eyes – dark
  3: 0xFF8888, // blush – pink
  4: 0x333333, // mouth – dark
  5: 0x8B6914, // outline – brown
};

function buildPixelArt(group: THREE.Group, wallLocalZ: number, centerX: number, centerY: number) {
  const pixelSize = 0.08;
  const gridW = PIXEL_ART_GRID[0].length;
  const gridH = PIXEL_ART_GRID.length;
  const startX = centerX - (gridW / 2) * pixelSize + pixelSize / 2;
  const startY = centerY - (gridH / 2) * pixelSize + pixelSize / 2;
  const z = wallLocalZ - 0.09; // just outside the wall surface

  for (let row = 0; row < gridH; row++) {
    for (let col = 0; col < gridW; col++) {
      const colorIdx = PIXEL_ART_GRID[row][col];
      if (colorIdx == null) continue;
      const mat = toonMat(PIXEL_COLORS[colorIdx]);
      const px = startX + col * pixelSize;
      const py = startY + row * pixelSize;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(pixelSize, pixelSize, 0.01), mat);
      mesh.position.set(px, py, z);
      group.add(mesh);
    }
  }
}

// ===================== Main class =====================

export class Houses {
  houses: BuiltHouse[] = [];
  shopHouses: BuiltHouse[] = [];
  /** World-space roof slabs; the caller registers these as physics bodies. */
  roofSlopes: RoofSlope[] = [];
  private sceneGroup: THREE.Group;

  constructor(
    private getHeight: (x: number, z: number) => number,
    private addColliderFn: (c: Collider) => void,
  ) {
    this.sceneGroup = new THREE.Group();
    for (const def of HOUSE_DEFS) {
      this.buildHouse(def);
    }
  }

  private buildHouse(def: HouseDef) {
    const { x: hx, z: hz, angle, width: W, depth: D, height: H } = def;
    const baseY = this.getHeight(hx, hz);
    const house = new THREE.Group();
    house.position.set(hx, baseY, hz);
    house.rotation.y = angle;

    const wallMat = toonMat(def.wallColor);
    const roofMat = toonMat(def.roofColor);
    const floorMat = toonMat(0xDEB887);
    const winMat = toonMat(0x87CEEB, { emissive: 0x87CEEB, emissiveIntensity: 0.15 });
    const darkWoodMat = toonMat(0x8B4513);
    const doorW = def.doorWidth;
    const doorH = def.doorHeight;

    // Everything static (structure + fixed interior + exterior) goes into one group and
    // is merged into a single geometry at the end — houses were ~70 draw calls each.
    const staticGroup = new THREE.Group();
    house.add(staticGroup);

    // ---- Foundation ----
    const stoneMat = toonMat(0x8B8682);
    const foundation = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 0.4, 0.3, D * 2 + 0.4), stoneMat);
    foundation.position.set(0, 0.15, 0);
    foundation.castShadow = true;
    foundation.receiveShadow = true;
    staticGroup.add(foundation);

    // ---- Floor ----
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, D * 2), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0.31;
    floorMesh.receiveShadow = true;
    staticGroup.add(floorMesh);

    // ---- Doorstep ----
    const pathMat = toonMat(0xC2B280);
    const doorstep = new THREE.Mesh(new THREE.BoxGeometry(doorW * 2, 0.15, 0.8), pathMat);
    doorstep.position.set(0, 0.075, D + 0.4);
    doorstep.receiveShadow = true;
    staticGroup.add(doorstep);

    // ---- Path connecting doorstep outward ----
    const pathGeo = new THREE.PlaneGeometry(2, 3);
    const pathPlane = new THREE.Mesh(pathGeo, pathMat);
    pathPlane.rotation.x = -Math.PI / 2;
    pathPlane.position.set(0, 0.01, D + 2.3);
    pathPlane.receiveShadow = true;
    staticGroup.add(pathPlane);

    // ---- Walls ----
    addWallMesh(staticGroup, W * 2, H, 0, H / 2, -D, 0, wallMat);
    addWallMesh(staticGroup, D * 2, H, -W, H / 2, 0, Math.PI / 2, wallMat);
    addWallMesh(staticGroup, D * 2, H, W, H / 2, 0, Math.PI / 2, wallMat);
    addWallMesh(staticGroup, W - doorW, H, -(W + doorW) / 2, H / 2, D, 0, wallMat);
    addWallMesh(staticGroup, W - doorW, H, (W + doorW) / 2, H / 2, D, 0, wallMat);

    // ---- No wall colliders — houses are fully open for entry ----

    // ---- Roof ----
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-W - ROOF_OVERHANG, 0);
    roofShape.lineTo(0, ROOF_RISE);
    roofShape.lineTo(W + ROOF_OVERHANG, 0);
    roofShape.lineTo(-W - ROOF_OVERHANG, 0);
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: D * 2 + 1, bevelEnabled: false });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, H, -(D + 0.5));
    roof.castShadow = true;
    staticGroup.add(roof);

    // Roof collision: one slab per slope, thick enough that a fast descent can't tunnel
    // through it. The centre is pushed down along the slope's outward normal so the slab's
    // top face sits exactly on the visible roof rather than half a thickness above it.
    const slopeAngle = Math.atan2(ROOF_RISE, W + ROOF_OVERHANG);
    const slopeLen = Math.hypot(W + ROOF_OVERHANG, ROOF_RISE);
    for (const side of [-1, 1] as const) {
      const run = W + ROOF_OVERHANG;
      const cx = side * (run / 2 - (ROOF_SLAB_HALF * ROOF_RISE) / slopeLen);
      const cy = H + ROOF_RISE / 2 - (ROOF_SLAB_HALF * run) / slopeLen;
      const [sx, sz] = worldPos(cx, 0, -angle, hx, hz);
      this.roofSlopes.push({
        x: sx, y: baseY + cy, z: sz,
        halfX: slopeLen / 2, halfY: ROOF_SLAB_HALF, halfZ: (D * 2 + 1) / 2,
        rotY: angle, rotZ: -side * slopeAngle,
      });
    }

    // ---- Door frame ----
    const postGeo = new THREE.BoxGeometry(0.15, doorH, 0.15);
    const postXOffset = doorW + 0.2;
    for (const dx of [-postXOffset, postXOffset]) {
      const post = new THREE.Mesh(postGeo, darkWoodMat);
      post.position.set(dx, doorH / 2, D + 0.08);
      staticGroup.add(post);
    }
    const header = new THREE.Mesh(new THREE.BoxGeometry(postXOffset * 2 + 0.15, 0.12, 0.2), darkWoodMat);
    header.position.set(0, doorH, D + 0.08);
    staticGroup.add(header);
    const overhang = new THREE.Mesh(new THREE.BoxGeometry(doorW * 2 + 1.0, 0.06, 0.6), roofMat);
    overhang.position.set(0, doorH + 0.12, D + 0.3);
    staticGroup.add(overhang);

    // ---- Side windows ----
    for (const side of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 1.0), winMat);
      win.position.set(side * (W - 0.05), 2.0, 0);
      staticGroup.add(win);
    }

    // ---- Interior ambient light ----
    const interiorLight = new THREE.PointLight(0xFFF5E6, 0.4, 8);
    interiorLight.position.set(0, 2.8, 0);
    house.add(interiorLight);

    // ---- Interior items ----
    // Build dynamic items (lamps with lights, display cases) directly into the house group;
    // build static items into a merge group for batched rendering.
    const DYNAMIC_TYPES = new Set(['lamp', 'display_case']);

    for (const item of def.interior) {
      if (DYNAMIC_TYPES.has(item.type)) {
        buildInteriorItem(house, item);
      } else {
        buildInteriorItem(staticGroup, item);
      }
    }

    // ---- Exterior decorations ----
    for (const item of def.exterior) {
      buildExteriorDecor(staticGroup, item);
    }

    // ---- Pixel art easter egg on back wall of 温馨小屋 ----
    if (def.name === '温馨小屋') {
      buildPixelArt(staticGroup, -D, 0, 2.0);
    }

    // Merge the whole static shell into one geometry (per-geometry materials kept)
    this.mergeStaticGroup(staticGroup);

    this.sceneGroup.add(house);

    // Compute door world position.
    // worldPos() rotates by -angle, so negate to match the group's rotation.y.
    const [doorWX, doorWZ] = worldPos(0, D + 1.5, -angle, hx, hz);
    const doorWorldPos = new THREE.Vector3(doorWX, baseY, doorWZ);
    const [fwdX, fwdZ] = worldPos(0, D + 3.0, -angle, hx, hz);
    const doorForward = new THREE.Vector3(fwdX - doorWX, 0, fwdZ - doorWZ).normalize();

    // Resolve beds to world space (mattress top sits ~0.55 above the floor).
    // worldPos() rotates by -angle, so negate to match the group's rotation.y.
    const beds: BedSpot[] = [];
    for (const item of def.interior) {
      if (item.type !== 'bed') continue;
      const [bedX, bedZ] = worldPos(item.x, item.z, -angle, hx, hz);
      const [standX, standZ] = worldPos(item.x - 1.4, item.z, -angle, hx, hz);
      beds.push({
        x: bedX, z: bedZ,
        y: baseY + 0.55,
        yaw: angle,
        standX, standZ,
      });
    }

    const built: BuiltHouse = { def, group: house, doorWorldPos, doorForward, beds };
    this.houses.push(built);
    if (def.shopType) {
      this.shopHouses.push(built);
    }
  }

  /**
   * Collapse a group's static meshes into one mesh per material.
   *
   * Merging by material (rather than keeping a group per source mesh) is what actually
   * reduces draw calls — each material group costs one draw call. Geometries are
   * normalised to non-indexed first, because mergeGeometries() refuses to mix indexed and
   * non-indexed inputs (ExtrudeGeometry, used for the roof, is non-indexed) and would
   * otherwise return null and silently drop the whole house.
   */
  private mergeStaticGroup(group: THREE.Group) {
    const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();

    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.updateMatrix();
      const material = Array.isArray(child.material) ? child.material[0] : child.material;
      let geo = child.geometry.clone();
      geo.applyMatrix4(child.matrix);
      if (geo.index) {
        const nonIndexed = geo.toNonIndexed();
        geo.dispose();
        geo = nonIndexed;
      }
      const bucket = byMaterial.get(material);
      if (bucket) bucket.push(geo);
      else byMaterial.set(material, [geo]);
    });

    group.clear();

    for (const [material, geometries] of byMaterial) {
      const merged = geometries.length > 1 ? mergeGeometries(geometries, false) : geometries[0];
      if (merged) {
        const mesh = new THREE.Mesh(merged, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      } else {
        // Never lose geometry: fall back to individual meshes for this material
        for (const geo of geometries) {
          const mesh = new THREE.Mesh(geo, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
        }
        continue;
      }
      if (geometries.length > 1) {
        for (const geo of geometries) geo.dispose();
      }
    }
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.sceneGroup);
  }

  /** Find the nearest house door within range */
  findNearDoor(px: number, pz: number, range = 3.5): { house: BuiltHouse; isShop: boolean; label: string } | null {
    let best: { house: BuiltHouse; isShop: boolean; label: string } | null = null;
    let bestDist = range;
    for (const h of this.houses) {
      const dx = px - h.doorWorldPos.x;
      const dz = pz - h.doorWorldPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        const shopLabel = h.def.shopType
          ? `按 E 进入 ${h.def.icon ?? ''} ${h.def.name}（商店）`
          : `按 E 进入 ${h.def.icon ?? ''} ${h.def.name}`;
        best = { house: h, isShop: !!h.def.shopType, label: shopLabel };
      }
    }
    return best;
  }

  /** Find the nearest bed within range */
  findNearBed(px: number, pz: number, range = 2.2): { house: BuiltHouse; bed: BedSpot } | null {
    let best: { house: BuiltHouse; bed: BedSpot } | null = null;
    let bestDist = range;
    for (const h of this.houses) {
      for (const bed of h.beds) {
        const dx = px - bed.x;
        const dz = pz - bed.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < bestDist) {
          bestDist = dist;
          best = { house: h, bed };
        }
      }
    }
    return best;
  }
}
