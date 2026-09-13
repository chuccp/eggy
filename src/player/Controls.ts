import * as THREE from 'three';
import { Input } from '../game/Input';
import { ThirdPersonCamera } from './Camera';
import { EggCharacter } from './EggCharacter';
import { clamp } from '../utils/math';
import type { Collider, SlideData } from '../world/Terrain';
import type { WorldProps } from '../world/Props';
import type { Swing, SeeSaw } from '../world/PlayEquipment';
import type { Cannon } from '../world/InteractiveObjects';
import type { ShopDisplayManager, ShopDisplay, ShopCounter } from '../world/ShopDisplay';
import type { Houses, BuiltHouse, BedSpot } from '../world/Houses';
import type { NPCManager } from '../world/NPC';
import type { PhysicsWorld } from '../game/Physics';

const WALK_SPEED = 5;
const SPRINT_SPEED = 9;
const JUMP_FORCE = 8;
// Upward kick per mid-air space tap. Slightly under gravity's pull over one tap, so a
// steady rhythm of taps climbs but a single tap just floats.
const FLAP_FORCE = 8;
const GROUND_Y = 0.65;
const PLAYER_RADIUS = 0.4;
const PLAYER_HEIGHT = 1.2;
const WATER_SPEED_MULT = 0.45;
const WATER_JUMP_MULT = 0.4;

// World boundary pushback constants
const BOUNDARY = 95;
const PUSHBACK_ZONE = 3; // start pushback within 3 units of boundary (at ±92)
const PUSHBACK_STRENGTH = 15; // force magnitude at the boundary edge
const FALL_RECOVERY_Y = -10;

export class Controls {
  private targetRotation = 0;
  private onSlide = false;

  // Interaction state
  nearbyInteractable: { label: string; type: string } | null = null;
  private isSitting = false;
  private isLying = false;
  private onBoat = false;
  private currentBed: BedSpot | null = null;
  private onSwing: Swing | null = null;
  private onSeeSaw: SeeSaw | null = null;

  // Water state
  inWater = false;

  // External collision push-back
  collisionPushX = 0;
  collisionPushZ = 0;

  // Impulses from props (cannon launch, rotating platform carry). They decay over a few
  // frames so the movement is applied by the rigid body instead of teleporting the player.
  private carryX = 0;
  private carryZ = 0;

  // Dust puff + audio callbacks
  onLand?: (x: number, y: number, z: number) => void;
  onJump?: () => void;
  onFlap?: () => void;
  /** Fired when the player tries to flap mid-air without wings equipped. */
  onNoWings?: () => void;
  onSwingPush?: () => void;
  onBounce?: () => void;
  onWaterSplash?: () => void;
  onFallRecovery?: () => void;

  // House/Shop/Inventory/NPC callbacks
  onNearDoor?: (info: { label: string; isShop: boolean }) => void;
  onEnterShop?: (shopType: string) => void;
  onEnterHouse?: (name: string) => void;
  getShopVisible?: () => boolean;
  onShopKey?: (key: string) => boolean;
  getInventoryVisible?: () => boolean;
  onInventoryKey?: (key: string) => boolean;
  onToggleInventory?: () => void;
  onNPCInteract?: (message: string) => void;
  onSleep?: (sleeping: boolean) => void;
  onCannonFire?: () => void;
  onBuyDisplay?: (display: ShopDisplay) => void;
  onSellAtCounter?: (counter: ShopCounter) => void;
  onPauseMenu?: () => void;
  getPauseVisible?: () => boolean;
  onPauseKey?: (key: string) => boolean;

  // Stored colliders for camera obstacle handling
  private currentColliders: Collider[] = [];

  constructor(
    private input: Input,
    private camera: ThirdPersonCamera,
    private character: EggCharacter,
    private physics: PhysicsWorld,
    private shopDisplays: ShopDisplayManager,
  ) {}

