import type { Inventory } from '../world/Inventory';
import type { CurrencySystem } from '../world/Shop';

const SAVE_KEY = 'danzai_save_v1';

interface SaveData {
  version: number;
  timestamp: number;
  coins: number;
  eggsFound: number;
  /** Indices of the golden eggs already picked up, so a reload can't farm them. */
  eggsCollected?: number[];
  inventory: {
    items: { id: string; count: number }[];
    equipped: { hat?: string; face?: string; back?: string; wings?: string; held?: string };
  };
  playerPos: { x: number; y: number; z: number };
}

export class SaveManager {
  private autoSaveTimer = 0;
  private autoSaveInterval = 30; // seconds

  /** Save current game state to localStorage */
  save(
    currency: CurrencySystem,
    inventory: Inventory,
    eggsFound: number,
    playerPos: { x: number; y: number; z: number },
    eggsCollected: number[] = [],
  ) {
    const items: { id: string; count: number }[] = [];
    for (const [id, item] of inventory.items) {
      items.push({ id, count: item.count });
    }

    const equipped: SaveData['inventory']['equipped'] = {};
    for (const slot of ['hat', 'face', 'back', 'wings', 'held'] as const) {
      const item = inventory.getEquipped(slot);
      if (item) equipped[slot] = item.id;
    }

    const data: SaveData = {
      version: 1,
      timestamp: Date.now(),
      coins: currency.coins,
      eggsFound,
      eggsCollected,
      inventory: { items, equipped },
      playerPos: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
    };

    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  /** Load saved game state. Returns null if no save exists. */
  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      if (data.version !== 1) return null;
      return data;
    } catch (e) {
      console.warn('Load failed:', e);
      return null;
    }
  }

  /** Apply loaded data to game systems */
  applyToGame(
    data: SaveData,
    currency: CurrencySystem,
    inventory: Inventory,
  ): { eggsFound: number; eggsCollected: number[]; playerPos: { x: number; y: number; z: number } } {
    // Restore coins
    currency.coins = data.coins;

    // Restore inventory items
    for (const item of data.inventory.items) {
      inventory.addItem(item.id, item.count);
    }

    // Restore equipped items
    for (const slot of ['hat', 'face', 'back', 'wings', 'held'] as const) {
      const id = data.inventory.equipped[slot];
      if (id && inventory.hasItem(id)) {
        inventory.equip(id);
      }
    }

    return {
      eggsFound: data.eggsFound,
      // Older saves have no per-egg data; fall back to "the first N are gone"
      eggsCollected: data.eggsCollected ?? [],
      playerPos: data.playerPos,
    };
  }

  /** Check if a save exists */
  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  /** Delete save data */
  deleteSave() {
    localStorage.removeItem(SAVE_KEY);
  }

  /** Get save timestamp for display */
  getSaveTime(): Date | null {
    const data = this.load();
    return data ? new Date(data.timestamp) : null;
  }

  /** Auto-save tick — call each frame with dt */
  updateAutoSave(
    dt: number,
    currency: CurrencySystem,
    inventory: Inventory,
    eggsFound: number,
    playerPos: { x: number; y: number; z: number },
    eggsCollected: number[] = [],
  ) {
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= this.autoSaveInterval) {
      this.autoSaveTimer = 0;
      this.save(currency, inventory, eggsFound, playerPos, eggsCollected);
    }
  }
}
