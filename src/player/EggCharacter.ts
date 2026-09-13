import * as THREE from 'three';
import { COLORS, toonMat } from '../utils/colors';
import { lerp } from '../utils/math';
import { OUTFITS, OutfitStyle, buildOutfit } from './Outfit';
import type { WingRig } from './Wings';

export class EggCharacter {
  group: THREE.Group;
  body: THREE.Mesh;
  leftEye: THREE.Group;
  rightEye: THREE.Group;
  leftFoot: THREE.Mesh;
  rightFoot: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;

  // Physics state
  position = new THREE.Vector3(0, 2, 0);
  velocity = new THREE.Vector3();
  onGround = false;
  eggColor: number;

  // Wings come from the wings equipment slot; the air-flap action drives them.
  private wingRig: WingRig | null = null;

  // Animation state
  private walkPhase = 0;
  private blinkTimer = 0;
  private isBlinking = false;
  private squash = 1;
  private sitting = false;
  private flapPhase = 0;
  private flapBoost = 0;

  // Lying on a bed
  private lying = false;
  private lieProgress = 0;
  private liePos = new THREE.Vector3();
  private lieYaw = 0;

  // Eye tracking state
  private leftHighlight!: THREE.Mesh;
  private rightHighlight!: THREE.Mesh;
  private eyeTargetX = 0;   // current smoothed offset X
  private eyeTargetY = 0;   // current smoothed offset Y
  private desiredEyeX = 0;  // desired offset X
  private desiredEyeY = 0;  // desired offset Y
  private idleEyeTimer = 0;
  private idleEyeX = 0;
  private idleEyeY = 0;
  private static readonly EYE_MAX_OFFSET = 0.02;
  private static readonly EYE_HL_BASE_X = 0.03;
  private static readonly EYE_HL_BASE_Y = 0.03;

  // Equipment attachment points
  private equipSlots: Record<string, THREE.Group> = {};
  private equipMeshes: Record<string, THREE.Group | null> = {
    hat: null, face: null, back: null, wings: null, held: null,
  };

  constructor(color: number, outfit: OutfitStyle = OUTFITS[0]) {
    this.eggColor = color;
    this.group = new THREE.Group();

    // --- Body (egg shape via LatheGeometry) ---
    const pts: THREE.Vector2[] = [];
    const segments = 24;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = t * Math.PI;
      // Egg profile: wider at bottom, narrower at top
      let r = Math.sin(angle);
      // Asymmetric: push more volume to bottom
      const eggFactor = 1 - 0.3 * (t - 0.5);
      r *= eggFactor;
      // Minimum radius at top
      r = Math.max(r, 0.01);
      const y = -Math.cos(angle) * 0.65;
      pts.push(new THREE.Vector2(r * 0.55, y));
    }

    const bodyGeo = new THREE.LatheGeometry(pts, 32);
    const bodyMat = toonMat(color);
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.castShadow = true;
    this.group.add(this.body);

    // --- Eyes (face toward -Z) ---
    const eyeY = 0.235;
    const eyeX = 0.135;
    const eyeZ = -Math.sqrt(Math.max(0.01,
      EggCharacter.bodyRadiusAt(eyeY) ** 2 - eyeX * eyeX)) + 0.03;

    this.leftEye = this.createEye();
    this.leftEye.position.set(-eyeX, eyeY, eyeZ);
    this.leftEye.rotation.y = 0.3;   // tilt outward to follow the curved face
    this.group.add(this.leftEye);

    this.rightEye = this.createEye();
    this.rightEye.position.set(eyeX, eyeY, eyeZ);
    this.rightEye.rotation.y = -0.3;
    this.group.add(this.rightEye);

    // Store highlight references for eye tracking
    this.leftHighlight = this.leftEye.children.find(c => c.name === 'eyeHighlight') as THREE.Mesh;
    this.rightHighlight = this.rightEye.children.find(c => c.name === 'eyeHighlight') as THREE.Mesh;

