import * as THREE from 'three';
import { seededRandom } from '../utils/math';
import { Water } from './Water';
import { Swing, SeeSaw } from './PlayEquipment';
import { Trampoline, BouncyMushroom, RotatingPlatform, BallPit, Cannon } from './InteractiveObjects';
import { DustPuff, WaterSplash, FountainSpray, GoldenBurst } from './ParticleEffects';
import { LilyPad, GoldenEgg } from './Collectibles';
import { Boat } from './Boat';

// Re-export all classes for backward compatibility
export { Water } from './Water';
export { Swing, SeeSaw } from './PlayEquipment';
export { Trampoline, BouncyMushroom, RotatingPlatform, BallPit, Cannon } from './InteractiveObjects';
export { DustPuff, WaterSplash, FountainSpray, GoldenBurst } from './ParticleEffects';
export { LilyPad, GoldenEgg } from './Collectibles';
export { Boat } from './Boat';

// ==================== World Props ====================

// Build all world props
export class WorldProps {
  water: Water;
  swings: Swing[] = [];
  seeSaws: SeeSaw[] = [];
  lilyPads: LilyPad[] = [];
  goldenEggs: GoldenEgg[] = [];
  trampolines: Trampoline[] = [];
  bouncyMushrooms: BouncyMushroom[] = [];
  rotatingPlatforms: RotatingPlatform[] = [];
  ballPits: BallPit[] = [];
  cannons: Cannon[] = [];
  boat: Boat;

  // Particle effects
  dustPuffs: DustPuff[] = [];
  waterSplash: WaterSplash;
  fountainSpray: FountainSpray;
  goldenBursts: GoldenBurst[] = [];

  // Water area data
  waterCenter = new THREE.Vector3(-30, 0, -20);
  waterRadius = 12;

  // Previous water state for splash detection
  private wasInWater = false;

  constructor(getHeight: (x: number, z: number) => number) {
    // Water (lake)
    this.water = new Water();

    // Swings
    this.swings.push(new Swing(20, -10, getHeight));
    this.swings.push(new Swing(22, -10, getHeight));

    // See-saws (the first moved clear of the lake basin)
    this.seeSaws.push(new SeeSaw(-24, 4, getHeight));
    this.seeSaws.push(new SeeSaw(25, 15, getHeight));

    // Lily pads in the lake
    const rng = seededRandom(321);
    for (let i = 0; i < 8; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 3 + rng() * 6;
      this.lilyPads.push(new LilyPad(
        -30 + Math.cos(angle) * dist,
        -20 + Math.sin(angle) * dist,
      ));
    }

    // Golden eggs (easter eggs)
    this.goldenEggs.push(new GoldenEgg(-80, -80, getHeight));
    this.goldenEggs.push(new GoldenEgg(50, 60, getHeight));
    this.goldenEggs.push(new GoldenEgg(-40, 50, getHeight));

    // Trampolines (kept clear of the clothing shop's footprint at 30,-20)
    this.trampolines.push(new Trampoline(37, -31, getHeight));
    this.trampolines.push(new Trampoline(-35, 25, getHeight));

    // Bouncy mushrooms
    this.bouncyMushrooms.push(new BouncyMushroom(10, -25, 0xFF6B6B, getHeight));
    this.bouncyMushrooms.push(new BouncyMushroom(-12, 18, 0x9B59B6, getHeight));
    this.bouncyMushrooms.push(new BouncyMushroom(35, 10, 0x3498DB, getHeight));
    this.bouncyMushrooms.push(new BouncyMushroom(-20, -35, 0xF39C12, getHeight));
    this.bouncyMushrooms.push(new BouncyMushroom(45, -15, 0x2ECC71, getHeight));

    // Rotating platforms
    this.rotatingPlatforms.push(new RotatingPlatform(40, -40, 3, 0.5, getHeight));
    this.rotatingPlatforms.push(new RotatingPlatform(-45, -10, 2, -0.8, getHeight));

    // Ball pits
    this.ballPits.push(new BallPit(50, 30, 4, getHeight));

    // Cannons
    this.cannons.push(new Cannon(-40, 40, 0, getHeight)); // Shoots toward +Z
    this.cannons.push(new Cannon(60, -20, -Math.PI / 2, getHeight)); // Shoots toward -X

    // Rowboat floating on the lake
    this.boat = new Boat(
      { x: this.waterCenter.x, z: this.waterCenter.z },
      this.waterRadius,
      this.waterCenter.x + 5,
      this.waterCenter.z + 4,
    );

    // Particle effects
    for (let i = 0; i < 3; i++) {
      this.dustPuffs.push(new DustPuff());
    }
    this.waterSplash = new WaterSplash();
    this.fountainSpray = new FountainSpray(0, 0);
    for (let i = 0; i < 3; i++) {
      this.goldenBursts.push(new GoldenBurst());
    }
  }

