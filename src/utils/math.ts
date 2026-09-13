import * as THREE from 'three';

// Simple seeded pseudo-random
export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Smooth noise using sine waves (no external lib needed)
export function smoothNoise(x: number, z: number, seed = 42): number {
  const n1 = Math.sin(x * 0.02 + seed) * Math.cos(z * 0.02 + seed * 0.7) * 3;
  const n2 = Math.sin(x * 0.05 + seed * 1.3) * Math.cos(z * 0.04 + seed * 0.9) * 1.5;
  const n3 = Math.sin(x * 0.1 + seed * 2.1) * Math.cos(z * 0.08 + seed * 1.5) * 0.5;
  return n1 + n2 + n3;
}

// Lerp
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Clamp
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// Smooth step
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Random point in circle
export function randomPointInCircle(radius: number, rng: () => number): [number, number] {
  const angle = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * radius;
  return [Math.cos(angle) * r, Math.sin(angle) * r];
}

// Ease in-out
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Rotate local (lx, lz) by angle around origin, then translate by (ox, oz)
export function worldPos(lx: number, lz: number, angle: number, ox: number, oz: number): [number, number] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return [ox + lx * c - lz * s, oz + lx * s + lz * c];
}