    // --- Blush (soft oval cheeks) ---
    const blushGeo = new THREE.CircleGeometry(0.075, 20);
    blushGeo.scale(1.35, 0.85, 1);
    const blushMat = toonMat(COLORS.blush, { transparent: true, opacity: 0.42 });
    const blushY = 0.055;
    const blushX = 0.29;
    const blushZ = -Math.sqrt(Math.max(0.01,
      EggCharacter.bodyRadiusAt(blushY) ** 2 - blushX * blushX)) - 0.005;
    for (const side of [-1, 1]) {
      const blush = new THREE.Mesh(blushGeo, blushMat);
      blush.position.set(side * blushX, blushY, blushZ);
      blush.lookAt(side * blushX * 2, blushY, blushZ * 2);
      this.group.add(blush);
    }

    // --- Mouth (small smile curve) ---
    const mouthShape = new THREE.Shape();
    mouthShape.moveTo(-0.055, 0);
    mouthShape.quadraticCurveTo(0, -0.032, 0.055, 0);
    const mouthGeo = new THREE.ShapeGeometry(mouthShape);
    const mouthMat = toonMat(COLORS.mouth);
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, 0.105, -EggCharacter.bodyRadiusAt(0.105) - 0.01);
    mouth.lookAt(0, 0.05, -2);
    this.group.add(mouth);

    // --- Feet ---
    const footGeo = new THREE.SphereGeometry(0.11, 12, 8);
    footGeo.scale(1.2, 0.55, 1.5);
    const footMat = toonMat(color);

    this.leftFoot = new THREE.Mesh(footGeo, footMat);
    this.leftFoot.position.set(-0.17, -0.6, -0.24);
    this.leftFoot.castShadow = true;
    this.group.add(this.leftFoot);

    this.rightFoot = new THREE.Mesh(footGeo, footMat);
    this.rightFoot.position.set(0.17, -0.6, -0.24);
    this.rightFoot.castShadow = true;
    this.group.add(this.rightFoot);

    // --- Arms ---
    const armGeo = new THREE.SphereGeometry(0.085, 8, 8);
    armGeo.scale(0.85, 1.25, 0.85);
    const armMat = toonMat(color);

    this.leftArm = new THREE.Mesh(armGeo, armMat);
    this.leftArm.position.set(-0.58, 0, -0.05);
    this.group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, armMat);
    this.rightArm.position.set(0.58, 0, -0.05);
    this.group.add(this.rightArm);

    // --- Outfit (attached to the body so it squashes and leans with the torso) ---
    this.body.add(buildOutfit(outfit));

    this.group.position.copy(this.position);

    // --- Equipment attachment points ---
    const hatSlot = new THREE.Group();
    hatSlot.position.set(0, 0.55, -0.05);
    this.group.add(hatSlot);
    this.equipSlots.hat = hatSlot;

    const faceSlot = new THREE.Group();
    faceSlot.position.set(0, 0.15, -0.48);
    this.group.add(faceSlot);
    this.equipSlots.face = faceSlot;

    const backSlot = new THREE.Group();
    backSlot.position.set(0, 0.1, 0.3);
    this.group.add(backSlot);
    this.equipSlots.back = backSlot;

    // Wings sit on the upper back, level with the shoulder blades
    const wingsSlot = new THREE.Group();
    wingsSlot.position.set(0, 0.1, 0.3);
    this.group.add(wingsSlot);
    this.equipSlots.wings = wingsSlot;

    const heldSlot = new THREE.Group();
    heldSlot.position.set(0.55, 0, -0.05);
    this.group.add(heldSlot);
    this.equipSlots.held = heldSlot;
  }

  /** Attach a 3D mesh to an equipment slot */
  setEquipment(slot: string, mesh: THREE.Group | null) {
    // Remove current mesh in slot
    if (this.equipMeshes[slot]) {
      this.equipSlots[slot]?.remove(this.equipMeshes[slot]!);
      this.equipMeshes[slot] = null;
    }
    // Attach new mesh
    if (mesh && this.equipSlots[slot]) {
      this.equipSlots[slot].add(mesh);
      this.equipMeshes[slot] = mesh;
    }
    // Wings carry a flap rig, so remember it (or clear it) as the slot changes
    if (slot === 'wings') {
      this.wingRig = (mesh?.userData.wingRig as WingRig | undefined) ?? null;
    }
  }

  /** True when a flying wing style is equipped — mid-air flapping needs these. */
  hasWings(): boolean {
    return this.wingRig !== null;
  }

  /** Remove equipment from a slot */
  removeEquipment(slot: string) {
    this.setEquipment(slot, null);
  }

  /** Body radius at height y — used to sit face features on the surface, not inside it. */
  private static bodyRadiusAt(y: number): number {
    const c = Math.max(-1, Math.min(1, -y / 0.65));
    const a = Math.acos(c);
    const t = a / Math.PI;
    return Math.sin(a) * (1 - 0.3 * (t - 0.5)) * 0.55;
  }

  private updateWings(dt: number) {
    if (!this.wingRig) return;
    const airborne = !this.onGround;
    // Fast beats in the air, a lazy idle flutter on the ground.
    this.flapPhase += dt * (airborne ? 16 : 4.5);
    this.flapBoost = Math.max(0, this.flapBoost - dt * 3.5);
    const amp = (airborne ? 0.5 : 0.22) + this.flapBoost * 0.35;
    const flap = Math.sin(this.flapPhase) * amp + this.flapBoost * 0.7;
    this.wingRig.setFlap(flap);
  }

  private createEye(): THREE.Group {
    const eye = new THREE.Group();

    // Large dark oval — the signature 蛋仔 eye
    const outer = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 18, 14),
      toonMat(COLORS.eye),
    );
    outer.scale.set(1.0, 1.12, 0.92);
    eye.add(outer);

    // Big catch-light, offset up and out
    const hl = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 8),
      new THREE.MeshBasicMaterial({ color: COLORS.eyeHighlight }),
    );
    hl.position.set(EggCharacter.EYE_HL_BASE_X, EggCharacter.EYE_HL_BASE_Y, -0.075);
    hl.scale.z = 0.6;
    hl.name = 'eyeHighlight';
    eye.add(hl);

    // Small secondary glint for a glossier look
    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 8, 6),
      new THREE.MeshBasicMaterial({ color: COLORS.eyeHighlight, transparent: true, opacity: 0.8 }),
    );
    glint.position.set(-0.032, -0.038, -0.078);
    glint.scale.z = 0.6;
    eye.add(glint);

    return eye;
  }

  setSitting(sitting: boolean) {
    this.sitting = sitting;
  }

  /**
   * Lie down on a bed (or get up).
   * @param pos world position of the mattress surface the body should settle onto
   * @param yaw direction of the bed's long axis
   */
  setLying(lying: boolean, pos?: THREE.Vector3, yaw = 0) {
    this.lying = lying;
    if (lying) {
      if (pos) this.liePos.copy(pos);
      this.lieYaw = yaw;
    } else {
      this.lieProgress = 0;
      this.group.rotation.order = 'XYZ';
      this.group.rotation.x = 0;
      this.group.rotation.z = 0;
    }
  }

  /**
   * Set where the character's eyes should look.
   * @param dirX camera-forward X (world space) or 0 for idle
   * @param dirZ camera-forward Z (world space) or 0 for idle
   */
  setEyeTarget(dirX: number, dirZ: number) {
    const rotY = this.group.rotation.y;
    const cosR = Math.cos(rotY);
    const sinR = Math.sin(rotY);
    // Convert the world direction into character-local space.
    // rotation.y = θ maps local (lx, lz) to world (lx·cosθ + lz·sinθ, -lx·sinθ + lz·cosθ),
    // so the inverse (used here) negates the off-diagonal terms.
    const localX = dirX * cosR - dirZ * sinR;
    const localZ = dirX * sinR + dirZ * cosR;

    // Map local direction to eye offset.
    // Callers pass a horizontal camera direction, so only the sideways component drives
    // the gaze: localZ there measures alignment with the facing, not a vertical angle.
    const maxOff = EggCharacter.EYE_MAX_OFFSET;
    this.desiredEyeX = localX * maxOff * 2; // amplify slightly for visibility
    this.desiredEyeY = 0;

    // Clamp to max offset
    const len = Math.sqrt(this.desiredEyeX * this.desiredEyeX + this.desiredEyeY * this.desiredEyeY);
    if (len > maxOff) {
      this.desiredEyeX *= maxOff / len;
      this.desiredEyeY *= maxOff / len;
    }
  }

  update(dt: number, isMoving: boolean, isSprinting: boolean) {
    // Wings animate in every pose so they never freeze mid-beat
    this.updateWings(dt);

    // Lying on a bed
    if (this.lying) {
      this.lieProgress = lerp(this.lieProgress, 1, dt * 4);
      // Lie back on the mattress: YXZ order yaws first, then pitches the egg flat.
      // The egg's narrow end points along the bed's -Z (toward the pillow), face up.
      this.group.rotation.order = 'YXZ';
      this.group.rotation.x = (-Math.PI / 2) * this.lieProgress;
      this.group.rotation.y = this.lieYaw;

      const k = Math.min(dt * 5, 1);
      this.group.position.x = lerp(this.group.position.x, this.liePos.x, k);
      this.group.position.y = lerp(this.group.position.y, this.liePos.y, k);
      this.group.position.z = lerp(this.group.position.z, this.liePos.z, k);

      // Relax the limbs
      this.body.rotation.x = lerp(this.body.rotation.x, 0, dt * 5);
      for (const foot of [this.leftFoot, this.rightFoot]) {
        foot.position.y = lerp(foot.position.y, -0.6, dt * 5);
        foot.position.z = lerp(foot.position.z, -0.24, dt * 5);
      }
      for (const arm of [this.leftArm, this.rightArm]) {
        arm.position.y = lerp(arm.position.y, 0, dt * 5);
        arm.position.z = lerp(arm.position.z, -0.05, dt * 5);
      }

      // Keep the logical position on the bed so waking up starts from here
      this.position.copy(this.group.position);
      this.updateFace(dt, false);
      return;
    }

    // Sitting pose
    if (this.sitting) {
      this.body.rotation.x = lerp(this.body.rotation.x, -0.1, dt * 5);
      this.leftFoot.position.y = lerp(this.leftFoot.position.y, -0.45, dt * 8);
      this.rightFoot.position.y = lerp(this.rightFoot.position.y, -0.45, dt * 8);
      this.leftFoot.position.z = lerp(this.leftFoot.position.z, -0.25, dt * 8);
      this.rightFoot.position.z = lerp(this.rightFoot.position.z, -0.25, dt * 8);
      this.leftArm.position.z = lerp(this.leftArm.position.z, -0.15, dt * 5);
      this.rightArm.position.z = lerp(this.rightArm.position.z, -0.15, dt * 5);
      this.leftArm.position.y = lerp(this.leftArm.position.y, -0.1, dt * 5);
      this.rightArm.position.y = lerp(this.rightArm.position.y, -0.1, dt * 5);
      this.group.position.y = this.position.y - 0.15; // Lower when sitting
      this.group.position.x = this.position.x;
      this.group.position.z = this.position.z;
      this.updateFace(dt, false);
      return;
    }

    // Walking animation
    if (isMoving) {
      const speed = isSprinting ? 12 : 8;
      this.walkPhase += dt * speed;

      // Body lean
      const leanAmount = isSprinting ? 0.15 : 0.08;
      this.body.rotation.x = Math.sin(this.walkPhase * 0.5) * leanAmount;

      // Foot animation
      const footSwing = Math.sin(this.walkPhase) * 0.3;
      this.leftFoot.position.y = -0.6 + Math.abs(Math.sin(this.walkPhase)) * 0.1;
      this.rightFoot.position.y = -0.6 + Math.abs(Math.sin(this.walkPhase + Math.PI)) * 0.1;
      this.leftFoot.position.z = -0.24 + footSwing * 0.1;
      this.rightFoot.position.z = -0.24 - footSwing * 0.1;

      // Arm swing
      this.leftArm.position.z = -0.05 + Math.sin(this.walkPhase) * 0.15;
      this.rightArm.position.z = -0.05 - Math.sin(this.walkPhase) * 0.15;
      this.leftArm.position.y = Math.sin(this.walkPhase + Math.PI) * 0.05;
      this.rightArm.position.y = Math.sin(this.walkPhase) * 0.05;
    } else {
      // Reset to idle
      this.body.rotation.x = lerp(this.body.rotation.x, 0, dt * 5);
      this.leftFoot.position.y = lerp(this.leftFoot.position.y, -0.6, dt * 8);
      this.rightFoot.position.y = lerp(this.rightFoot.position.y, -0.6, dt * 8);
      this.leftFoot.position.z = lerp(this.leftFoot.position.z, -0.24, dt * 8);
      this.rightFoot.position.z = lerp(this.rightFoot.position.z, -0.24, dt * 8);
      this.leftArm.position.z = lerp(this.leftArm.position.z, -0.05, dt * 5);
      this.rightArm.position.z = lerp(this.rightArm.position.z, -0.05, dt * 5);
      this.leftArm.position.y = lerp(this.leftArm.position.y, 0, dt * 5);
      this.rightArm.position.y = lerp(this.rightArm.position.y, 0, dt * 5);
      this.walkPhase = 0;
    }

    // Idle bob (only subtle when not moving)
    if (!isMoving) {
      const bob = Math.sin(Date.now() * 0.002) * 0.01;
      this.group.position.y = this.position.y + bob;
    } else {
      this.group.position.y = this.position.y;
    }

    this.updateFace(dt, isMoving);

    // Squash & stretch (for jumping/landing)
    this.squash = lerp(this.squash, 1, dt * 10);
    this.body.scale.set(1 / Math.sqrt(this.squash), this.squash, 1 / Math.sqrt(this.squash));

    // Update horizontal position
    this.group.position.x = this.position.x;
    this.group.position.z = this.position.z;
  }


  /** Blink + eye tracking. Runs in every pose so the face never freezes. */
  private updateFace(dt: number, isMoving: boolean) {
    // Blink
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      if (this.isBlinking) {
        this.isBlinking = false;
        this.blinkTimer = 2 + Math.random() * 4;
        this.leftEye.scale.y = 1;
        this.rightEye.scale.y = 1;
      } else {
        this.isBlinking = true;
        this.blinkTimer = 0.1;
        this.leftEye.scale.y = 0.1;
        this.rightEye.scale.y = 0.1;
      }
    }

    // Eye tracking: idle drift or follow target
    if (!isMoving) {
      this.idleEyeTimer -= dt;
      if (this.idleEyeTimer <= 0) {
        // Pick a new random look target
        this.idleEyeX = (Math.random() - 0.5) * 2 * EggCharacter.EYE_MAX_OFFSET;
        this.idleEyeY = (Math.random() - 0.5) * 2 * EggCharacter.EYE_MAX_OFFSET;
        this.idleEyeTimer = 1.5 + Math.random() * 3;
      }
      this.desiredEyeX = this.idleEyeX;
      this.desiredEyeY = this.idleEyeY;
    }
    // Smooth the eye position
    this.eyeTargetX = lerp(this.eyeTargetX, this.desiredEyeX, dt * 5);
    this.eyeTargetY = lerp(this.eyeTargetY, this.desiredEyeY, dt * 5);
    // Apply to both highlight meshes
    if (this.leftHighlight) {
      this.leftHighlight.position.x = EggCharacter.EYE_HL_BASE_X + this.eyeTargetX;
      this.leftHighlight.position.y = EggCharacter.EYE_HL_BASE_Y + this.eyeTargetY;
    }
    if (this.rightHighlight) {
      this.rightHighlight.position.x = EggCharacter.EYE_HL_BASE_X + this.eyeTargetX;
      this.rightHighlight.position.y = EggCharacter.EYE_HL_BASE_Y + this.eyeTargetY;
    }
  }

  onLand() {
    this.squash = 0.7; // Squash on landing
  }

  onJump() {
    this.squash = 1.3; // Stretch on jump
  }

  /** Snap the wings into a strong upstroke — this is what lifts the egg. */
  onFlap() {
    this.flapBoost = 1;
    this.flapPhase = Math.PI / 2; // resume the beat at the top of the upstroke
    this.squash = 1.15;
  }
}
