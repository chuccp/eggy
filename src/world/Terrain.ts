import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLORS, toonMat, TOON_GRADIENT } from '../utils/colors';
import { smoothNoise, seededRandom, randomPointInCircle, worldPos } from '../utils/math';

export interface Collider {
  x: number;
  z: number;
  radius: number;
  height: number; // Object height — can jump on top if above this
  // Wall segment (line from p1 to p2). When set, use circle-line collision.
  wallX1?: number;
  wallZ1?: number;
  wallX2?: number;
  wallZ2?: number;
}

export interface SlideData {
  start: THREE.Vector3; // Top of slide (world coords)
  end: THREE.Vector3;   // Bottom of slide (world coords)
  width: number;
  topHeight: number;
  bottomHeight: number;
}

// Lake footprint — keep in sync with WorldProps.waterCenter / waterRadius.
const LAKE_X = -30;
const LAKE_Z = -20;
const LAKE_RADIUS = 12;  // flat basin floor
const LAKE_RIM = 16;     // where the basin blends back into the hills
const LAKE_DEPTH = 3.0;

/** Distance from the lake centre, used to carve the basin and keep props out of the water. */
export function lakeDistance(x: number, z: number): number {
  return Math.hypot(x - LAKE_X, z - LAKE_Z);
}

// Lookout hill with a pavilion on top
export const HILL_X = -8;
export const HILL_Z = 62;
export const HILL_TOP = 10;   // flat-ish summit radius
const HILL_RIM = 24;
const HILL_HEIGHT = 5;

/** 0 outside the hill, 1 on the summit. */
function hillFactor(x: number, z: number): number {
  const d = Math.hypot(x - HILL_X, z - HILL_Z);
  if (d >= HILL_RIM) return 0;
  const k = Math.min(1, Math.max(0, (HILL_RIM - d) / (HILL_RIM - HILL_TOP)));
  return k * k * (3 - 2 * k);
}

export class Terrain {
  group: THREE.Group;
  getHeight: (x: number, z: number) => number;
  colliders: Collider[] = [];
  slideData: SlideData | null = null;
  private trees: THREE.Group[] = [];
  private grassMesh: THREE.InstancedMesh | null = null;
  private grassBaseMatrices: THREE.Matrix4[] = [];
  private grassPositions: [number, number][] = [];
  private flowerMesh: THREE.InstancedMesh | null = null;
  private flowerBaseMatrices: THREE.Matrix4[] = [];
  private flowerPositions: [number, number][] = [];

  constructor() {
    this.group = new THREE.Group();
    // The lake basin is carved into the terrain so the water plane (y = 0.05) actually
    // sits above the lakebed instead of being buried under the hills.
    this.getHeight = (x, z) => {
      let h = smoothNoise(x, z) * 0.5 + HILL_HEIGHT * hillFactor(x, z);
      const d = lakeDistance(x, z);
      if (d < LAKE_RIM) {
        const k = Math.min(1, Math.max(0, (LAKE_RIM - d) / (LAKE_RIM - LAKE_RADIUS)));
        h -= LAKE_DEPTH * (k * k * (3 - 2 * k)); // smoothstep bowl
      }
      return h;
    };

    this.createGround();
    this.createTrees();
    this.createGrass();
    this.createFlowers();
    this.createStones();
    this.createBenches();
    this.createFountain();
    this.createPavilion();
    this.createPath();
    this.createSlide();
    this.createFence();
  }

