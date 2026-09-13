import * as THREE from 'three';
import { COLORS, toonMat } from '../utils/colors';

export type WingShape = 'round' | 'feather' | 'bat' | 'dragon' | 'fairy' | 'rainbow';

export interface WingStyle {
  id: string;
  shape: WingShape;
  main: number;
  accent: number;
  emissive?: number;
  opacity?: number;
}

// Each entry is a distinct silhouette so no two wing styles read alike.
export const WING_STYLES: Record<string, WingStyle> = {
  wings:         { id: 'wings',         shape: 'round',   main: 0xFFB6C1, accent: 0xFF8FB4, opacity: 0.9 },
  fairy_wings:   { id: 'fairy_wings',   shape: 'fairy',   main: 0xBFEFFF, accent: 0xE8FBFF, emissive: 0x8FE0FF, opacity: 0.5 },
  demon_wings:   { id: 'demon_wings',   shape: 'bat',     main: 0x3A2A4A, accent: 0x9A6AB8 },
  dragon_wings:  { id: 'dragon_wings',  shape: 'dragon',  main: 0x2F8F4E, accent: 0xCDE86A },
  angel_wings:   { id: 'angel_wings',   shape: 'feather', main: COLORS.wing, accent: COLORS.wingShade },
  rainbow_wings: { id: 'rainbow_wings', shape: 'rainbow', main: 0xFF6B6B, accent: 0xFFD700, emissive: 0xFF69B4, opacity: 0.92 },
};

/** Animated wings: a group to hang on the equipment slot plus a flap driver. */
export interface WingRig {
  group: THREE.Group;
  /** flap in radians — 0 is the rest pose, positive is an upstroke. */
  setFlap(flap: number): void;
}

// Pivot sits where the old built-in wings attached, expressed in wings-slot space.
const PIVOT_X = 0.30;
const PIVOT_Y = 0.02;
const PIVOT_Z = -0.06;
const BASE_SPLAY = 0.3;

type MatOpts = NonNullable<Parameters<typeof toonMat>[1]>;

/**
 * The left wing is the right wing's geometry mirrored with a negative x scale, so every
 * material must be double-sided: three.js flips the normal for back faces, which keeps the
 * mirrored side lit correctly.
 */
function wingMat(color: number, style: WingStyle, boost = 0.5): THREE.MeshToonMaterial {
  const opts: MatOpts = { side: THREE.DoubleSide };
  if (style.opacity !== undefined) {
    opts.transparent = true;
    opts.opacity = style.opacity;
  }
  if (style.emissive !== undefined) {
    opts.emissive = style.emissive;
    opts.emissiveIntensity = boost;
  }
  return toonMat(color, opts);
}

function blob(r: number, sx: number, sy: number, sz: number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(r, 12, 10);
  geo.scale(sx, sy, sz);
  return geo;
}

/** Align a default +Y cylinder along the (tx, ty) direction from the shoulder. */
function strut(tx: number, ty: number, r: number, mat: THREE.Material): THREE.Mesh {
  const len = Math.hypot(tx, ty);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.4, r, len, 6), mat);
  mesh.position.set(tx / 2, ty / 2, 0.006);
  mesh.rotation.z = Math.atan2(ty, tx) - Math.PI / 2;
  return mesh;
}

