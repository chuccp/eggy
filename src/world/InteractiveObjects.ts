import * as THREE from 'three';
import { toonMat } from '../utils/colors';
import { seededRandom } from '../utils/math';

// Trampoline — bounces the character up when stepped on
export class Trampoline {
  group: THREE.Group;
  surface: THREE.Mesh;
  x: number;
  z: number;
  baseY: number;
  private squash = 0;
  triggered = false;

  constructor(x: number, z: number, getHeight: (x: number, z: number) => number) {
    this.x = x;
    this.z = z;
    this.baseY = getHeight(x, z);
    this.group = new THREE.Group();
    this.group.position.set(x, this.baseY, z);

    const frameMat = toonMat(0x444444);
    const surfaceMat = toonMat(0xFF6347);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6);
    for (const [lx, lz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
      const leg = new THREE.Mesh(legGeo, frameMat);
      leg.position.set(lx, 0.2, lz);
      this.group.add(leg);
    }

    // Frame ring
    const ringGeo = new THREE.TorusGeometry(1.3, 0.05, 8, 24);
    ringGeo.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, frameMat);
    ring.position.y = 0.4;
    this.group.add(ring);

    // Bouncy surface
    const surfGeo = new THREE.CircleGeometry(1.2, 24);
    surfGeo.rotateX(-Math.PI / 2);
    this.surface = new THREE.Mesh(surfGeo, surfaceMat);
    this.surface.position.y = 0.42;
    this.surface.receiveShadow = true;
    this.group.add(this.surface);

    // Springs visual
    const springMat = toonMat(0xCCCCCC);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const spring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.3, 4), springMat,
      );
      spring.position.set(Math.cos(angle) * 0.8, 0.25, Math.sin(angle) * 0.8);
      this.group.add(spring);
    }
  }

  update(_dt: number, playerPos: THREE.Vector3) {
    const dx = playerPos.x - this.x;
    const dz = playerPos.z - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Hold the squash for as long as the character is on the pad. The old logic only
    // fired on the first frame of contact, which latched while the player was still
    // airborne — so landing on the trampoline from a jump produced no bounce at all.
    const inContact = dist < 1.3 && playerPos.y - this.baseY < 1.5;
    this.squash = inContact ? 1 : this.squash * 0.85;
    this.surface.position.y = 0.42 - this.squash * 0.3;
    this.triggered = inContact;
  }

  getBounceForce(): number {
    if (this.squash > 0.5) return 16;
    return 0;
  }
}

// Bouncy Mushroom — colorful mushroom that bounces the character
export class BouncyMushroom {
  group: THREE.Group;
  cap: THREE.Mesh;
  x: number;
  z: number;
  baseY: number;
  private squash = 0;
  private triggered = false;

  constructor(x: number, z: number, color: number, getHeight: (x: number, z: number) => number) {
    this.x = x;
    this.z = z;
    this.baseY = getHeight(x, z);
    this.group = new THREE.Group();
    this.group.position.set(x, this.baseY, z);

    const stemMat = toonMat(0xF5DEB3);
    const capMat = toonMat(color);

    // Stem
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8), stemMat,
    );
    stem.position.y = 0.3;
    stem.castShadow = true;
    this.group.add(stem);

    // Cap
    const capGeo = new THREE.SphereGeometry(0.7, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    this.cap = new THREE.Mesh(capGeo, capMat);
    this.cap.position.y = 0.6;
    this.cap.castShadow = true;
    this.group.add(this.cap);

    // Spots
    const spotMat = toonMat(0xFFFFFF);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.3;
      const spot = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 4), spotMat,
      );
      spot.position.set(
        Math.cos(a) * 0.4,
        0.75 + Math.sin(i * 1.5) * 0.1,
        Math.sin(a) * 0.4,
      );
      this.group.add(spot);
    }
  }

  update(_dt: number, playerPos: THREE.Vector3) {
    const dx = playerPos.x - this.x;
    const dz = playerPos.z - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    const inContact = dist < 0.9 && playerPos.y - this.baseY < 1.2;
    this.squash = inContact ? 1 : this.squash * 0.9;
    this.cap.scale.y = 1 - this.squash * 0.3;
    this.cap.scale.x = 1 + this.squash * 0.15;
    this.cap.scale.z = 1 + this.squash * 0.15;
    this.triggered = inContact;
  }

  getBounceForce(): number {
    if (this.squash > 0.5) return 12;
    return 0;
  }
}

// Rotating Platform — spins and carries the character
export class RotatingPlatform {
  group: THREE.Group;
  platform: THREE.Mesh;
  x: number;
  z: number;
  baseY: number;
  radius: number;
  speed: number;
  angle = 0;

  constructor(
    x: number, z: number, radius: number, speed: number,
    getHeight: (x: number, z: number) => number,
  ) {
    this.x = x;
    this.z = z;
    this.baseY = getHeight(x, z);
    this.radius = radius;
    this.speed = speed;
    this.group = new THREE.Group();
    this.group.position.set(x, this.baseY, z);

    const platMat = toonMat(0xE8D5B7);
    const edgeMat = toonMat(0x4ECDC4);

    // Center pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8),
      toonMat(0x888888),
    );
    pole.position.y = 0.25;
    this.group.add(pole);

