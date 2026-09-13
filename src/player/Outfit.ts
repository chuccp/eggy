import * as THREE from 'three';
import { COLORS, toonMat } from '../utils/colors';

export type OutfitShape = 'skirt' | 'tutu' | 'apron' | 'pants' | 'robe' | 'cape';
export type OutfitAccessory =
  | 'bow_back'
  | 'bow_front'
  | 'buttons'
  | 'flower'
  | 'headband'
  | 'none';

export interface OutfitStyle {
  id: string;
  shape: OutfitShape;
  color: number;   // main garment color
  trim: number;    // waistband / hem
  accessory: OutfitAccessory;
  accent: number;  // accessory color
}

// Each entry is a distinct look so no two egg characters dress alike.
export const OUTFITS: OutfitStyle[] = [
  // 0 — the player's pink dress with a bow
  { id: 'pink_bow',   shape: 'skirt',    color: COLORS.dress, trim: COLORS.dressTrim, accessory: 'bow_back',    accent: COLORS.bow },
  { id: 'blue_tutu',  shape: 'tutu',     color: 0x8FB4FF, trim: 0xE8F0FF, accessory: 'headband',    accent: 0x4D6EFF },
  { id: 'sun_pina',   shape: 'apron',    color: 0xFFE08F, trim: 0xFFF4D0, accessory: 'bow_front',   accent: 0xFF9E3D },
  { id: 'mint_over',  shape: 'pants',    color: 0x9BE8A8, trim: 0xDFF7E4, accessory: 'buttons',     accent: 0x3DA05A },
  { id: 'plum_robe',  shape: 'robe',     color: 0xC9A0FF, trim: 0xEADBFF, accessory: 'flower',      accent: 0xFFD700 },
  { id: 'tang_cape',  shape: 'cape',     color: 0xFFB07A, trim: 0xFFE3C8, accessory: 'bow_back',    accent: 0xE85D2A },
  { id: 'teal_skirt', shape: 'skirt',    color: 0x7FE0D4, trim: 0xDFFBF7, accessory: 'flower',      accent: 0xFF6B9D },
  { id: 'coral_tutu', shape: 'tutu',     color: 0xFF9F9F, trim: 0xFFE0E0, accessory: 'bow_front',   accent: 0xE8455A },
  { id: 'sky_pina',   shape: 'apron',    color: 0xB0D8FF, trim: 0xE8F4FF, accessory: 'buttons',     accent: 0x2E7DD1 },
  { id: 'cream_robe', shape: 'robe',     color: 0xE8E0D0, trim: 0xFFF8EE, accessory: 'headband',    accent: 0xC98A3D },
  { id: 'sage_over',  shape: 'pants',    color: 0xA0E8C0, trim: 0xE0FBF0, accessory: 'bow_back',    accent: 0x2FA86A },
  { id: 'lilac_cape', shape: 'cape',     color: 0xD8B8FF, trim: 0xF0E4FF, accessory: 'flower',      accent: 0xFF69B4 },
];

/** Radius of the egg body silhouette at height y (matches the LatheGeometry profile). */
function bodyRadius(y: number): number {
  const c = Math.max(-1, Math.min(1, -y / 0.65));
  const a = Math.acos(c);
  const t = a / Math.PI;
  return Math.sin(a) * (1 - 0.3 * (t - 0.5)) * 0.55;
}

/** Flared, open-ended garment piece (skirt / sleeve / robe). */
function flare(
  topR: number,
  botR: number,
  height: number,
  y: number,
  mat: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(topR, botR, height, 24, 1, true),
    mat,
  );
  mesh.position.y = y;
  mesh.castShadow = true;
  return mesh;
}

/** Front-surface radius of a garment at height y, so decorations sit on the cloth rather than sinking in. */
function garmentFrontRadius(shape: OutfitShape, y: number): number {
  const between = (yTop: number, yBot: number, rTop: number, rBot: number) => {
    const f = Math.max(0, Math.min(1, (yTop - y) / (yTop - yBot)));
    return rTop + f * (rBot - rTop);
  };
  switch (shape) {
    case 'pants':
      return between(-0.02, -0.36, 0.58, 0.7);
    case 'robe':
      return between(-0.01, -0.65, 0.55, 0.9);
    case 'apron':
      // Plus the apron overlay that sits outside the skirt
      return between(-0.02, -0.32, 0.57, 0.7) + 0.05;
    default:
      return between(-0.02, -0.32, 0.57, 0.7);
  }
}

/** Horizontal trim ring. */
function ring(radius: number, tube: number, y: number, mat: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 24), mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