/** Build only the right-side wing; the rig mirrors it for the left. */
function buildParts(style: WingStyle): THREE.Object3D[] {
  switch (style.shape) {
    case 'round': {
      const mat = wingMat(style.main, style);
      const upper = new THREE.Mesh(blob(0.19, 0.60, 1.0, 0.40), mat);
      upper.position.set(0.14, 0.08, 0);
      upper.castShadow = true;
      const lower = new THREE.Mesh(blob(0.15, 0.60, 0.95, 0.38), mat);
      lower.position.set(0.13, -0.10, 0.02);
      lower.castShadow = true;
      return [upper, lower];
    }

    case 'feather': {
      const mat = wingMat(style.main, style);
      const lobes: [number, number, number, number][] = [
        [0.17, 0.00, 0.155, 0.075],
        [0.35, 0.05, 0.185, 0.080],
        [0.52, 0.09, 0.160, 0.070],
        [0.67, 0.12, 0.115, 0.055],
      ];
      return lobes.map(([x, y, r, t]) => {
        const geo = new THREE.SphereGeometry(r, 12, 10);
        geo.scale(1, 0.85, t / r);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, 0);
        mesh.castShadow = true;
        return mesh;
      });
    }

    case 'fairy': {
      const mat = wingMat(style.main, style, 0.9);
      const upper = new THREE.Mesh(blob(0.22, 0.42, 1.5, 0.06), mat);
      upper.position.set(0.16, 0.17, 0);
      upper.rotation.z = -0.30;
      const lower = new THREE.Mesh(blob(0.18, 0.42, 1.2, 0.06), mat);
      lower.position.set(0.23, -0.10, 0);
      lower.rotation.z = 0.35;
      return [upper, lower];
    }

    case 'bat': {
      const web = new THREE.Shape();
      web.moveTo(0.02, 0.02);
      web.quadraticCurveTo(0.30, 0.26, 0.62, 0.10);
      web.lineTo(0.46, -0.02);
      web.lineTo(0.52, -0.28);
      web.quadraticCurveTo(0.30, -0.20, 0.16, -0.16);
      web.quadraticCurveTo(0.05, -0.14, 0.02, 0.02);
      const membrane = new THREE.Mesh(new THREE.ShapeGeometry(web, 12), wingMat(style.main, style));
      membrane.castShadow = true;
      const boneMat = wingMat(style.accent, style, 0);
      const parts: THREE.Object3D[] = [membrane];
      for (const [tx, ty] of [[0.62, 0.10], [0.52, -0.28]] as [number, number][]) {
        parts.push(strut(tx, ty, 0.014, boneMat));
      }
      return parts;
    }

    case 'dragon': {
      const web = new THREE.Shape();
      web.moveTo(0.02, 0.04);
      web.quadraticCurveTo(0.36, 0.34, 0.78, 0.16);
      web.lineTo(0.70, 0.02);
      web.lineTo(0.76, -0.20);
      web.lineTo(0.54, -0.14);
      web.lineTo(0.56, -0.42);
      web.quadraticCurveTo(0.30, -0.30, 0.14, -0.24);
      web.quadraticCurveTo(0.04, -0.18, 0.02, 0.04);
      const membrane = new THREE.Mesh(new THREE.ShapeGeometry(web, 12), wingMat(style.main, style));
      membrane.castShadow = true;
      const spineMat = wingMat(style.accent, style, 0);
      return [membrane, strut(0.78, 0.16, 0.018, spineMat)];
    }

    case 'rainbow': {
      const colors = [0xFF6B6B, 0xFFA94D, 0xFFE066, 0x8CE99A, 0x74C0FC, 0xB197FC];
      const lobes: [number, number, number, number][] = [
        [0.14, -0.02, 0.135, 0.060],
        [0.27, 0.02, 0.150, 0.065],
        [0.42, 0.06, 0.160, 0.070],
        [0.57, 0.10, 0.150, 0.065],
        [0.71, 0.13, 0.130, 0.058],
        [0.84, 0.15, 0.105, 0.048],
      ];
      return lobes.map(([x, y, r, t], i) => {
        const geo = new THREE.SphereGeometry(r, 12, 10);
        geo.scale(1, 0.85, t / r);
        const mesh = new THREE.Mesh(geo, wingMat(colors[i % colors.length], style));
        mesh.position.set(x, y, 0);
        mesh.castShadow = true;
        return mesh;
      });
    }
  }
}

export function buildWingRig(style: WingStyle): WingRig {
  const group = new THREE.Group();
  const nodes: { side: number; node: THREE.Group }[] = [];

  for (const side of [-1, 1] as const) {
    const node = new THREE.Group();
    node.position.set(PIVOT_X * side, PIVOT_Y, PIVOT_Z);
    node.rotation.y = -0.5 * side; // swept back

    const geometryRoot = new THREE.Group();
    if (side < 0) geometryRoot.scale.x = -1;
    for (const part of buildParts(style)) geometryRoot.add(part);
    node.add(geometryRoot);

    group.add(node);
    nodes.push({ side, node });
  }

  const rig: WingRig = {
    group,
    setFlap(flap: number) {
      for (const { side, node } of nodes) {
        node.rotation.z = side * (flap - BASE_SPLAY);
      }
    },
  };
  rig.setFlap(0);
  group.userData.wingRig = rig;
  return rig;
}