    // Platform disc
    const platGeo = new THREE.CylinderGeometry(radius, radius, 0.12, 24);
    this.platform = new THREE.Mesh(platGeo, platMat);
    this.platform.position.y = 0.1;
    this.platform.castShadow = true;
    this.platform.receiveShadow = true;
    this.group.add(this.platform);

    // Edge markers (so player can see it's rotating)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.15, 0.2), edgeMat,
      );
      marker.position.set(Math.cos(a) * (radius - 0.2), 0.2, Math.sin(a) * (radius - 0.2));
      this.platform.add(marker);
    }

    // Arrow indicator
    const arrowGeo = new THREE.ConeGeometry(0.15, 0.3, 4);
    arrowGeo.rotateX(Math.PI / 2);
    const arrow = new THREE.Mesh(arrowGeo, edgeMat);
    arrow.position.set(0, 0.2, radius * 0.6);
    this.platform.add(arrow);
  }

  update(dt: number) {
    this.angle += this.speed * dt;
    this.platform.rotation.y = this.angle;
  }

  /** Get the velocity at a world position on the platform */
  getVelocityAt(worldX: number, worldZ: number): { vx: number; vz: number } | null {
    const dx = worldX - this.x;
    const dz = worldZ - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > this.radius + 0.5) return null;

    // Tangential velocity for rotation.y = +speed.
    // A point at local (dx, dz) maps to (dx·cos + dz·sin, -dx·sin + dz·cos), whose
    // derivative at θ=0 is (dz, -dx) — the previous code had both signs flipped, which
    // is why the platform appeared to spin the wrong way under the player.
    const omega = this.speed;
    return { vx: dz * omega, vz: -dx * omega };
  }

  isOnPlatform(worldX: number, worldZ: number, worldY: number): boolean {
    const dx = worldX - this.x;
    const dz = worldZ - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    return dist < this.radius && Math.abs(worldY - this.baseY - 0.7) < 1.0;
  }
}

// Ball Pit — shallow pool filled with colorful bouncing balls
export class BallPit {
  group: THREE.Group;
  x: number;
  z: number;
  baseY: number;
  radius: number;
  private balls: { mesh: THREE.Mesh; baseX: number; baseZ: number; baseY: number; scatterX: number; scatterZ: number; scatterPhase: number }[] = [];
  private playerInside = false;

  constructor(x: number, z: number, radius: number, getHeight: (x: number, z: number) => number) {
    this.x = x;
    this.z = z;
    this.baseY = getHeight(x, z);
    this.radius = radius;
    this.group = new THREE.Group();
    this.group.position.set(x, this.baseY, z);

    const wallMat = toonMat(0xFFB6C1);

    // Wall ring
    const wallGeo = new THREE.TorusGeometry(radius, 0.15, 8, 24);
    wallGeo.rotateX(Math.PI / 2);
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 0.5;
    this.group.add(wall);

    // Floor
    const floorGeo = new THREE.CircleGeometry(radius, 24);
    floorGeo.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(floorGeo, toonMat(0xFFE4E1));
    floor.position.y = 0.02;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Balls
    const ballColors = [0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0x95E1D3, 0xF38181, 0xAA96DA, 0xFCBD6E];
    const rng = seededRandom(777);
    for (let i = 0; i < 60; i++) {
      const angle = rng() * Math.PI * 2;
      const r = rng() * (radius - 0.3);
      const color = ballColors[Math.floor(rng() * ballColors.length)];
      const bx = Math.cos(angle) * r;
      const bz = Math.sin(angle) * r;
      const by = 0.15 + rng() * 0.3;
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.15 + rng() * 0.1, 8, 6),
        toonMat(color),
      );
      ball.position.set(bx, by, bz);
      ball.castShadow = true;
      this.balls.push({
        mesh: ball, baseX: bx, baseZ: bz, baseY: by,
        scatterX: 0, scatterZ: 0, scatterPhase: Math.random() * Math.PI * 2,
      });
      this.group.add(ball);
    }
  }

  update(dt: number, playerPos?: THREE.Vector3) {
    const t = performance.now() * 0.001;

    // Check if player is inside the ball pit
    if (playerPos) {
      const dx = playerPos.x - this.x;
      const dz = playerPos.z - this.z;
      this.playerInside = Math.sqrt(dx * dx + dz * dz) < this.radius;
    }

    for (const b of this.balls) {
      if (this.playerInside) {
        // Scatter balls away from center when player is inside
        const pushX = b.baseX * 0.3;
        const pushZ = b.baseZ * 0.3;
        b.scatterX += (pushX - b.scatterX) * dt * 3;
        b.scatterZ += (pushZ - b.scatterZ) * dt * 3;
        b.mesh.position.x = b.baseX + b.scatterX + Math.sin(t * 3 + b.scatterPhase) * 0.1;
        b.mesh.position.z = b.baseZ + b.scatterZ + Math.cos(t * 3.5 + b.scatterPhase) * 0.1;
        b.mesh.position.y = b.baseY + Math.abs(Math.sin(t * 4 + b.scatterPhase)) * 0.2;
      } else {
        // Idle bobbing
        b.scatterX *= 0.95;
        b.scatterZ *= 0.95;
        b.mesh.position.x = b.baseX + b.scatterX;
        b.mesh.position.z = b.baseZ + b.scatterZ;
        b.mesh.position.y = b.baseY + Math.sin(t * 2 + b.scatterPhase) * 0.1
          + Math.cos(t * 1.3 + b.scatterPhase * 0.7) * 0.05;
      }
    }
  }
}

