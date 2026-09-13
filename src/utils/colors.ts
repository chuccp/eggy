import * as THREE from 'three';

// 马卡龙色调
export const COLORS = {
  // 环境
  sky: 0x87CEEB,
  skyZenith: 0x4A90D9, // top-of-dome deep blue
  ground: 0x7EC850,
  groundDark: 0x5DA53A,

  // 蛋仔颜色选项
  eggOptions: [
    0xFFF5E1, // 奶白
    0xFFB3BA, // 粉色
    0xFFDFBA, // 橙色
    0xFFFFBA, // 黄色
    0xBAFFC9, // 绿色
    0xBAE1FF, // 蓝色
    0xE8BAFF, // 紫色
    0xFFC8DD, // 玫瑰
  ],

  // 蛋仔翅膀
  wing: 0xFFFDF5,
  wingShade: 0xEFE6D8,

  // 蛋仔面部
  eye: 0x222222,
  eyeHighlight: 0xFFFFFF,
  blush: 0xFF8888,
  mouth: 0x333333,

  // 服装：粉色裙子 + 蝴蝶结
  dress: 0xFF8FB4,      // 裙身
  dressTrim: 0xFFC2D8,  // 腰头 / 裙摆滚边
  bow: 0xFF4D88,        // 蝴蝶结

  // 场景
  water: 0x6BB5E0,
  trunk: 0x8B6914,
  leaves: 0x4CAF50,
  leavesDark: 0x2E7D32,
  flower: [0xFF6B6B, 0xFFB347, 0xFF69B4, 0xDDA0DD, 0xFFD700, 0xFF8C00],
  path: 0xD2B48C,
  stone: 0x999999,
  mushroom: 0xFF6347,
  bench: 0xA0522D,
  fence: 0xF5F5DC,
};

export function createToonGradient(): THREE.DataTexture {
  const colors = new Uint8Array([
    0, 0, 0,     // dark
    80, 80, 80,  // mid-dark
    160, 160, 160, // mid
    220, 220, 220, // light
    255, 255, 255, // highlight
  ]);
  const tex = new THREE.DataTexture(colors, 5, 1, THREE.RGBFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

// Shared toon gradient — use this in all MeshToonMaterial for consistent macaroon style
export const TOON_GRADIENT = createToonGradient();

/** Create a MeshToonMaterial with the shared gradient map */
export function toonMat(color: number, opts?: { emissive?: number; emissiveIntensity?: number; transparent?: boolean; opacity?: number; side?: THREE.Side }): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: TOON_GRADIENT,
    ...opts,
  });
}
