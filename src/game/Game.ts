import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { SceneManager } from './Scene';
import { Input } from './Input';
import { EggCharacter } from '../player/EggCharacter';
import { ThirdPersonCamera } from '../player/Camera';
import { Controls } from '../player/Controls';
import { Terrain } from '../world/Terrain';
import { WorldProps } from '../world/Props';
import { NPCManager, NPC_RADIUS } from '../world/NPC';
import { Houses } from '../world/Houses';
import { BirdManager } from '../world/Birds';
import { TreasureChest, TreasureChestManager } from '../world/TreasureChest';
import { CurrencySystem, ShopUI, type ShopItem } from '../world/Shop';
import { Inventory, InventoryUI, createEquipMesh, EQUIP_DEFS } from '../world/Inventory';
import { WildPickupManager } from '../world/WildPickups';
import { PushableBalls } from '../world/PushableBalls';
import { ShopDisplayManager } from '../world/ShopDisplay';
import { PauseMenu } from '../ui/PauseMenu';
import { playJump, playLand, playCollect, playMagic, playChestOpen, playPurchase, playGreeting, playSplash, playSwingPush, playBounce, playFlap, startBGM, setMasterVolume, setBGMVolume, startAmbience, setAmbientGains, speak, stopSpeaking } from '../audio/AudioManager';
import { SaveManager } from './SaveManager';
import { PhysicsWorld } from './Physics';
import { worldPos } from '../utils/math';
import { ChimneySmoke, ButterflyManager, FallingLeaves } from '../world/Particles';
import { createPostProcessing } from '../effects/PostProcessing';
import type { HUD } from '../ui/HUD';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private sceneManager: SceneManager;
  private input: Input;
  private character: EggCharacter;
  private camera: ThirdPersonCamera;
  private controls: Controls;
  private terrain: Terrain;
  private props: WorldProps;
  private npcManager: NPCManager;
  private houses: Houses;
  private birdManager: BirdManager;
  private treasureManager: TreasureChestManager;
  private currency: CurrencySystem;
  private shopUI: ShopUI;
  private inventory: Inventory;
  private inventoryUI: InventoryUI;
  private wildPickups: WildPickupManager;
  private pushableBalls: PushableBalls;
  private shopDisplays: ShopDisplayManager;
  private pauseMenu: PauseMenu;
  private saveManager: SaveManager;
  private physics: PhysicsWorld;
  private chimneySmoke: ChimneySmoke;
  private butterflyManager: ButterflyManager;
  private fallingLeaves: FallingLeaves;
  private eggsFound = 0;
  private clock = new THREE.Clock();
  private running = false;
  private hud: HUD | null = null;
  private overlayWasOpen = false;

  onEggFound?: () => void;

  get eggsFoundCount(): number { return this.eggsFound; }

  constructor(canvas: HTMLElement, eggColor: number) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.sceneManager = new SceneManager();
    this.input = new Input(canvas);
    this.camera = new ThirdPersonCamera(window.innerWidth / window.innerHeight);

    // Post-processing (bloom + vignette)
    this.composer = createPostProcessing(
      this.renderer,
      this.sceneManager.scene,
      this.camera.camera,
    );

    // Character
    this.character = new EggCharacter(eggColor);
    this.sceneManager.scene.add(this.character.group);

    // Terrain
    this.terrain = new Terrain();
    this.sceneManager.scene.add(this.terrain.group);

    // Physics (cannon-es): the character is a rigid body on a static heightfield
    this.physics = new PhysicsWorld(0, 2, 0);
    this.physics.buildTerrain(this.terrain.getHeight);

    // Houses
    this.houses = new Houses(this.terrain.getHeight, (c) => this.terrain.colliders.push(c));
    this.houses.addToScene(this.sceneManager.scene);

    // Roofs are solid ground: without this the player flies straight through them.
    for (const s of this.houses.roofSlopes) {
      this.physics.addStaticBox(s.x, s.y, s.z, s.halfX, s.halfY, s.halfZ, s.rotY, s.rotZ);
    }

    // World props
    this.props = new WorldProps(this.terrain.getHeight);
    this.props.addToScene(this.sceneManager.scene);

    // Pushable balls in the plaza (real physics bodies on the heightfield)
    this.pushableBalls = new PushableBalls(this.physics, this.terrain.getHeight, [
      [4, 4], [5.5, 1.5], [2, 6], [-4, 5], [-5, -2], [6, -5],
    ]);
    this.pushableBalls.addToScene(this.sceneManager.scene);

    // Currency
    this.currency = new CurrencySystem();

    // Inventory + equipment
    this.inventory = new Inventory();
    this.inventoryUI = new InventoryUI(this.inventory);

    // When equipment changes, update character visuals
    this.inventory.onChange = () => {
      this.refreshEquipment();
      this.inventoryUI.isVisible() && this.inventoryUI.show(); // refresh UI if open
    };

    // Shop (buy + sell)
    this.shopUI = new ShopUI(this.currency, this.inventory);

    // Shop goods laid out on the counters/racks (buying happens in the world now)
    this.shopDisplays = new ShopDisplayManager(this.houses);
    this.shopDisplays.addToScene(this.sceneManager.scene);

    // Controls
    this.controls = new Controls(
      this.input, this.camera, this.character, this.physics, this.shopDisplays,
    );

    this.controls.onLand = (x, y, z) => {
      const puff = this.props.getDustPuff();
      if (puff) puff.trigger(x, y, z);
      playLand();
    };

    this.controls.onJump = () => playJump();
    this.controls.onFlap = () => playFlap();
    this.controls.onNoWings = () => {
      this.hud?.showMessage('需要装备翅膀才能飞行 🪽', 1800);
    };
    this.controls.onSwingPush = () => playSwingPush();
    this.controls.onCannonFire = () => playBounce();
    this.controls.onBounce = () => playBounce();
    this.controls.onWaterSplash = () => playSplash();
    this.controls.onFallRecovery = () => {
      if (this.hud) this.hud.showMessage('你掉出了地图！已传送回起点', 2500);
    };

    this.controls.onNearDoor = (info) => {
      if (this.hud) this.hud.showInteractHint(info.label);
    };

    this.controls.onEnterShop = (shopType) => {
      const name: Record<string, string> = {
        bakery: '甜蜜面包店', clothing: '时尚服装店',
        furniture: '家具小馆', icecream: '冰淇淋小屋',
      };
      if (this.hud) {
        this.hud.showMessage(
          `欢迎来到 ${name[shopType] ?? '商店'}！走近商品按 E 购买`, 2500,
        );
        this.hud.updateCoins(this.currency.coins);
      }
    };

    // Buying: walk up to the goods and press E — coins come straight out of the purse
    this.controls.onBuyDisplay = (display) => {
      const { item } = display;
      if (!this.currency.spend(item.price)) {
        if (this.hud) this.hud.showMessage(`金币不足！${item.icon} ${item.name} 需要 ${item.price}💰`, 1800);
        return;
      }
      this.inventory.addItem(item.id);
      playPurchase();
      if (this.hud) {
        this.hud.showMessage(`购买成功！ ${item.icon} ${item.name}  -${item.price}💰`, 1800);
        this.hud.updateCoins(this.currency.coins);
      }
    };

    // Selling stays on the counter, and only offers the sell list
    this.controls.onSellAtCounter = (counter) => {
      this.shopUI.show(counter.shopType, undefined, (item, price) => {
        playPurchase();
        if (this.hud) {
          this.hud.showMessage(`卖出 ${item.icon} ${item.name}  +${price}💰`, 1800);
          this.hud.updateCoins(this.currency.coins);
        }
      }, true);
      if (this.hud) this.hud.updateCoins(this.currency.coins);
    };

    this.controls.onSleep = (sleeping) => {
      if (sleeping) {
        playMagic();
        if (this.hud) this.hud.showMessage('躺下休息一会儿吧~', 2500);
      } else {
        this.saveManager.save(this.currency, this.inventory, this.eggsFound, this.character.position, this.collectedEggIndices());
        if (this.hud) this.hud.showMessage('休息好了，精神满满！', 2000);
      }
    };

    this.controls.onEnterHouse = (name) => {
      if (this.hud) this.hud.showMessage(`欢迎来到 ${name}！`, 1500);
    };

    this.controls.getShopVisible = () => this.shopUI.isVisible();
    this.controls.onShopKey = (key) => this.shopUI.handleKey(key);
    this.controls.getInventoryVisible = () => this.inventoryUI.isVisible();
    this.controls.onInventoryKey = (key) => this.inventoryUI.handleKey(key);
    this.controls.onToggleInventory = () => this.inventoryUI.toggle();

    // Grab the mouse back when a menu closes (fires from the closing click/key event)
    this.inventoryUI.onClose = () => this.relockPointer();
    this.shopUI.onClose = () => this.relockPointer();
    this.controls.onNPCInteract = (message) => {
      playGreeting();
      speak(message);
    };

    // Pause menu
    this.pauseMenu = new PauseMenu();
    this.pauseMenu.onResume = () => {
      this.relockPointer();
    };
    this.pauseMenu.onVolumeChange = (vol) => {
      setMasterVolume(vol);
      setBGMVolume(vol);
    };
    this.pauseMenu.onReturnToStart = () => {
      this.controls.reset();
      this.character.onGround = false;
      this.character.position.set(0, 2, 0);
      if (this.hud) this.hud.showMessage('已回到起点', 1500);
    };
    this.pauseMenu.onExit = () => {
      this.dispose();
      window.location.reload();
    };
    this.controls.onPauseMenu = () => {
      this.pauseMenu.toggle();
      if (this.pauseMenu.isVisible()) stopSpeaking();
    };
    this.controls.getPauseVisible = () => this.pauseMenu.isVisible();
    this.controls.onPauseKey = (key) => this.pauseMenu.handleKey(key);

    // Save system
    this.saveManager = new SaveManager();
    const savedData = this.saveManager.load();
    if (savedData) {
      const restored = this.saveManager.applyToGame(savedData, this.currency, this.inventory);
      this.eggsFound = restored.eggsFound;
      // Hide golden eggs that were already picked up, so reloading can't farm them
      this.props.goldenEggs.forEach((egg, i) => {
        const taken = restored.eggsCollected.includes(i)
          || (restored.eggsCollected.length === 0 && i < restored.eggsFound);
        if (taken) {
          egg.collected = true;
          egg.mesh.visible = false;
        }
      });
      setTimeout(() => {
        this.character.position.set(restored.playerPos.x, restored.playerPos.y, restored.playerPos.z);
      }, 0);
      this.refreshEquipment();
    } else {
      // New game: hand the player the default wings so they can fly from the start
      this.inventory.addItem('wings');
      this.inventory.equip('wings');
    }

    // NPCs
    this.npcManager = new NPCManager(this.terrain.getHeight);
    this.npcManager.addToScene(this.sceneManager.scene);

    // Birds
    this.birdManager = new BirdManager(this.terrain.getHeight);
    this.birdManager.addToScene(this.sceneManager.scene);

    // Treasure chests (loot goes to inventory + coins)
    this.treasureManager = new TreasureChestManager(this.terrain.getHeight, 15, 5);
    this.treasureManager.onCollect = (loot) => {
      this.currency.addCoins(loot.coins);
      this.inventory.addItem(loot.id);
      playChestOpen();
      if (this.hud) {
        this.hud.updateCoins(this.currency.coins);
        const rarityLabel: Record<string, string> = {
          common: '', uncommon: '✦', rare: '✦✦', epic: '✦✦✦', legendary: '★★★',
        };
        const prefix = rarityLabel[loot.rarity] || '';
        this.hud.showMessage(
          `${prefix} 获得 ${loot.icon} ${loot.name}！+${loot.coins}💰 ${prefix}`,
          3000,
        );
      }
    };
    this.treasureManager.addToScene(this.sceneManager.scene);

    // Underwater treasure chest (M8) — legendary loot at the bottom of the lake
    // Sits inside the lake basin (lakebed ≈ -2.2, water surface 0.05), so it's submerged
    const underwaterChest = new TreasureChest(-30, -20, this.terrain.getHeight, 'legendary');
    underwaterChest.baseY = -1.2;
    underwaterChest.group.position.set(-30, -1.2, -20);
    underwaterChest.glowLight.intensity = 2.0;
    underwaterChest.glowLight.distance = 8;
    this.treasureManager.addChest(underwaterChest);

    // Wild equipment lying around the map (walk over it to pick it up)
    this.wildPickups = new WildPickupManager(this.terrain.getHeight);
    this.wildPickups.addToScene(this.sceneManager.scene);

    // Chimney smoke particles for houses with chimneys.
    // worldPos() rotates by -angle, so negate to match each house's rotation.y.
    const chimneys: [number, number, number, number, number][] = [
      [15, 15, -Math.PI / 4, 2, -1],   // 温馨小屋, chimney local (2,-1)
      [-20, 20, Math.PI / 6, 1, -2],   // 甜蜜面包店, chimney local (1,-2)
    ];
    const chimneyData = chimneys.map(([hx, hz, angle, lx, lz]) => {
      const [wx, wz] = worldPos(lx, lz, -angle, hx, hz);
      return { wx, wy: this.terrain.getHeight(hx, hz) + 5.4, wz };
    });
    this.chimneySmoke = new ChimneySmoke(chimneyData);
    this.chimneySmoke.addToScene(this.sceneManager.scene);

    // Butterfly particles in flower field area
    this.butterflyManager = new ButterflyManager(this.terrain.getHeight);
    this.butterflyManager.addToScene(this.sceneManager.scene);

    // Falling leaves in forest path area
    this.fallingLeaves = new FallingLeaves(this.terrain.getHeight);
    this.fallingLeaves.addToScene(this.sceneManager.scene);

    // Resize
    this.onResize = () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.resize(window.innerWidth / window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this.onResize);

    // Save on page unload (dispose is handled by Game.dispose / the exit flow)
    this.onBeforeUnload = () => {
      this.saveManager.save(this.currency, this.inventory, this.eggsFound, this.character.position, this.collectedEggIndices());
    };
    window.addEventListener('beforeunload', this.onBeforeUnload);
  }

  private onResize: () => void;
  private onBeforeUnload: () => void;
  private disposed = false;

  /** Indices of golden eggs already picked up (persisted so reloads can't farm them). */
  private collectedEggIndices(): number[] {
    const indices: number[] = [];
    this.props.goldenEggs.forEach((egg, i) => {
      if (egg.collected) indices.push(i);
    });
    return indices;
  }

  /** Re-grab the mouse. Must run inside a click/key handler so it counts as a user gesture. */
  private relockPointer() {
    const request = this.renderer.domElement.requestPointerLock() as unknown as
      | Promise<void>
      | undefined;
    request?.catch?.(() => {});
  }

  /** Sync inventory equipment → character 3D meshes */
  private refreshEquipment() {
    for (const slot of ['hat', 'face', 'back', 'wings', 'held'] as const) {
      const item = this.inventory.getEquipped(slot);
      if (item) {
        const mesh = createEquipMesh(item);
        this.character.setEquipment(slot, mesh);
      } else {
        this.character.removeEquipment(slot);
      }
    }
  }

  setHUD(hud: HUD) {
    this.hud = hud;
    this.hud.updateCoins(this.currency.coins);
    // Clicking the 🎒 icon opens the inventory (also closes the pause menu if it's up)
    this.hud.onToggleInventory = () => {
      if (this.pauseMenu.isVisible()) this.pauseMenu.hide();
      this.inventoryUI.toggle();
    };
    this.pauseMenu.onOpenInventory = () => this.inventoryUI.show();
  }

  start() {
    this.running = true;
    this.clock.start();
    this.animate();
    this.relockPointer();
    startBGM();
    startAmbience();
  }

  stop() {
    this.running = false;
  }

  /** Dispose all GPU resources (geometries, materials, renderer). Safe to call twice. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('beforeunload', this.onBeforeUnload);

    stopSpeaking();

    // Traverse the scene and dispose all geometries and materials
    this.sceneManager.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
      }
      const material = (obj as THREE.Mesh).material;
      if (material) {
        if (Array.isArray(material)) {
          material.forEach((m) => m.dispose());
        } else {
          material.dispose();
        }
      }
    });

    // Dispose the post-processing composer
    this.composer.dispose();

    // Dispose the renderer and release GPU context
    this.renderer.dispose();

    // Remove canvas event listeners (Input uses anonymous handlers,
    // so we can only remove the canvas itself from the DOM)
    this.renderer.domElement.remove();
  }

  private animate = () => {
    if (!this.running) return;
    requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.05);

    // Poll gamepad state
    this.input.pollGamepad();

    // Release the mouse cursor while a menu is open so its buttons can be clicked.
    // (Re-locking happens on close, from the click/key event that closed it.)
    const overlayOpen =
      this.shopUI.isVisible() || this.inventoryUI.isVisible() || this.pauseMenu.isVisible();
    if (overlayOpen && !this.overlayWasOpen) {
      document.exitPointerLock();
    }
    this.overlayWasOpen = overlayOpen;

    this.controls.update(
      dt,
      this.terrain.getHeight,
      this.terrain.colliders,
      this.terrain.slideData,
      this.props,
      this.houses,
      this.npcManager,
    );

    const push = this.npcManager.resolveCollisions(this.character.position, 0.45);
    this.controls.collisionPushX = push.pushX;
    this.controls.collisionPushZ = push.pushZ;

    this.pushableBalls.update();
    this.shopDisplays.update(this.character.position);

    // Ambient bed: water swells near the lake, birds near the trees
    const px = this.character.position.x;
    const pz = this.character.position.z;
    const lakeDist = Math.hypot(px - this.props.waterCenter.x, pz - this.props.waterCenter.z);
    setAmbientGains(
      1 - (lakeDist - this.props.waterRadius) / 8,
      1 - this.terrain.nearestTreeDistance(px, pz) / 10,
    );
    this.terrain.updateTrees(dt, this.character.position);
    this.npcManager.update(dt, this.terrain.getHeight);
    this.birdManager.update(dt);
    this.treasureManager.update(dt, this.character.position);

    // Particle systems
    this.chimneySmoke.update(dt);
    this.butterflyManager.update(dt, this.character.position);
    this.fallingLeaves.update(dt);

    // Auto-save every 30s
    this.saveManager.updateAutoSave(dt, this.currency, this.inventory, this.eggsFound, this.character.position, this.collectedEggIndices());

    // Wild equipment pickups
    for (const drop of this.wildPickups.update(dt, this.character.position)) {
      this.inventory.addItem(drop.id);
      playCollect();
      const burst = this.props.getGoldenBurst();
      if (burst) burst.trigger(drop.x, drop.y, drop.z);
      const def = EQUIP_DEFS[drop.id];
      if (this.hud && def) {
        this.hud.showMessage(`捡到了 ${def.icon} ${def.name}！已放进物品栏`, 2500);
      }
    }

    // Golden egg collection
    for (const egg of this.props.goldenEggs) {
      if (egg.collected) continue;
      const collected = egg.update(dt, this.character.position);
      if (collected) {
        const burst = this.props.getGoldenBurst();
        if (burst) burst.trigger(egg.mesh.position.x, egg.mesh.position.y, egg.mesh.position.z);
        this.currency.addCoins(50);
        this.inventory.addItem('egg_of_gold');
        this.eggsFound++;
        playMagic();
        if (this.hud) {
          this.hud.updateCoins(this.currency.coins);
          this.hud.updateEggCount(this.eggsFound);
        }
        if (this.onEggFound) this.onEggFound();
        // Save immediately on egg collection
        this.saveManager.save(this.currency, this.inventory, this.eggsFound, this.character.position, this.collectedEggIndices());
      }
    }

    // HUD interaction hints (only when no overlay is open)
    if (this.hud && !this.shopUI.isVisible() && !this.inventoryUI.isVisible()) {
      const interact = this.controls.nearbyInteractable;
      if (interact) {
        this.hud.showInteractHint(interact.label);
      } else {
        this.hud.hideInteractHint();
      }
    }

    // Shadow camera follows player for sharper nearby shadows
    const playerPos = this.character.position;
    this.sceneManager.sun.position.set(playerPos.x + 30, 50, playerPos.z + 20);
    this.sceneManager.sun.target.position.copy(playerPos);

    this.composer.render();
  };
}