// Cannon — step in to get launched
export class Cannon {
  group: THREE.Group;
  barrel: THREE.Mesh;
  x: number;
  z: number;
  baseY: number;
  angle: number; // Direction to launch (radians)
  private cooldown = 0;
  private flash!: THREE.Mesh;
  private flashTimer = 0;
  private getHeight: (x: number, z: number) => number;
  private balls: { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }[] = [];
  /** Cannonballs live in world space, so they get their own group added to the scene. */
  projectiles = new THREE.Group();

  constructor(x: number, z: number, angle: number, getHeight: (x: number, z: number) => number) {
    this.x = x;
    this.z = z;
    this.baseY = getHeight(x, z);
    this.angle = angle;
    this.getHeight = getHeight;
    this.group = new THREE.Group();
    this.group.position.set(x, this.baseY, z);
    this.group.rotation.y = angle;

    const bodyMat = toonMat(0x2C3E50);
    const accentMat = toonMat(0xE74C3C);

    // Base/wheels
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const wx of [-0.5, 0.5]) {
      const wheel = new THREE.Mesh(wheelGeo, bodyMat);
      wheel.position.set(wx, 0.3, 0);
      this.group.add(wheel);
    }

    // Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.5, 12);
    barrelGeo.rotateX(Math.PI / 2);
    this.barrel = new THREE.Mesh(barrelGeo, bodyMat);
    this.barrel.position.set(0, 0.6, 0.2);
    this.barrel.castShadow = true;
    this.group.add(this.barrel);

    // Red ring
    const ringGeo = new THREE.TorusGeometry(0.36, 0.04, 6, 12);
    ringGeo.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, accentMat);
    ring.position.set(0, 0.6, 0.95);
    this.group.add(ring);

    // Muzzle flash indicator
    const flashGeo = new THREE.SphereGeometry(0.15, 8, 6);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xFF4500, transparent: true, opacity: 0.7 });
    this.flash = new THREE.Mesh(flashGeo, flashMat);
    this.flash.position.set(0, 0.6, 1.0);
    this.flash.visible = false;
    this.group.add(this.flash);

    // Stand
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.6, 6), bodyMat,
    );
    stand.position.set(0, 0.3, -0.3);
    this.group.add(stand);
  }

  update(dt: number) {
    this.cooldown -= dt;
    // Subtle barrel bob
    this.barrel.position.y = 0.6 + Math.sin(performance.now() * 0.002) * 0.02;

    // Muzzle flash
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      const k = Math.max(0, this.flashTimer / 0.12);
      this.flash.visible = k > 0;
      this.flash.scale.setScalar(0.6 + k * 0.9);
      (this.flash.material as THREE.MeshBasicMaterial).opacity = 0.8 * k;
    }

    // Cannonballs: ballistic flight, removed once they land
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.vy -= 20 * dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      b.life += dt;

      const ground = this.getHeight(b.mesh.position.x, b.mesh.position.z) + 0.22;
      if (b.mesh.position.y <= ground || b.life > 8) {
        this.projectiles.remove(b.mesh);
        b.mesh.geometry.dispose();
        this.balls.splice(i, 1);
      }
    }
  }

  /** Ready to fire? */
  canFire(): boolean {
    return this.cooldown <= 0;
  }

  /** Shoot a cannonball out of the barrel. The character is not affected. */
  fire(): boolean {
    if (this.cooldown > 0) return false;
    this.cooldown = 1.2;

    const dirX = Math.sin(this.angle);
    const dirZ = Math.cos(this.angle);
    const speed = 20;

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 10),
      toonMat(0x2C3E50),
    );
    ball.castShadow = true;
    ball.position.set(this.x + dirX * 1.15, this.baseY + 0.6, this.z + dirZ * 1.15);
    this.projectiles.add(ball);
    this.balls.push({ mesh: ball, vx: dirX * speed, vy: 7, vz: dirZ * speed, life: 0 });

    this.flashTimer = 0.12;
    return true;
  }

  isNear(worldX: number, worldZ: number): boolean {
    const dx = worldX - this.x;
    const dz = worldZ - this.z;
    return Math.sqrt(dx * dx + dz * dz) < 1.5;
  }
}