  /** Returns true if player just entered water this frame */
  update(dt: number, playerPos: THREE.Vector3): { justEnteredWater: boolean; inWater: boolean } {
    this.water.update(performance.now() * 0.001);
    for (const s of this.swings) s.update(dt);
    for (const s of this.seeSaws) s.update(dt);
    for (const l of this.lilyPads) l.update(dt);
    for (const e of this.goldenEggs) e.update(dt, playerPos);
    for (const t of this.trampolines) t.update(dt, playerPos);
    for (const m of this.bouncyMushrooms) m.update(dt, playerPos);
    for (const p of this.rotatingPlatforms) p.update(dt);
    for (const b of this.ballPits) b.update(dt, playerPos);
    for (const c of this.cannons) c.update(dt);
    this.boat.update(dt);

    // Update particles
    for (const d of this.dustPuffs) d.update(dt);
    this.waterSplash.update(dt);
    this.fountainSpray.update(dt, playerPos);
    for (const g of this.goldenBursts) g.update(dt);

    // Check water entry
    const dx = playerPos.x - this.waterCenter.x;
    const dz = playerPos.z - this.waterCenter.z;
    const inWater = Math.sqrt(dx * dx + dz * dz) < this.waterRadius;
    const justEntered = inWater && !this.wasInWater;
    this.wasInWater = inWater;

    return { justEnteredWater: justEntered, inWater };
  }

  /** Get a free dust puff emitter */
  getDustPuff(): DustPuff | null {
    return this.dustPuffs.find(d => !d.alive) || null;
  }

  /** Get a free golden burst emitter */
  getGoldenBurst(): GoldenBurst | null {
    return this.goldenBursts.find(g => !g.alive) || null;
  }

  /** Check if player is near any lily pad. Returns the pad or null. */
  checkLilyPads(px: number, py: number, pz: number): LilyPad | null {
    for (const pad of this.lilyPads) {
      if (pad.checkPlayerOn(px, py, pz)) return pad;
    }
    return null;
  }

  /** Find nearest interactable within range. Returns { label, type, obj } or null. */
  findNearInteractable(px: number, pz: number): { label: string; type: string } | null {
    for (const s of this.swings) {
      if (s.isNear(px, pz)) return { label: s.interactLabel, type: 'swing' };
    }
    for (const s of this.seeSaws) {
      if (s.isNear(px, pz)) return { label: s.interactLabel, type: 'seesaw' };
    }
    return null;
  }

  addToScene(scene: THREE.Scene) {
    scene.add(this.water.mesh);
    for (const s of this.swings) scene.add(s.group);
    for (const s of this.seeSaws) scene.add(s.group);
    for (const l of this.lilyPads) scene.add(l.mesh);
    for (const e of this.goldenEggs) scene.add(e.mesh);
    for (const t of this.trampolines) scene.add(t.group);
    for (const m of this.bouncyMushrooms) scene.add(m.group);
    for (const p of this.rotatingPlatforms) scene.add(p.group);
    for (const b of this.ballPits) scene.add(b.group);
    for (const c of this.cannons) { scene.add(c.group); scene.add(c.projectiles); }
    scene.add(this.boat.group);
    // Particle systems
    for (const d of this.dustPuffs) scene.add(d.particles);
    scene.add(this.waterSplash.particles);
    scene.add(this.fountainSpray.particles);
    for (const g of this.goldenBursts) scene.add(g.particles);
  }
}
