import * as THREE from 'three';
import { toonMat } from '../utils/colors';
import { seededRandom } from '../utils/math';
import { EQUIP_DEFS } from './Inventory';

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

const RARITY_COLORS: Record<Rarity, number> = {
  common: 0xBBBBBB,
  uncommon: 0x2ECC71,
  rare: 0x3498DB,
  epic: 0x9B59B6,
  legendary: 0xFFD700,
};

const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 50, uncommon: 25, rare: 15, epic: 8, legendary: 2,
};

interface WildDrop { id: string; rarity: Rarity; }

// Equipment that can be found lying around the world (ids must exist in EQUIP_DEFS).
const WILD_DROPS: WildDrop[] = [
  { id: 'hat_red', rarity: 'common' },
  { id: 'hat_straw', rarity: 'common' },
  { id: 'glasses', rarity: 'common' },
  { id: 'bow', rarity: 'common' },
  { id: 'balloon', rarity: 'common' },
  { id: 'lantern', rarity: 'common' },
  { id: 'wand', rarity: 'uncommon' },
  { id: 'hat_flower', rarity: 'uncommon' },
  { id: 'monocle', rarity: 'uncommon' },
  { id: 'mask_cat', rarity: 'uncommon' },
  { id: 'hat_party', rarity: 'rare' },
  { id: 'mask_star', rarity: 'rare' },
  { id: 'jetpack', rarity: 'epic' },
  { id: 'cape', rarity: 'epic' },
  { id: 'wings', rarity: 'epic' },
  { id: 'hat_wizard', rarity: 'epic' },
  { id: 'fairy_wings', rarity: 'rare' },
  { id: 'demon_wings', rarity: 'epic' },
  { id: 'dragon_wings', rarity: 'epic' },
  { id: 'hat_crown', rarity: 'legendary' },
  { id: 'angel_wings', rarity: 'legendary' },
  { id: 'rainbow_wings', rarity: 'legendary' },
];

// Hand-picked spots spread across the map, away from the lake and the houses.
const SPOTS: [number, number][] = [
  [-60, -60], [0, -50], [60, -60], [-70, 10], [70, 20], [-50, 60],
  [10, 70], [55, 55], [-15, -55], [45, -40], [-60, -10], [25, 45],
];

const RESPAWN_SECONDS = 60;
const PICKUP_RANGE = 1.2;

function rollDrop(rng: () => number): WildDrop {
  const total = WILD_DROPS.reduce((sum, d) => sum + RARITY_WEIGHT[d.rarity], 0);
  let r = rng() * total;
  for (const drop of WILD_DROPS) {
    r -= RARITY_WEIGHT[drop.rarity];
    if (r <= 0) return drop;
  }
  return WILD_DROPS[0];
}

/** A piece of equipment lying in the world. Walk over it to pick it up. */
export class WildPickup {
  group: THREE.Group;
  drop: WildDrop;
  x: number;
  z: number;
  active = true;
  private baseY: number;
  private respawnTimer = 0;
  private bobPhase: number;

  constructor(x: number, z: number, drop: WildDrop, getHeight: (x: number, z: number) => number) {
    this.x = x;
    this.z = z;
    this.drop = drop;
    this.baseY = getHeight(x, z) + 0.6;
    this.bobPhase = Math.random() * Math.PI * 2;

    this.group = new THREE.Group();
    this.group.position.set(x, this.baseY, z);
    const color = RARITY_COLORS[drop.rarity];

    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      toonMat(color, { emissive: color, emissiveIntensity: 0.45 }),
    );
    gem.scale.set(1, 1.4, 1);
    gem.castShadow = true;
    this.group.add(gem);

    const ringGeo = new THREE.RingGeometry(0.4, 0.52, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
      }),
    );
    ring.position.y = -0.55;
    this.group.add(ring);
  }

  /** Returns true on the frame the player picks this up. */
  update(dt: number, playerPos: THREE.Vector3): boolean {
    if (!this.active) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.active = true;
        this.group.visible = true;
      }
      return false;
    }

    this.group.rotation.y += dt * 1.2;
    this.group.position.y = this.baseY + Math.sin(performance.now() * 0.002 + this.bobPhase) * 0.12;

    const dx = playerPos.x - this.x;
    const dz = playerPos.z - this.z;
    if (dx * dx + dz * dz < PICKUP_RANGE * PICKUP_RANGE) {
      this.active = false;
      this.respawnTimer = RESPAWN_SECONDS;
      this.group.visible = false;
      return true;
    }
    return false;
  }
}

export interface WildPickupCollected {
  id: string;
  x: number;
  y: number;
  z: number;
}

export class WildPickupManager {
  pickups: WildPickup[] = [];

  constructor(getHeight: (x: number, z: number) => number) {
    const rng = seededRandom(20240912);
    for (const [x, z] of SPOTS) {
      let drop = rollDrop(rng);
      // Guard against ids that aren't real equipment (would be dropped by Inventory.addItem)
      if (!EQUIP_DEFS[drop.id]) drop = WILD_DROPS[0];
      this.pickups.push(new WildPickup(x, z, drop, getHeight));
    }
  }

  /** Returns everything collected this frame. */
  update(dt: number, playerPos: THREE.Vector3): WildPickupCollected[] {
    const collected: WildPickupCollected[] = [];
    for (const p of this.pickups) {
      if (p.update(dt, playerPos)) {
        collected.push({ id: p.drop.id, x: p.x, y: p.group.position.y, z: p.z });
      }
    }
    return collected;
  }

  addToScene(scene: THREE.Scene) {
    for (const p of this.pickups) scene.add(p.group);
  }
}