/** Ribbon bow sitting on the garment at depth z (negative = front, positive = back). */
function bow(y: number, z: number, accent: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0, y, z);
  const mat = toonMat(accent);

  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat);
  g.add(knot);

  for (const side of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 8, 16), mat);
    loop.position.set(side * 0.14, 0, 0);
    loop.rotation.z = -side * 0.35;
    g.add(loop);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.03), mat);
    tail.position.set(side * 0.07, -0.2, 0);
    tail.rotation.z = side * 0.25;
    g.add(tail);
  }
  return g;
}

/**
 * Build the 3D outfit in character-local space, ready to attach to the egg body.
 * The character faces -Z, so negative z is the front.
 */
export function buildOutfit(style: OutfitStyle): THREE.Group {
  const group = new THREE.Group();
  const main = toonMat(style.color, { side: THREE.DoubleSide });
  const trim = toonMat(style.trim, { side: THREE.DoubleSide });

  switch (style.shape) {
    case 'skirt': {
      group.add(flare(0.57, 0.7, 0.3, -0.17, main));
      group.add(ring(0.57, 0.04, -0.02, trim));
      group.add(ring(0.7, 0.035, -0.32, trim));
      break;
    }
    case 'tutu': {
      const layers: [number, number, number, number][] = [
        [0.58, 0.72, 0.18, -0.17],
        [0.6, 0.8, 0.18, -0.31],
        [0.62, 0.88, 0.18, -0.45],
      ];
      layers.forEach(([topR, botR, h, y], i) => {
        group.add(flare(topR, botR, h, y, i % 2 === 0 ? main : trim));
      });
      break;
    }
    case 'apron': {
      group.add(flare(0.57, 0.7, 0.3, -0.17, main));
      group.add(ring(0.57, 0.04, -0.02, trim));
      group.add(ring(0.7, 0.035, -0.32, trim));
      // Apron panel draped over the front of the skirt (kept below the face)
      const apron = new THREE.Mesh(
        new THREE.CylinderGeometry(0.61, 0.73, 0.28, 12, 1, true, Math.PI - 0.55, 1.1),
        trim,
      );
      apron.position.y = -0.17;
      group.add(apron);
      break;
    }
    case 'pants': {
      group.add(flare(0.58, 0.7, 0.34, -0.19, main));
      group.add(ring(0.58, 0.04, -0.02, trim));
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.19, 0.24, 12, 1, true),
          main,
        );
        leg.position.set(side * 0.15, -0.44, -0.08);
        group.add(leg);
        const cuff = ring(0.18, 0.03, 0, trim);
        cuff.position.set(side * 0.15, -0.55, -0.08);
        group.add(cuff);
      }
      break;
    }
    case 'robe': {
      group.add(flare(0.55, 0.9, 0.64, -0.33, main));
      group.add(ring(0.56, 0.05, 0.0, trim));
      group.add(ring(0.88, 0.04, -0.63, trim));
      break;
    }
    case 'cape': {
      group.add(flare(0.57, 0.7, 0.3, -0.17, main));
      group.add(ring(0.57, 0.04, -0.02, trim));
      group.add(ring(0.7, 0.035, -0.32, trim));
      // Draped shell over the back (centred on +Z)
      const cape = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.74, 0.7, 16, 1, true, -0.7, 1.4),
        trim,
      );
      cape.position.y = -0.15;
      cape.castShadow = true;
      group.add(cape);
      group.add(ring(bodyRadius(0.42) + 0.04, 0.05, 0.42, main));
      break;
    }
  }

  switch (style.accessory) {
    case 'bow_back':
      group.add(bow(-0.06, 0.62, style.accent));
      break;
    case 'bow_front':
      group.add(bow(-0.06, -0.62, style.accent));
      break;
    case 'buttons': {
      const mat = toonMat(style.accent);
      for (let i = 0; i < 3; i++) {
        const y = -0.1 - i * 0.12;
        const button = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat);
        button.position.set(0, y, -(garmentFrontRadius(style.shape, y) + 0.03));
        group.add(button);
      }
      break;
    }
    case 'flower': {
      // Sits on the upper side of the head, clear of the eyes
      const mat = toonMat(style.accent);
      const fx = -0.17;
      const fy = 0.5;
      const fz = -Math.sqrt(Math.max(0.01, bodyRadius(fy) ** 2 - fx * fx));
      const flower = new THREE.Group();
      flower.position.set(fx, fy, fz);
      flower.lookAt(fx * 3, fy, fz * 3);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), mat);
        petal.position.set(Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0);
        flower.add(petal);
      }
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), toonMat(0xFFF3B0));
      flower.add(core);
      group.add(flower);
      break;
    }
    case 'headband': {
      group.add(ring(bodyRadius(0.45) + 0.05, 0.05, 0.45, toonMat(style.accent)));
      break;
    }
    case 'none':
      break;
  }

  return group;
}
