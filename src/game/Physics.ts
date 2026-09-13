import * as CANNON from 'cannon-es';

/** Half the character's collision height. Matches GROUND_Y so the visual egg stays put. */
export const PLAYER_HALF_HEIGHT = 0.65;
const PLAYER_RADIUS = 0.4;

const GRAVITY = -20;

/**
 * Thin wrapper over cannon-es.
 *
 * The character is a real rigid body (capsule compound) resting on a static heightfield
 * built from the terrain, so gravity, slopes and ground contact are simulated rather than
 * hand-rolled. Horizontal motion is velocity-controlled: Controls writes the desired
 * speed into the body each frame, which keeps the feel predictable.
 */
export class PhysicsWorld {
  world: CANNON.World;
  playerBody: CANNON.Body;

  constructor(spawnX = 0, spawnY = 2, spawnZ = 0) {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = false;
    // Movement is velocity-driven, so friction must not fight the input.
    this.world.defaultContactMaterial.friction = 0;
    this.world.defaultContactMaterial.restitution = 0;

    // Capsule: cylinder with a sphere cap at each end (cannon-es has no capsule shape)
    const cylinderHeight = PLAYER_HALF_HEIGHT * 2 - PLAYER_RADIUS * 2;
    this.playerBody = new CANNON.Body({
      mass: 1,
      linearDamping: 0,
      angularDamping: 1,
      fixedRotation: true,
    });
    this.playerBody.addShape(
      new CANNON.Cylinder(PLAYER_RADIUS, PLAYER_RADIUS, cylinderHeight, 8),
      new CANNON.Vec3(0, 0, 0),
    );
    this.playerBody.addShape(
      new CANNON.Sphere(PLAYER_RADIUS),
      new CANNON.Vec3(0, cylinderHeight / 2, 0),
    );
    this.playerBody.addShape(
      new CANNON.Sphere(PLAYER_RADIUS),
      new CANNON.Vec3(0, -cylinderHeight / 2, 0),
    );
    this.playerBody.updateMassProperties();
    this.playerBody.position.set(spawnX, spawnY, spawnZ);
    this.world.addBody(this.playerBody);
  }

  /**
   * Build a static heightfield from the terrain sampler.
   *
   * A cannon Heightfield lies in its local XY plane with the height along local Z, so the
   * body is rotated -90° about X: local (x, y, z) then maps to world (x, z, -y). The grid
   * is laid out so that sample [i][j] sits at world x = -halfSize + i*elementSize and
   * world z = halfSize - j*elementSize.
   */
  buildTerrain(getHeight: (x: number, z: number) => number, halfSize = 100, segments = 128) {
    const elementSize = (halfSize * 2) / segments;
    const data: number[][] = [];
    for (let i = 0; i <= segments; i++) {
      const row: number[] = [];
      const x = -halfSize + i * elementSize;
      for (let j = 0; j <= segments; j++) {
        const z = halfSize - j * elementSize;
        row.push(getHeight(x, z));
      }
      data.push(row);
    }

    const body = new CANNON.Body({ mass: 0 });
    body.addShape(new CANNON.Heightfield(data, { elementSize }));
    body.position.set(-halfSize, 0, halfSize);
    body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(body);
  }

  /**
   * Add a static box the player can stand on — used for surfaces that are not part of the
   * terrain heightfield, such as house roofs.
   */
  addStaticBox(
    x: number, y: number, z: number,
    halfX: number, halfY: number, halfZ: number,
    rotY = 0, rotZ = 0,
  ) {
    const body = new CANNON.Body({ mass: 0 });
    body.addShape(new CANNON.Box(new CANNON.Vec3(halfX, halfY, halfZ)));
    body.position.set(x, y, z);
    // Euler 'XYZ' applies Z first, so the slope tilts in the house's local frame and is
    // then swung round by the house's yaw.
    body.quaternion.setFromEuler(0, rotY, rotZ);
    this.world.addBody(body);
  }

  step(dt: number) {
    this.world.step(1 / 60, dt, 3);
  }

  /** True when the capsule is resting on something roughly horizontal. */
  get onGround(): boolean {
    for (const contact of this.world.contacts) {
      if (contact.bi === this.playerBody || contact.bj === this.playerBody) {
        if (Math.abs(contact.ni.y) > 0.5) return true;
      }
    }
    return false;
  }

  get position(): CANNON.Vec3 {
    return this.playerBody.position;
  }

  get velocity(): CANNON.Vec3 {
    return this.playerBody.velocity;
  }

  /** Drive horizontal motion; vertical velocity is left to gravity. */
  setHorizontalVelocity(vx: number, vz: number) {
    this.playerBody.velocity.x = vx;
    this.playerBody.velocity.z = vz;
  }

  jump(force: number) {
    this.playerBody.velocity.y = force;
  }

  /** Hard teleport (spawn points, fall recovery, water surface, slide). */
  teleport(x: number, y: number, z: number) {
    this.playerBody.position.set(x, y, z);
    this.playerBody.velocity.setZero();
  }

  /** Move without clearing vertical velocity (used by moving platforms). */
  shift(x: number, y: number, z: number) {
    this.playerBody.position.set(x, y, z);
  }
}