  /**
   * Clear every state that locks movement or drives the character's pose.
   * Call before teleporting, otherwise a seated/lying character gets pulled back
   * to the bench/bed and the player can't move.
   */
  reset() {
    this.isSitting = false;
    this.isLying = false;
    this.onBoat = false;
    this.currentBed = null;
    this.onSwing = null;
    this.onSeeSaw = null;
    // teleport also clears the body's velocity
    this.physics.teleport(
      this.character.position.x, this.character.position.y, this.character.position.z,
    );
    this.collisionPushX = 0;
    this.collisionPushZ = 0;
    this.carryX = 0;
    this.carryZ = 0;
    this.character.setSitting(false);
    this.character.setLying(false);
    this.camera.setRestingMode(false);
  }

  update(
    dt: number,
    getHeightAt: (x: number, z: number) => number,
    colliders: Collider[],
    slideData: SlideData | null,
    worldProps: WorldProps,
    houses: Houses,
    npcManager?: NPCManager,
  ) {
    const { character, camera, input } = this;
    this.currentColliders = colliders;

    // Pause menu takes priority
    if (this.getPauseVisible?.()) {
      if (input.wasJustPressed('Escape')) this.onPauseKey?.('Escape');
      character.update(dt, false, false);
      camera.update(character.position, dt);
      input.consumeJustPressed();
      return;
    }

    // ESC toggles pause menu
    if (input.wasJustPressed('Escape')) {
      this.onPauseMenu?.();
      input.consumeJustPressed();
      return;
    }

    // If any overlay UI is open, only handle its keys
    if (this.getShopVisible?.()) {
      const { dx, dy } = input.consumeMouseDelta();
      if (dx !== 0 || dy !== 0) camera.handleMouse(dx, dy);
      const scroll = input.consumeScrollDelta();
      if (scroll !== 0) camera.handleScroll(scroll);
      if (input.wasJustPressed('Escape') || input.wasJustPressed('KeyQ')) this.onShopKey?.('Escape');
      if (input.wasJustPressed('Tab')) this.onShopKey?.('Tab');
      if (input.wasJustPressed('KeyW') || input.wasJustPressed('ArrowUp')) this.onShopKey?.('ArrowUp');
      if (input.wasJustPressed('KeyS') || input.wasJustPressed('ArrowDown')) this.onShopKey?.('ArrowDown');
      if (input.wasJustPressed('Enter') || input.wasJustPressed('KeyE')) this.onShopKey?.('Enter');
      character.update(dt, false, false);
      camera.update(character.position, dt);
      input.consumeJustPressed();
      return;
    }

    if (this.getInventoryVisible?.()) {
      const { dx, dy } = input.consumeMouseDelta();
      if (dx !== 0 || dy !== 0) camera.handleMouse(dx, dy);
      const scroll = input.consumeScrollDelta();
      if (scroll !== 0) camera.handleScroll(scroll);
      if (input.wasJustPressed('Escape') || input.wasJustPressed('KeyI') || input.wasJustPressed('KeyQ')) this.onInventoryKey?.('Escape');
      if (input.wasJustPressed('Tab')) this.onInventoryKey?.('Tab');
      if (input.wasJustPressed('KeyA') || input.wasJustPressed('ArrowLeft')) this.onInventoryKey?.('ArrowLeft');
      if (input.wasJustPressed('KeyD') || input.wasJustPressed('ArrowRight')) this.onInventoryKey?.('ArrowRight');
      if (input.wasJustPressed('Enter') || input.wasJustPressed('KeyE')) this.onInventoryKey?.('Enter');
      if (input.wasJustPressed('KeyR')) this.onInventoryKey?.('KeyR');
      character.update(dt, false, false);
      camera.update(character.position, dt);
      input.consumeJustPressed();
      return;
    }

    // Mouse look
    const { dx, dy } = input.consumeMouseDelta();
    if (dx !== 0 || dy !== 0) {
      camera.handleMouse(dx, dy);
    }

    // Scroll zoom
    const scroll = input.consumeScrollDelta();
    if (scroll !== 0) {
      camera.handleScroll(scroll);
    }

    // --- I-key toggle inventory ---
    if (input.wasJustPressed('KeyI')) {
      this.onToggleInventory?.();
      input.consumeJustPressed();
      return;
    }

    // --- E-key interactions (single press) ---
    const eJustPressed = input.wasJustPressed('KeyE');
    this.nearbyInteractable = null;

    // Find nearby interactable from world props
    const nearInteract = worldProps.findNearInteractable(character.position.x, character.position.z);

    // Bench proximity check
    let nearBench = false;
    const benchPositions: [number, number][] = [[6, 4], [-6, -4], [15, 20]];
    for (const [bx, bz] of benchPositions) {
      const dxb = character.position.x - bx;
      const dzb = character.position.z - bz;
      if (Math.sqrt(dxb * dxb + dzb * dzb) < 2.0) {
        nearBench = true;
        break;
      }
    }

    // House door proximity check
    const nearDoor = houses.findNearDoor(character.position.x, character.position.z);

    // Bed proximity check
    const nearBed = houses.findNearBed(character.position.x, character.position.z);

    // Boat proximity check
    const nearBoat = worldProps.boat.isNear(character.position.x, character.position.z);

    // Shop goods (buy) and the counter (sell)
    const nearDisplay = this.shopDisplays.findNear(character.position.x, character.position.z);
    const nearCounter = nearDisplay
      ? null
      : this.shopDisplays.findNearCounter(character.position.x, character.position.z);

    // Cannon proximity check
    let nearCannon: Cannon | null = null;
    for (const c of worldProps.cannons) {
      if (c.isNear(character.position.x, character.position.z)) { nearCannon = c; break; }
    }

    // NPC proximity check
    const nearNPC = npcManager?.findNearNPC(character.position);

    if (nearInteract) {
      this.nearbyInteractable = nearInteract;
    } else if (nearNPC) {
      this.nearbyInteractable = { label: nearNPC.interactLabel, type: 'npc' };
    } else if (nearDoor) {
      this.nearbyInteractable = { label: nearDoor.label, type: nearDoor.isShop ? 'shop' : 'house' };
    } else if (nearDisplay) {
      this.nearbyInteractable = { label: nearDisplay.interactLabel, type: 'shopBuy' };
    } else if (nearCounter) {
      this.nearbyInteractable = { label: `按 E 在 ${nearCounter.name} 出售物品`, type: 'shopSell' };
    } else if (nearCannon) {
      this.nearbyInteractable = { label: nearCannon.canFire() ? '按 E 开炮' : '装填中…', type: 'cannon' };
    } else if (nearBoat) {
      this.nearbyInteractable = { label: this.onBoat ? '按 E 下船' : '按 E 上船', type: 'boat' };
    } else if (nearBed) {
      this.nearbyInteractable = { label: this.isLying ? '按 E 起来' : '按 E 上床睡觉', type: 'bed' };
    } else if (nearBench) {
      this.nearbyInteractable = { label: this.isSitting ? '按 E 站起来' : '按 E 坐下休息', type: 'bench' };
    }

    // Handle E key press
    if (eJustPressed) {
      // Dismount if already on swing/seesaw
      if (this.onSwing) {
        this.onSwing = null;
      } else if (this.onSeeSaw) {
        this.onSeeSaw = null;
      } else if (nearInteract?.type === 'swing') {
        // Mount nearest swing
        let closest: Swing | null = null;
        let closestDist = Infinity;
        for (const s of worldProps.swings) {
          const d = Math.sqrt(
            (character.position.x - s.x) ** 2 + (character.position.z - s.z) ** 2,
          );
          if (d < closestDist) { closestDist = d; closest = s; }
        }
        if (closest) {
          this.onSwing = closest as Swing;
          (closest as Swing).push(1.5);
          this.onSwingPush?.();
        }
      } else if (nearInteract?.type === 'seesaw') {
        // Mount nearest seesaw
        let closest: SeeSaw | null = null;
        let closestDist = Infinity;
        for (const s of worldProps.seeSaws) {
          const d = Math.sqrt(
            (character.position.x - s.x) ** 2 + (character.position.z - s.z) ** 2,
          );
          if (d < closestDist) { closestDist = d; closest = s; }
        }
        if (closest) {
          this.onSeeSaw = closest as SeeSaw;
          const side = character.position.x - (closest as SeeSaw).x;
          (closest as SeeSaw).push(side > 0 ? 2 : -2);
        }
      } else if (nearNPC) {
        this.onNPCInteract?.(nearNPC.greet());
      } else if (nearDoor) {
        if (nearDoor.isShop && nearDoor.house.def.shopType) {
          this.onEnterShop?.(nearDoor.house.def.shopType);
        } else {
          this.onEnterHouse?.(nearDoor.house.def.name);
        }
      } else if (nearDisplay) {
        this.onBuyDisplay?.(nearDisplay);
      } else if (nearCounter) {
        this.onSellAtCounter?.(nearCounter);
      } else if (nearCannon) {
        if (nearCannon.fire()) this.onCannonFire?.();
      } else if (nearBoat || this.onBoat) {
        if (this.onBoat) {
          // Step out onto the nearest shore
          const dock = worldProps.boat.dockPosition();
          this.onBoat = false;
          character.setSitting(false);
          character.position.set(dock.x, getHeightAt(dock.x, dock.z) + GROUND_Y, dock.z);
          this.physics.teleport(character.position.x, character.position.y, character.position.z);
          camera.setRestingMode(false);
        } else {
          this.onBoat = true;
          character.position.set(
            worldProps.boat.seatPosition().x,
            worldProps.boat.seatPosition().y,
            worldProps.boat.seatPosition().z,
          );
          character.setSitting(true);
          this.physics.teleport(character.position.x, character.position.y, character.position.z);
          camera.setRestingMode(true);
        }
      } else if (nearBed || this.isLying) {
        if (this.isLying) {
          // Get up and stand beside the bed
          const bed = this.currentBed!;
          this.isLying = false;
          this.currentBed = null;
          character.setLying(false);
          character.position.set(bed.standX, getHeightAt(bed.standX, bed.standZ) + GROUND_Y, bed.standZ);
          this.physics.teleport(character.position.x, character.position.y, character.position.z);
          this.targetRotation = bed.yaw;
          camera.setRestingMode(false);
          this.onSleep?.(false);
        } else {
          const bed = nearBed!.bed;
          this.isLying = true;
          this.currentBed = bed;
          character.setLying(true, new THREE.Vector3(bed.x, bed.y + 0.5, bed.z), bed.yaw);
          this.physics.teleport(character.position.x, character.position.y, character.position.z);
          camera.setRestingMode(true);
          this.onSleep?.(true);
        }
      } else if (nearBench) {
        this.isSitting = !this.isSitting;
        character.setSitting(this.isSitting);
        camera.setRestingMode(this.isSitting);
      }
    }

    // Rowing the boat
    if (this.onBoat) {
      const throttle = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
      const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      worldProps.boat.drive(throttle, steer, dt);
      worldProps.update(dt, character.position); // advances the boat this frame
      const seat = worldProps.boat.seatPosition();
      character.position.set(seat.x, seat.y, seat.z);
      this.physics.teleport(seat.x, seat.y, seat.z);
      this.targetRotation = worldProps.boat.heading + Math.PI;
      if (input.jump) {
        const dock = worldProps.boat.dockPosition();
        this.onBoat = false;
        character.setSitting(false);
        character.position.set(dock.x, getHeightAt(dock.x, dock.z) + GROUND_Y, dock.z);
        this.physics.teleport(character.position.x, character.position.y, character.position.z);
        camera.setRestingMode(false);
      } else {
        character.update(dt, false, false);
      }
      camera.update(character.position, dt);
      input.consumeJustPressed();
      return;
    }

    // If sitting, skip movement
    if (this.isSitting) {
      this.physics.teleport(character.position.x, character.position.y, character.position.z);
      character.update(dt, false, false);
      camera.update(character.position, dt);
      input.consumeJustPressed();
      return;
    }

    // If lying in bed, skip movement (press E to get up)
    if (this.isLying) {
      this.physics.teleport(character.position.x, character.position.y, character.position.z);
      character.update(dt, false, false);
      camera.update(character.position, dt);
      input.consumeJustPressed();
      return;
    }

    // If riding a swing
    if (this.onSwing) {
      const s = this.onSwing;
      // WASD applies force
      if (input.forward) s.push(dt * 3);
      if (input.backward) s.push(-dt * 3);
      if (input.left) s.push(-dt * 2);
      if (input.right) s.push(dt * 2);
      // Jump to dismount
      if (input.jump) {
        this.onSwing = null;
        this.physics.jump(JUMP_FORCE * 0.6);
        character.onGround = false;
        character.onJump();
      } else {
        // Follow swing seat position
        const seatY = s.seat.position.y ?? 0.7;
        const seatWorldY = s.baseY + s.group.position.y + seatY;
        character.position.set(s.x, seatWorldY + GROUND_Y * 0.5, s.z);
        this.physics.teleport(character.position.x, character.position.y, character.position.z);
        character.update(dt, false, false);
      }
      camera.update(character.position, dt);
      input.consumeJustPressed();
      return;
    }

    // If riding a seesaw
    if (this.onSeeSaw) {
      const ss = this.onSeeSaw;
      // WASD applies force
      if (input.forward || input.right) ss.push(dt * 4);
      if (input.backward || input.left) ss.push(-dt * 4);
      // Jump to dismount
      if (input.jump) {
        this.onSeeSaw = null;
        this.physics.jump(JUMP_FORCE * 0.5);
        character.onGround = false;
        character.onJump();
      } else {
        // Follow seesaw plank position
        const side = character.position.x > ss.x ? 1 : -1;
        const ssAngle = ss.angle ?? 0;
        const plankY = ss.baseY + 0.55 + Math.sin(ssAngle) * side * 1.2;
        character.position.set(ss.x + side * 1.0, plankY + GROUND_Y * 0.5, ss.z);
        this.physics.teleport(character.position.x, character.position.y, character.position.z);
        character.update(dt, false, false);
      }
      camera.update(character.position, dt);
      input.consumeJustPressed();
      return;
    }

    // Movement direction
    const forward = camera.getForwardDir();
    const right = camera.getRightDir();
    const moveDir = new THREE.Vector3();

    if (input.forward) moveDir.add(forward);
    if (input.backward) moveDir.sub(forward);
    if (input.left) moveDir.sub(right);
    if (input.right) moveDir.add(right);

    const isMoving = moveDir.lengthSq() > 0.001;
    const isSprinting = input.sprint && isMoving;

    // --- Water detection ---
    const waterResult = worldProps.update(dt, character.position);
    this.inWater = waterResult.inWater;
    const speedMult = this.inWater ? WATER_SPEED_MULT : 1;

    if (waterResult.justEnteredWater) {
      worldProps.waterSplash.trigger(
        character.position.x,
        worldProps.waterCenter.y + 0.1,
        character.position.z,
      );
      this.onWaterSplash?.();
    }

    // --- Drive the rigid body: cannon owns gravity, slopes and ground contact ---
    if (isMoving) {
      moveDir.normalize();
      const speed = (isSprinting ? SPRINT_SPEED : WALK_SPEED) * speedMult;
      this.physics.setHorizontalVelocity(
        moveDir.x * speed + this.collisionPushX + this.carryX,
        moveDir.z * speed + this.collisionPushZ + this.carryZ,
      );
      this.targetRotation = Math.atan2(moveDir.x, moveDir.z) + Math.PI;
    } else {
      // Re-writing zero horizontal velocity each frame is what stops the capsule
      // sliding down slopes now that contact friction is disabled.
      this.physics.setHorizontalVelocity(
        this.collisionPushX + this.carryX,
        this.collisionPushZ + this.carryZ,
      );
    }
    this.collisionPushX *= Math.max(0, 1 - dt * 6);
    this.collisionPushZ *= Math.max(0, 1 - dt * 6);
    this.carryX *= Math.max(0, 1 - dt * 2.2);
    this.carryZ *= Math.max(0, 1 - dt * 2.2);

    const wasOnGround = character.onGround;

    // Space must be re-tapped to fly: holding it does nothing in mid-air, so the wings
    // only beat on fresh presses. Mash it fast enough and the egg climbs.
    const spaceTapped = input.wasJustPressed('Space') || input.gpJustPressedButton(0);

    if (this.physics.onGround && input.jump) {
      this.physics.jump(this.inWater ? JUMP_FORCE * WATER_JUMP_MULT : JUMP_FORCE);
      character.onJump();
      this.onJump?.();
    } else if (spaceTapped && !this.physics.onGround) {
      // Flight needs wings: without them the tap does nothing but nudge the HUD.
      if (character.hasWings()) {
        this.physics.jump(FLAP_FORCE);
        character.onFlap();
        this.onFlap?.();
      } else {
        this.onNoWings?.();
      }
    }

    this.physics.step(dt);

    // --- Read the simulated position back out ---
    const sim = this.physics.position;
    character.position.set(sim.x, sim.y, sim.z);
    character.onGround = this.physics.onGround;

    if (character.onGround && !wasOnGround) {
      character.onLand();
      const impactSpeed = this.physics.velocity.y;
      if (impactSpeed < -4) this.onLand?.(sim.x, sim.y - GROUND_Y, sim.z);
    }

    // --- Keep the non-physical props solid (trees, benches, fountain, fence) ---
    const feetY = character.position.y - GROUND_Y;
    for (const col of colliders) {
      if (col.wallX1 !== undefined) {
        const wx = col.wallX2! - col.wallX1!;
        const wz = col.wallZ2! - col.wallZ1!;
        const lenSq = wx * wx + wz * wz;
        if (lenSq < 0.001) continue;
        const t = Math.max(0, Math.min(1,
          ((character.position.x - col.wallX1!) * wx + (character.position.z - col.wallZ1!) * wz) / lenSq,
        ));
        const closestX = col.wallX1! + t * wx;
        const closestZ = col.wallZ1! + t * wz;
        const dxW = character.position.x - closestX;
        const dzW = character.position.z - closestZ;
        const distW = Math.sqrt(dxW * dxW + dzW * dzW);
        const minDistW = col.radius + PLAYER_RADIUS;
        if (distW < minDistW && distW > 0.01 && feetY < col.height - 0.1) {
          character.position.x = closestX + (dxW / distW) * minDistW;
          character.position.z = closestZ + (dzW / distW) * minDistW;
        }
      } else {
        const dxC = character.position.x - col.x;
        const dzC = character.position.z - col.z;
        const distH = Math.sqrt(dxC * dxC + dzC * dzC);
        const minDist = col.radius + PLAYER_RADIUS;
        if (distH < minDist && distH > 0.01 && feetY < col.height - 0.1) {
          character.position.x = col.x + (dxC / distH) * minDist;
          character.position.z = col.z + (dzC / distH) * minDist;
        }
      }
    }

    // Lily pads are not physics bodies — hold the capsule at the pad surface
    const lilyPad = worldProps.checkLilyPads(
      character.position.x, character.position.y - GROUND_Y, character.position.z,
    );
    if (lilyPad) {
      const padSurface = 0.1 + GROUND_Y;
      if (character.position.y <= padSurface + 0.3) {
        character.position.y = padSurface;
        character.onGround = true;
      }
    }

    // Water surface float
    if (this.inWater && character.position.y < worldProps.waterCenter.y + GROUND_Y) {
      character.position.y = worldProps.waterCenter.y + GROUND_Y;
      character.onGround = true;
    }

    // --- Slide physics (the slide surface is not a physics body) ---
    this.onSlide = false;
    if (slideData) {
      const cx = character.position.x;
      const cz = character.position.z;
      const sx = slideData.start.x;
      const sz0 = slideData.start.z;
      const sz1 = slideData.end.z;
      const halfW = slideData.width / 2;

      if (Math.abs(cx - sx) < halfW + 0.5 && cz >= sz0 - 1 && cz <= sz1 + 1) {
        const t = clamp((cz - sz0) / (sz1 - sz0), 0, 1);
        const slideSurfaceY = slideData.topHeight + t * (slideData.bottomHeight - slideData.topHeight);
        const slideWorldY = slideSurfaceY + getHeightAt(sx, (sz0 + sz1) / 2);

        if (Math.abs(character.position.y - GROUND_Y - slideWorldY) < 1.0) {
          this.onSlide = true;
          character.position.y = slideWorldY + GROUND_Y;
          character.onGround = true;

          if (!input.jump) {
            const slideSpeed = 4 + t * 6;
            const slideDir = new THREE.Vector3(
              slideData.end.x - slideData.start.x,
              0,
              slideData.end.z - slideData.start.z,
            ).normalize();

            character.position.x += slideDir.x * slideSpeed * dt;
            character.position.z += slideDir.z * slideSpeed * dt;
            if (!isMoving) {
              this.targetRotation = Math.atan2(slideDir.x, slideDir.z) + Math.PI;
            }
          }
        }
      }
    }

    // Hand every correction above back to the physics body so the next step starts clean
    this.physics.shift(character.position.x, character.position.y, character.position.z);

    // Smooth rotation
    let rotDiff = this.targetRotation - character.group.rotation.y;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    character.group.rotation.y += rotDiff * Math.min(dt * 10, 1);

    // --- Fall recovery: teleport to spawn if below void threshold ---
    if (character.position.y < FALL_RECOVERY_Y) {
      this.reset();
      character.position.set(0, 2, 0);
      this.physics.teleport(0, 2, 0);
      character.onGround = false;
      this.onFallRecovery?.();
    }

    // Soft pushback force near world boundaries
    for (const axis of ['x', 'z'] as const) {
      const pos = character.position[axis];
      const distToBoundary = BOUNDARY - Math.abs(pos);
      if (distToBoundary < PUSHBACK_ZONE && distToBoundary >= 0) {
        // Force increases linearly from 0 at PUSHBACK_ZONE to PUSHBACK_STRENGTH at boundary
        const penetration = PUSHBACK_ZONE - distToBoundary;
        const forceMag = (penetration / PUSHBACK_ZONE) * PUSHBACK_STRENGTH;
        const pushDir = pos > 0 ? -1 : 1; // push toward center
        character.position[axis] += pushDir * forceMag * dt;
      }
    }

    // Hard clamp to world bounds (safety net)
    character.position.x = clamp(character.position.x, -BOUNDARY, BOUNDARY);
    character.position.z = clamp(character.position.z, -BOUNDARY, BOUNDARY);
    this.physics.shift(character.position.x, character.position.y, character.position.z);

    // --- Facility interactions ---
    for (const t of worldProps.trampolines) {
      const bounce = t.getBounceForce();
      if (bounce > 0 && character.onGround) {
        this.physics.jump(bounce);
        character.onGround = false;
        character.onJump();
        this.onBounce?.();
      }
    }

    for (const m of worldProps.bouncyMushrooms) {
      const bounce = m.getBounceForce();
      if (bounce > 0 && character.onGround) {
        this.physics.jump(bounce);
        character.onGround = false;
        character.onJump();
        this.onBounce?.();
      }
    }

    for (const p of worldProps.rotatingPlatforms) {
      if (p.isOnPlatform(character.position.x, character.position.z, character.position.y)) {
        const vel = p.getVelocityAt(character.position.x, character.position.z);
        if (vel) {
          this.carryX = vel.vx;
          this.carryZ = vel.vz;
        }
      }
    }

    input.consumeJustPressed();

    // Eye tracking: look in camera forward direction when moving, idle drift otherwise
    const camFwd = camera.getForwardDir();
    character.setEyeTarget(
      isMoving ? camFwd.x : 0,
      isMoving ? camFwd.z : 0,
    );

    // Update character animation
    character.update(dt, isMoving || this.onSlide, isSprinting);

    // Update camera with obstacle collision
    camera.update(character.position, dt, this.currentColliders);
  }
}