  private createGround() {
    // Main ground plane with height variation
    const size = 200;
    const segments = 100;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const baseColor = new THREE.Color(COLORS.ground);
    const darkColor = new THREE.Color(COLORS.groundDark);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = this.getHeight(x, z);
      pos.setY(i, h);

      // Vertex color: darker in valleys, lighter on hills
      const t = Math.min(1, Math.max(0, (h + 2) / 4));
      const c = baseColor.clone().lerp(darkColor, 1 - t);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshToonMaterial({
      vertexColors: true,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  private createTrees() {
    const rng = seededRandom(123);
    const treePositions: [number, number][] = [];

    // Scatter trees around (avoid center area)
    for (let i = 0; i < 60; i++) {
      const [dx, dz] = randomPointInCircle(85, rng);
      // Keep away from center fountain area
      if (Math.abs(dx) < 8 && Math.abs(dz) < 8) continue;
      // Keep away from path
      if (Math.abs(dx) < 3 && dz > -30 && dz < 30) continue;
      // Keep away from house areas
      if (dx > 8 && dx < 25 && dz > 8 && dz < 25) continue;   // 温馨小屋
      if (dx > -28 && dx < -12 && dz > 12 && dz < 28) continue; // 面包店
      if (dx > 22 && dx < 38 && dz > -28 && dz < -12) continue; // 服装店
      if (dx > -60 && dx < -44 && dz > -40 && dz < -28) continue; // 家具小馆
      if (dx > -16 && dx < -4 && dz > -42 && dz < -28) continue; // 冰淇淋小屋
      // Keep the lake clear of trees
      if (lakeDistance(dx, dz) < LAKE_RIM + 2) continue;
      // Keep away from slide area
      if (dx > -32 && dx < -20 && dz > -12 && dz < 12) continue;
      // Keep the pavilion deck clear
      if (Math.hypot(dx - HILL_X, dz - HILL_Z) < 5.5) continue;
      treePositions.push([dx, dz]);
    }

    for (const [x, z] of treePositions) {
      const { group: tree, height: treeH } = this.createTree(rng);
      const y = this.getHeight(x, z);
      tree.position.set(x, y, z);
      tree.rotation.y = rng() * Math.PI * 2;
      const scale = 0.8 + rng() * 0.6;
      tree.scale.setScalar(scale);
      this.group.add(tree);
      this.trees.push(tree);
      this.colliders.push({ x, z, radius: 0.5 * scale, height: treeH * scale });
    }
  }

  private createTree(rng: () => number): { group: THREE.Group; height: number } {
    const species = Math.floor(rng() * 4); // 0–3

    switch (species) {
      case 1:  return this.createPine(rng);
      case 2:  return this.createBush(rng);
      case 3:  return this.createTallTree(rng);
      default: return this.createRoundTree(rng);
    }
  }

  /** Species 0 — Round tree (original): trunk + 2 stacked spheres, green */
  private createRoundTree(rng: () => number): { group: THREE.Group; height: number } {
    const tree = new THREE.Group();

    const trunkH = 1.5 + rng() * 1;
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, trunkH, 8);
    const trunk = new THREE.Mesh(trunkGeo, toonMat(COLORS.trunk));
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    tree.add(trunk);

    const foliageMat = toonMat(rng() > 0.5 ? COLORS.leaves : COLORS.leavesDark);

    const foliage1 = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 8), foliageMat);
    foliage1.position.y = trunkH + 0.3;
    foliage1.castShadow = true;
    tree.add(foliage1);

    const foliage2 = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 7), foliageMat);
    foliage2.position.set(0.3, trunkH + 0.8, 0.2);
    foliage2.castShadow = true;
    tree.add(foliage2);

    return { group: tree, height: trunkH + 1.0 };
  }

  /** Species 1 — Pine/conical: trunk + 3 stacked cones (decreasing size), dark green */
  private createPine(rng: () => number): { group: THREE.Group; height: number } {
    const tree = new THREE.Group();

    const trunkH = 2.0 + rng() * 0.8;
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.16, trunkH, 8);
    const trunk = new THREE.Mesh(trunkGeo, toonMat(COLORS.trunk));
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    tree.add(trunk);

    const foliageMat = toonMat(COLORS.leavesDark);

    // 3 stacked cones, decreasing radius & height going up
    const coneData: [number, number, number][] = [
      [1.0, 1.4, 0.0],  // radius, height, yOffset from trunk top
      [0.75, 1.2, 0.8],
      [0.5, 1.0, 1.5],
    ];
    for (const [r, h, yOff] of coneData) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), foliageMat);
      cone.position.y = trunkH + yOff;
      cone.castShadow = true;
      tree.add(cone);
    }

    return { group: tree, height: trunkH + 2.5 };
  }

  /** Species 2 — Bush/flowering: shorter trunk + 2 spheres, one pink / light green */
  private createBush(rng: () => number): { group: THREE.Group; height: number } {
    const tree = new THREE.Group();

    const trunkH = 0.8 + rng() * 0.5;
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.14, trunkH, 8);
    const trunk = new THREE.Mesh(trunkGeo, toonMat(COLORS.trunk));
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    tree.add(trunk);

    const pinkMat = toonMat(0xFFB6C1);       // light pink
    const lightGreenMat = toonMat(0x81C784);  // soft green

    const mat1 = rng() > 0.5 ? pinkMat : lightGreenMat;
    const mat2 = rng() > 0.5 ? pinkMat : lightGreenMat;

    const bush1 = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), mat1);
    bush1.position.y = trunkH + 0.2;
    bush1.castShadow = true;
    tree.add(bush1);

    const bush2 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 7), mat2);
    bush2.position.set(0.25, trunkH + 0.55, 0.15);
    bush2.castShadow = true;
    tree.add(bush2);

    return { group: tree, height: trunkH + 1.0 };
  }

  /** Species 3 — Tall tree: taller trunk + 1 large sphere at top, lighter green */
  private createTallTree(rng: () => number): { group: THREE.Group; height: number } {
    const tree = new THREE.Group();

    const trunkH = 3.0 + rng() * 1.0;
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.2, trunkH, 8);
    const trunk = new THREE.Mesh(trunkGeo, toonMat(COLORS.trunk));
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    tree.add(trunk);

    const foliageMat = toonMat(0x66BB6A); // lighter green

    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 10), foliageMat);
    canopy.position.y = trunkH + 0.4;
    canopy.castShadow = true;
    tree.add(canopy);

    return { group: tree, height: trunkH + 1.3 };
  }

  private createGrass() {
    const rng = seededRandom(321);
    const GRASS_COUNT = 1500;

    // Grass blade geometry: thin elongated diamond (~0.15 units tall)
    const bladeGeo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      // Left face
      0, 0, 0,
      -0.02, 0.08, 0,
      0, 0.15, 0,
      // Right face
      0, 0, 0,
      0, 0.15, 0,
      0.02, 0.08, 0,
    ]);
    bladeGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    bladeGeo.computeVertexNormals();

    // Collect valid positions
    const positions: [number, number][] = [];
    for (let i = 0; i < GRASS_COUNT * 2; i++) {
      if (positions.length >= GRASS_COUNT) break;
      const [x, z] = randomPointInCircle(85, rng);
      // Avoid fountain area
      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
      // Avoid house areas
      if (x > 8 && x < 25 && z > 8 && z < 25) continue;
      if (x > -28 && x < -12 && z > 12 && z < 28) continue;
      if (x > 22 && x < 38 && z > -28 && z < -12) continue;
      if (x > -60 && x < -44 && z > -40 && z < -28) continue;
      if (x > -16 && x < -4 && z > -42 && z < -28) continue;
      // Keep the lake clear of grass
      if (lakeDistance(x, z) < LAKE_RIM) continue;
      if (Math.hypot(x - HILL_X, z - HILL_Z) < 5.5) continue; // pavilion deck
      positions.push([x, z]);
    }

    this.grassPositions = positions;

    // Toon material with vertex colors for per-instance variation
    const grassMat = new THREE.MeshToonMaterial({
      color: 0x4CAF50,
      vertexColors: true,
      gradientMap: TOON_GRADIENT,
    });

    const mesh = new THREE.InstancedMesh(bladeGeo, grassMat, positions.length);
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const baseGreen = new THREE.Color(0x4CAF50);
    const lightGreen = new THREE.Color(0x81C784);
    const darkGreen = new THREE.Color(0x2E7D32);

    this.grassBaseMatrices = [];

    for (let i = 0; i < positions.length; i++) {
      const [x, z] = positions[i];
      const y = this.getHeight(x, z);
      dummy.position.set(x, y, z);
      dummy.rotation.y = rng() * Math.PI * 2;
      const s = 0.7 + rng() * 0.6;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      this.grassBaseMatrices.push(dummy.matrix.clone());

      // Per-instance color variation
      const t = rng();
      const c = t < 0.5
        ? baseGreen.clone().lerp(lightGreen, t * 2)
        : baseGreen.clone().lerp(darkGreen, (t - 0.5) * 2);
      mesh.setColorAt(i, c);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.grassMesh = mesh;
    this.group.add(mesh);
  }

  private createFlowers() {
    const rng = seededRandom(456);
    const palette = COLORS.flower;

    // Build a 3D flower template: cylinder stem + sphere petals
    const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6);
    stemGeo.translate(0, 0.15, 0); // base at y=0, top at y=0.3
    const petalGeo = new THREE.SphereGeometry(0.08, 8, 6);
    petalGeo.translate(0, 0.34, 0); // sit on top of stem
    const mergedGeo = mergeGeometries([stemGeo, petalGeo])!;

    // Collect valid positions
    const positions: [number, number][] = [];
    for (let i = 0; i < 200; i++) {
      const [x, z] = randomPointInCircle(90, rng);
      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
      // Keep the lake clear of flowers
      if (lakeDistance(x, z) < LAKE_RIM) continue;
      if (Math.hypot(x - HILL_X, z - HILL_Z) < 5.5) continue; // pavilion deck
      positions.push([x, z]);
    }

    // Create instanced mesh with vertex-color-capable toon material
    const mesh = new THREE.InstancedMesh(
      mergedGeo,
      new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonMat(0).gradientMap }),
      positions.length,
    );
    mesh.castShadow = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    this.flowerPositions = positions;
    this.flowerBaseMatrices = [];

    for (let i = 0; i < positions.length; i++) {
      const [x, z] = positions[i];
      const y = this.getHeight(x, z);
      dummy.position.set(x, y, z);
      dummy.rotation.y = rng() * Math.PI * 2;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      this.flowerBaseMatrices.push(dummy.matrix.clone());

      color.set(palette[Math.floor(rng() * palette.length)]);
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.flowerMesh = mesh;
    this.group.add(mesh);
  }

  private createStones() {
    const rng = seededRandom(789);
    const COUNT = 25;

    // One InstancedMesh instead of 25 meshes each with its own geometry and material
    const mesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1, 0),
      toonMat(COLORS.stone),
      COUNT,
    );
    mesh.castShadow = true;

    const dummy = new THREE.Object3D();
    let placed = 0;
    while (placed < COUNT) {
      const [x, z] = randomPointInCircle(80, rng);
      if (lakeDistance(x, z) < LAKE_RIM) continue; // keep the lake clear of stones
      const y = this.getHeight(x, z);
      const s = 0.2 + rng() * 0.4;
      dummy.position.set(x, y + s * 0.3, z);
      dummy.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
  }

  private createBenches() {
    const benchPositions: [number, number, number][] = [
      [6, 0, 4],    // Near fountain
      [-6, 0, -4],  // Near fountain
      [15, 0, 20],  // In the park
    ];

    for (const [x, _, z] of benchPositions) {
      const y = this.getHeight(x, z);
      const bench = this.createBench();
      bench.position.set(x, y, z);
      this.group.add(bench);
      this.colliders.push({ x, z, radius: 1.0, height: 0.5 });
    }
  }

  private createBench(): THREE.Group {
    const bench = new THREE.Group();
    const mat = toonMat(COLORS.bench);

    // Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.5), mat);
    seat.position.y = 0.45;
    seat.castShadow = true;
    bench.add(seat);

    // Back
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.06), mat);
    back.position.set(0, 0.7, -0.22);
    bench.add(back);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.06, 0.45, 0.06);
    for (const lx of [-0.6, 0.6]) {
      const leg = new THREE.Mesh(legGeo, mat);
      leg.position.set(lx, 0.225, 0);
      bench.add(leg);
    }

    return bench;
  }

  private createFountain() {
    // Central fountain base
    const baseMat = toonMat(0xBBBBBB);

    // Outer ring
    const outerGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.6, 24);
    const outer = new THREE.Mesh(outerGeo, baseMat);
    outer.position.y = 0.3;
    outer.castShadow = true;
    outer.receiveShadow = true;
    this.group.add(outer);

    // Inner pool (darker)
    const poolMat = toonMat(COLORS.water, { transparent: true, opacity: 0.7 });
    const poolGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.55, 24);
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.position.y = 0.32;
    this.group.add(pool);

    // Center pillar
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.5, 12), baseMat);
    pillar.position.y = 1.0;
    pillar.castShadow = true;
    this.group.add(pillar);

    // Top basin
    const topBasin = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.6, 0.3, 16), baseMat);
    topBasin.position.y = 1.8;
    this.group.add(topBasin);

    this.colliders.push({ x: 0, z: 0, radius: 2.8, height: 0.6 });
  }

  /** Lookout pavilion on the summit of the hill. */
  private createPavilion() {
    const topY = this.getHeight(HILL_X, HILL_Z);
    const pavilion = new THREE.Group();
    pavilion.position.set(HILL_X, topY, HILL_Z);

    const stoneMat = toonMat(0xBFB6A8);
    const woodMat = toonMat(0x8B5A2B);
    const roofMat = toonMat(0xC0392B);

    // Deck sits flush with the summit so the character can just walk on
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.0, 0.4, 20), stoneMat);
    deck.position.y = -0.18;
    deck.castShadow = true;
    deck.receiveShadow = true;
    pavilion.add(deck);

    const pillarCount = 6;
    const pillarRadius = 3.1;
    for (let i = 0; i < pillarCount; i++) {
      const a = (i / pillarCount) * Math.PI * 2;
      const px = Math.cos(a) * pillarRadius;
      const pz = Math.sin(a) * pillarRadius;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 2.8, 8), woodMat);
      pillar.position.set(px, 1.4, pz);
      pillar.castShadow = true;
      pavilion.add(pillar);
      // Collider height is compared against the character's world-space foot Y,
      // so it has to include the hill's height.
      this.colliders.push({
        x: HILL_X + px, z: HILL_Z + pz, radius: 0.25, height: topY + 2.8,
      });
    }

    const roofLower = new THREE.Mesh(new THREE.ConeGeometry(4.4, 1.5, 6), roofMat);
    roofLower.position.y = 3.5;
    roofLower.castShadow = true;
    pavilion.add(roofLower);

    const roofUpper = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.1, 6), roofMat);
    roofUpper.position.y = 4.5;
    roofUpper.castShadow = true;
    pavilion.add(roofUpper);

    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), toonMat(0xFFD700));
    finial.position.y = 5.2;
    pavilion.add(finial);

    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.5), woodMat);
    bench.position.set(0, 0.3, -1.7);
    bench.castShadow = true;
    bench.receiveShadow = true;
    pavilion.add(bench);

    this.group.add(pavilion);
  }

  private createPath() {
    // A simple path through the scene
    const pathMat = toonMat(COLORS.path);

    // Straight path from south to north through center
    const pathGeo = new THREE.PlaneGeometry(3, 60);
    pathGeo.rotateX(-Math.PI / 2);
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.position.set(0, 0.02, 0);
    path.receiveShadow = true;
    this.group.add(path);

    // Cross path east-west
    const crossGeo = new THREE.PlaneGeometry(40, 3);
    crossGeo.rotateX(-Math.PI / 2);
    const cross = new THREE.Mesh(crossGeo, pathMat);
    cross.position.set(0, 0.02, 0);
    cross.receiveShadow = true;
    this.group.add(cross);

    // Path from center to player house
    const housePathGeo = new THREE.PlaneGeometry(2, 16);
    housePathGeo.rotateX(-Math.PI / 2);
    const housePath = new THREE.Mesh(housePathGeo, pathMat);
    housePath.position.set(8, 0.02, 8);
    housePath.rotation.y = Math.PI / 4;
    housePath.receiveShadow = true;
    this.group.add(housePath);
  }

  private createSlide() {
    const sx = -25, sz = 0; // Slide center position
    const baseY = this.getHeight(sx, sz);
    const topH = 4.5;
    const slideLen = 10;
    const slideW = 2.0;

    const slide = new THREE.Group();
    slide.position.set(sx, baseY, sz);

    // --- Colors ---
    const redMat = toonMat(0xFF6B6B);
    const yellowMat = toonMat(0xFFE66D);
    const blueMat = toonMat(0x4ECDC4);
    const greyMat = toonMat(0x888888);

    // --- Support legs ---
    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, topH + 0.5, 8);
    const legPositions = [
      [-slideW / 2 - 0.2, 0], [slideW / 2 + 0.2, 0],
      [-slideW / 2 - 0.2, slideLen], [slideW / 2 + 0.2, slideLen],
      [-slideW / 2 - 0.2, slideLen / 2], [slideW / 2 + 0.2, slideLen / 2],
    ];
    for (const [lx, lz] of legPositions) {
      const h = (lz < 2) ? topH + 0.5 : (topH + 0.5) * (1 - lz / slideLen * 0.6);
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, h, 8), greyMat,
      );
      leg.position.set(lx, h / 2, lz);
      leg.castShadow = true;
      slide.add(leg);
    }

    // --- Platform at top ---
    const platGeo = new THREE.BoxGeometry(slideW + 1, 0.15, 1.5);
    const platform = new THREE.Mesh(platGeo, yellowMat);
    platform.position.set(0, topH, 0.75);
    platform.castShadow = true;
    platform.receiveShadow = true;
    slide.add(platform);

    // Platform railing
    const railGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6);
    for (const rx of [-slideW / 2 - 0.2, slideW / 2 + 0.2]) {
      const rail = new THREE.Mesh(railGeo, greyMat);
      rail.position.set(rx, topH + 0.4, 0.75);
      slide.add(rail);
    }
    // Top rail bar
    const topRailGeo = new THREE.CylinderGeometry(0.03, 0.03, slideW + 1.4, 6);
    topRailGeo.rotateZ(Math.PI / 2);
    const topRail = new THREE.Mesh(topRailGeo, greyMat);
    topRail.position.set(0, topH + 0.8, 0.75);
    slide.add(topRail);

    // --- Slide surface ---
    // Build as a series of flat segments going downhill
    const segments = 20;
    const slideMat = redMat;
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      const y0 = topH * (1 - t0 * 0.85);
      const y1 = topH * (1 - t1 * 0.85);
      const z0 = 1.5 + t0 * slideLen;
      const z1 = 1.5 + t1 * slideLen;

      const segGeo = new THREE.BoxGeometry(slideW, 0.08, (z1 - z0) * 1.01);
      const seg = new THREE.Mesh(segGeo, i % 2 === 0 ? redMat : yellowMat);
      seg.position.set(0, (y0 + y1) / 2, (z0 + z1) / 2);
      seg.rotation.x = Math.atan2(y0 - y1, z1 - z0);
      seg.castShadow = true;
      seg.receiveShadow = true;
      slide.add(seg);
    }

    // --- Side walls on slide ---
    const wallH = 0.3;
    const wallMat = blueMat;
    for (const side of [-1, 1]) {
      const wallPts: THREE.Vector3[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const y = topH * (1 - t * 0.85);
        const z = 1.5 + t * slideLen;
        wallPts.push(new THREE.Vector3(side * slideW / 2, y + wallH / 2, z));
      }
      for (let i = 0; i < wallPts.length - 1; i++) {
        const p0 = wallPts[i];
        const p1 = wallPts[i + 1];
        const len = p0.distanceTo(p1);
        const wallGeo = new THREE.BoxGeometry(0.06, wallH, len);
        const wall = new THREE.Mesh(wallGeo, wallMat);
        wall.position.copy(p0).lerp(p1, 0.5);
        wall.lookAt(p1);
        wall.rotateY(Math.PI / 2);
        slide.add(wall);
      }
    }

    // --- Steps (stairs to go up) ---
    const stepCount = 10;
    for (let i = 0; i < stepCount; i++) {
      const t = i / stepCount;
      const stepY = t * topH;
      const stepZ = -1.5 + t * 1.5;
      const stepGeo = new THREE.BoxGeometry(slideW, 0.12, 0.25);
      const step = new THREE.Mesh(stepGeo, i % 2 === 0 ? blueMat : yellowMat);
      step.position.set(0, stepY + 0.06, stepZ);
      step.castShadow = true;
      slide.add(step);
    }

    // Step railings
    for (const side of [-1, 1]) {
      const stepRail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, topH * 1.1, 6),
        greyMat,
      );
      stepRail.position.set(side * (slideW / 2 + 0.3), topH * 0.55, -0.75);
      slide.add(stepRail);
    }

    this.group.add(slide);

    // Store slide data for physics
    this.slideData = {
      start: new THREE.Vector3(sx, baseY + topH, sz + 1.5),
      end: new THREE.Vector3(sx, baseY + topH * 0.15, sz + 1.5 + slideLen),
      width: slideW,
      topHeight: topH,
      bottomHeight: topH * 0.15,
    };
  }

  /** Wooden fence along world edges at ±95 */
  private createFence() {
    const BOUNDARY = 95;
    const SPACING = 4;
    const POST_RADIUS = 0.05;
    const POST_HEIGHT = 1.0;
    const RAIL_Y_OFFSETS = [0.35, 0.75]; // two horizontal rails

    const fenceMat = toonMat(COLORS.fence);
    const postGeo = new THREE.CylinderGeometry(POST_RADIUS, POST_RADIUS, POST_HEIGHT, 6);

    // Collect all post positions and rail segments
    const postPositions: [number, number][] = [];

    // Generate posts along all 4 edges
    for (let i = -BOUNDARY; i <= BOUNDARY; i += SPACING) {
      // Bottom edge (z = -BOUNDARY)
      postPositions.push([i, -BOUNDARY]);
      // Top edge (z = +BOUNDARY)
      postPositions.push([i, BOUNDARY]);
      // Left edge (x = -BOUNDARY)
      postPositions.push([-BOUNDARY, i]);
      // Right edge (x = +BOUNDARY)
      postPositions.push([BOUNDARY, i]);
    }

    // Use InstancedMesh for fence posts
    const postMesh = new THREE.InstancedMesh(postGeo, fenceMat, postPositions.length);
    postMesh.castShadow = true;

    const dummy = new THREE.Object3D();
    for (let idx = 0; idx < postPositions.length; idx++) {
      const [x, z] = postPositions[idx];
      const y = this.getHeight(x, z);
      dummy.position.set(x, y + POST_HEIGHT / 2, z);
      dummy.updateMatrix();
      postMesh.setMatrixAt(idx, dummy.matrix);
    }
    postMesh.instanceMatrix.needsUpdate = true;
    this.group.add(postMesh);

    // Build horizontal rails between adjacent posts on each edge
    const railGeoTemplate = new THREE.CylinderGeometry(0.03, 0.03, SPACING, 4);
    // Rotate rail geo so its axis is along X (we'll re-orient per edge)
    // CylinderGeometry is along Y by default, so rotate 90° on Z to lay it along X
    railGeoTemplate.rotateZ(Math.PI / 2);

    // Collect rail transforms: [x, y, z, isXEdge]
    const railTransforms: { x: number; y: number; z: number; rotY: number }[] = [];

    const addEdgeRails = (positions: [number, number][]) => {
      for (let i = 0; i < positions.length - 1; i++) {
        const [x1, z1] = positions[i];
        const [x2, z2] = positions[i + 1];
        const midX = (x1 + x2) / 2;
        const midZ = (z1 + z2) / 2;
        const y1 = this.getHeight(x1, z1);
        const y2 = this.getHeight(x2, z2);
        const isXEdge = z1 === z2; // rail runs along X
        const rotY = isXEdge ? 0 : Math.PI / 2;
        for (const ry of RAIL_Y_OFFSETS) {
          const avgY = (y1 + y2) / 2;
          railTransforms.push({ x: midX, y: avgY + ry, z: midZ, rotY });
        }
      }
    };

    // Build per-edge post arrays in order
    const bottomEdge: [number, number][] = [];
    const topEdge: [number, number][] = [];
    const leftEdge: [number, number][] = [];
    const rightEdge: [number, number][] = [];

    for (let i = -BOUNDARY; i <= BOUNDARY; i += SPACING) {
      bottomEdge.push([i, -BOUNDARY]);
      topEdge.push([i, BOUNDARY]);
      leftEdge.push([-BOUNDARY, i]);
      rightEdge.push([BOUNDARY, i]);
    }

    addEdgeRails(bottomEdge);
    addEdgeRails(topEdge);
    addEdgeRails(leftEdge);
    addEdgeRails(rightEdge);

    if (railTransforms.length > 0) {
      const railMesh = new THREE.InstancedMesh(railGeoTemplate, fenceMat, railTransforms.length);
      railMesh.castShadow = true;
      for (let idx = 0; idx < railTransforms.length; idx++) {
        const { x, y, z, rotY } = railTransforms[idx];
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, rotY, 0);
        dummy.updateMatrix();
        railMesh.setMatrixAt(idx, dummy.matrix);
      }
      railMesh.instanceMatrix.needsUpdate = true;
      this.group.add(railMesh);
    }
  }

  getTreePositions(): THREE.Vector3[] {
    return this.trees.map(t => t.position.clone());
  }

  /** Animate trees swaying in the wind and grass waving. Call each frame. */
  /** Distance to the closest tree — the game uses it to fade in bird song. */
  nearestTreeDistance(x: number, z: number): number {
    let best = Infinity;
    for (const tree of this.trees) {
      const d = Math.hypot(tree.position.x - x, tree.position.z - z);
      if (d < best) best = d;
    }
    return best;
  }

  updateTrees(dt: number, playerPos?: THREE.Vector3) {
    const t = performance.now() * 0.001;
    for (let i = 0; i < this.trees.length; i++) {
      const tree = this.trees[i];
      // Each tree sways at a slightly different phase
      const phase = i * 0.7;
      const sway = Math.sin(t * 0.8 + phase) * 0.015 + Math.sin(t * 1.3 + phase * 0.5) * 0.008;
      tree.rotation.z = sway;
      tree.rotation.x = Math.sin(t * 0.6 + phase * 1.2) * 0.01;
    }

    // Grass wind animation
    if (this.grassMesh && this.grassPositions.length > 0) {
      const dummy = new THREE.Object3D();
      for (let i = 0; i < this.grassPositions.length; i++) {
        const [x, z] = this.grassPositions[i];
        // Wind sway based on position and time
        const windZ = Math.sin(t * 1.5 + x * 0.5 + z * 0.3) * 0.15;
        const windX = Math.sin(t * 1.2 + x * 0.3 + z * 0.7) * 0.08;

        dummy.matrix.copy(this.grassBaseMatrices[i]);
        // Apply additional wind rotation by composing a rotation matrix
        const windMatrix = new THREE.Matrix4().makeRotationZ(windZ);
        windMatrix.multiply(new THREE.Matrix4().makeRotationX(windX));
        dummy.matrix.multiply(windMatrix);
        this.grassMesh.setMatrixAt(i, dummy.matrix);
      }
      this.grassMesh.instanceMatrix.needsUpdate = true;
    }

    // Flower proximity sway — lean away from player when nearby
    if (this.flowerMesh && this.flowerPositions.length > 0) {
      const dummy = new THREE.Object3D();
      const swayRadius = 1.0;
      const maxLean = 0.4;

      for (let i = 0; i < this.flowerPositions.length; i++) {
        const [fx, fz] = this.flowerPositions[i];

        dummy.matrix.copy(this.flowerBaseMatrices[i]);

        if (playerPos) {
          const dx = fx - playerPos.x;
          const dz = fz - playerPos.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (dist < swayRadius && dist > 0.01) {
            // Lean away from player proportional to proximity
            const strength = (1 - dist / swayRadius) * maxLean;
            const leanX = (dx / dist) * strength;
            const leanZ = (dz / dist) * strength;
            const windMatrix = new THREE.Matrix4().makeRotationZ(leanX);
            windMatrix.multiply(new THREE.Matrix4().makeRotationX(-leanZ));
            dummy.matrix.multiply(windMatrix);
          }
        }

        this.flowerMesh.setMatrixAt(i, dummy.matrix);
      }
      this.flowerMesh.instanceMatrix.needsUpdate = true;
    }
  }
}
