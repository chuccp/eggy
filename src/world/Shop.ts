import * as THREE from 'three';
import { Inventory, InventoryItem, getSellPrice, isEquippable } from './Inventory';

// ===================== Shop item definitions =====================

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface ShopItem {
  id: string;
  name: string;
  price: number;
  description: string;
  icon: string;
  category: string;
  owned?: boolean;
}

const SHOP_CATALOGS: Record<string, ShopItem[]> = {
  bakery: [
    { id: 'bread', name: '法式面包', price: 10, description: '刚出炉的香脆面包', icon: '🥖', category: 'food' },
    { id: 'croissant', name: '牛角面包', price: 15, description: '酥脆可颂，黄油香浓', icon: '🥐', category: 'food' },
    { id: 'cake', name: '草莓蛋糕', price: 25, description: '甜蜜草莓装饰的蛋糕', icon: '🍰', category: 'food' },
    { id: 'cookie', name: '曲奇饼干', price: 8, description: '巧克力豆曲奇', icon: '🍪', category: 'food' },
    { id: 'donut', name: '甜甜圈', price: 12, description: '彩虹糖霜甜甜圈', icon: '🍩', category: 'food' },
    { id: 'pretzel', name: '蝴蝶饼', price: 9, description: '咸香蝴蝶饼', icon: '🥨', category: 'food' },
    { id: 'cupcake', name: '纸杯蛋糕', price: 18, description: '粉色奶油纸杯蛋糕', icon: '🧁', category: 'food' },
    { id: 'pie', name: '苹果派', price: 20, description: '经典苹果派', icon: '🥧', category: 'food' },
  ],
  clothing: [
    { id: 'hat_red', name: '红色贝雷帽', price: 30, description: '时尚红色贝雷帽', icon: '🎩', category: 'hat' },
    { id: 'hat_crown', name: '小皇冠', price: 80, description: '闪闪发光的皇冠', icon: '👑', category: 'hat' },
    { id: 'hat_flower', name: '花环头饰', price: 25, description: '清新花环', icon: '💐', category: 'hat' },
    { id: 'scarf', name: '彩色围巾', price: 20, description: '温暖的彩色围巾', icon: '🧣', category: 'accessory' },
    { id: 'glasses', name: '酷炫墨镜', price: 35, description: '戴上就是最酷的蛋仔', icon: '🕶️', category: 'accessory' },
    { id: 'bow', name: '蝴蝶结', price: 15, description: '可爱的蝴蝶结', icon: '🎀', category: 'accessory' },
    { id: 'wings', name: '小翅膀', price: 100, description: '背上可爱小翅膀，可飞行', icon: '🦋', category: 'wings' },
    { id: 'fairy_wings', name: '精灵之翼', price: 80, description: '半透明的发光薄翼', icon: '🧚', category: 'wings' },
    { id: 'demon_wings', name: '恶魔之翼', price: 140, description: '暗夜蝙蝠膜翼', icon: '🦇', category: 'wings' },
    { id: 'dragon_wings', name: '巨龙之翼', price: 170, description: '坚硬的龙鳞膜翼', icon: '🐉', category: 'wings' },
    { id: 'angel_wings', name: '天使之翼', price: 220, description: '纯白天使翅膀', icon: '😇', category: 'wings' },
    { id: 'rainbow_wings', name: '彩虹之翼', price: 260, description: '七彩流光羽翼', icon: '🌈', category: 'wings' },
    { id: 'cape', name: '超人披风', price: 60, description: '红色超人披风', icon: '🦸', category: 'accessory' },
  ],
  furniture: [
    { id: 'plant', name: '小盆栽', price: 15, description: '清新小盆栽', icon: '🪴', category: 'decoration' },
    { id: 'painting', name: '风景画', price: 40, description: '美丽风景画', icon: '🖼️', category: 'decoration' },
    { id: 'candle', name: '香薰蜡烛', price: 20, description: '薰衣草香味蜡烛', icon: '🕯️', category: 'decoration' },
    { id: 'clock', name: '挂钟', price: 30, description: '可爱猫咪挂钟', icon: '🕐', category: 'decoration' },
    { id: 'cushion', name: '抱枕', price: 12, description: '柔软的蛋形抱枕', icon: '🛋️', category: 'decoration' },
    { id: 'rug_fancy', name: '波斯地毯', price: 50, description: '精美的手工波斯地毯', icon: '🧶', category: 'decoration' },
  ],
  icecream: [
    { id: 'vanilla', name: '香草冰淇淋', price: 8, description: '经典香草味', icon: '🍦', category: 'food' },
    { id: 'chocolate', name: '巧克力冰淇淋', price: 10, description: '浓郁巧克力味', icon: '🍫', category: 'food' },
    { id: 'strawberry', name: '草莓冰淇淋', price: 10, description: '新鲜草莓味', icon: '🍓', category: 'food' },
    { id: 'matcha', name: '抹茶冰淇淋', price: 12, description: '日式抹茶味', icon: '🍵', category: 'food' },
    { id: 'mango', name: '芒果冰淇淋', price: 12, description: '热带芒果味', icon: '🥭', category: 'food' },
    { id: 'sundae', name: '超级圣代', price: 25, description: '三层混合圣代', icon: '🍨', category: 'food' },
    { id: 'popsicle', name: '水果冰棒', price: 6, description: '清凉水果冰棒', icon: '🧊', category: 'food' },
  ],
};

// ===================== Currency system =====================

export class CurrencySystem {
  coins = 100; // Starting coins

  addCoins(amount: number) {
    this.coins += amount;
  }

  canAfford(price: number): boolean {
    return this.coins >= price;
  }

  /** Deduct coins. Returns false (and changes nothing) if the player can't afford it. */
  spend(amount: number): boolean {
    if (!this.canAfford(amount)) return false;
    this.coins -= amount;
    return true;
  }
}

// ===================== Shop UI =====================

export class ShopUI {
  private container: HTMLElement | null = null;
  private visible = false;
  private currentShopType = '';
  private selectedIndex = 0;
  private mode: 'buy' | 'sell' = 'buy';
  private sellOnly = false;
  private currency: CurrencySystem;
  private inventory: Inventory;
  private onPurchase?: (item: ShopItem) => void;
  private onSell?: (item: InventoryItem, price: number) => void;
  onClose?: () => void;

  constructor(currency: CurrencySystem, inventory: Inventory) {
    this.currency = currency;
    this.inventory = inventory;
  }

  show(
    shopType: string,
    onPurchase?: (item: ShopItem) => void,
    onSell?: (item: InventoryItem, price: number) => void,
    sellOnly = false,
  ) {
    this.currentShopType = shopType;
    this.selectedIndex = 0;
    this.sellOnly = sellOnly;
    this.mode = sellOnly ? 'sell' : 'buy';
    this.onPurchase = onPurchase;
    this.onSell = onSell;
    this.visible = true;
    this.render();
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.onClose?.();
  }

  isVisible(): boolean {
    return this.visible;
  }

  handleKey(key: string): boolean {
    if (!this.visible) return false;
    const items = this.currentList();
    if (key === 'Escape' || key === 'KeyQ') {
      this.hide();
      return true;
    }
    if (key === 'Tab' && !this.sellOnly) {
      this.mode = this.mode === 'buy' ? 'sell' : 'buy';
      this.selectedIndex = 0;
      this.render();
      return true;
    }
    if (key === 'ArrowUp' || key === 'KeyW') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.render();
      return true;
    }
    if (key === 'ArrowDown' || key === 'KeyS') {
      this.selectedIndex = Math.min(items.length - 1, this.selectedIndex + 1);
      this.render();
      return true;
    }
    if (key === 'Enter' || key === 'KeyE') {
      this.activate(this.selectedIndex);
      this.render();
      return true;
    }
    return false;
  }

  /** Buy or sell the entry at the given index, depending on the active tab. */
  private activate(index: number) {
    const entry = this.currentList()[index];
    if (!entry) return;
    if (this.mode === 'buy') {
      const item = entry as ShopItem;
      // Wearables are one-off; collectibles (food, furniture) can be bought repeatedly.
      if (this.isOwned(item.id)) return;
      if (!this.currency.spend(item.price)) return;
      this.onPurchase?.(item);
    } else {
      const item = entry as InventoryItem;
      const price = getSellPrice(item.id);
      if (this.inventory.removeItem(item.id, 1)) {
        this.currency.addCoins(price);
        this.onSell?.(item, price);
      }
    }
  }

  /** Wearables already in the bag count as owned; collectibles never do. */
  private isOwned(id: string): boolean {
    return isEquippable(id) && this.inventory.hasItem(id);
  }

  /** Items currently shown by the active tab. */
  private currentList(): (ShopItem | InventoryItem)[] {
    return this.mode === 'buy'
      ? (SHOP_CATALOGS[this.currentShopType] || [])
      : this.inventory.getAllItems();
  }

  private render() {
    if (this.container) {
      this.container.remove();
    }

    const items = this.currentList();
    if (this.selectedIndex >= items.length) this.selectedIndex = Math.max(0, items.length - 1);
    const selling = this.mode === 'sell';
    const shopNames: Record<string, string> = {
      bakery: '甜蜜面包店',
      clothing: '时尚服装店',
      furniture: '家具小馆',
      icecream: '冰淇淋小屋',
    };
    const shopName = shopNames[this.currentShopType] || '商店';
    const shopIcons: Record<string, string> = {
      bakery: '🍞',
      clothing: '👗',
      furniture: '🪑',
      icecream: '🍦',
    };
    const shopIcon = shopIcons[this.currentShopType] || '🏪';

    this.container = document.createElement('div');
    this.container.id = 'shop-ui';
    this.container.innerHTML = `
      <style>
        #shop-ui {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          z-index: 100; pointer-events: all;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(6px);
          font-family: 'Segoe UI', 'PingFang SC', sans-serif;
        }
        .shop-panel {
          background: linear-gradient(135deg, #fff9f0, #fff0e6);
          border-radius: 20px;
          width: 420px;
          max-height: 80vh;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          border: 2px solid rgba(255,200,150,0.5);
          display: flex; flex-direction: column;
        }
        .shop-header {
          padding: 18px 24px;
          background: linear-gradient(135deg, #FFE4C4, #FFD4A4);
          border-bottom: 2px solid rgba(255,180,120,0.3);
          display: flex; align-items: center; justify-content: space-between;
        }
        .shop-title {
          font-size: 22px; font-weight: 700; color: #5C3D2E;
        }
        .shop-coins {
          margin-left: auto;
          background: rgba(255,215,0,0.3);
          border-radius: 20px; padding: 6px 14px;
          font-size: 16px; font-weight: 700; color: #B8860B;
          border: 1px solid rgba(255,215,0,0.5);
        }
        .shop-close {
          width: 28px; height: 28px; flex: none;
          border-radius: 9px;
          border: 1px solid rgba(150,110,70,0.35);
          background: rgba(255,255,255,0.55);
          color: #6a5138; font-size: 14px; font-weight: 700; line-height: 1;
          cursor: pointer; transition: all 0.15s;
        }
        .shop-close:hover {
          background: rgba(255,100,100,0.9); color: #fff; border-color: transparent;
        }
        .shop-tabs {
          display: flex; gap: 8px; padding: 10px 24px 0;
        }
        .shop-tab {
          flex: 1; text-align: center;
          padding: 8px 0; border-radius: 10px 10px 0 0;
          font-size: 14px; font-weight: 700; color: #A07850;
          background: rgba(255,255,255,0.35);
          cursor: pointer; transition: all 0.15s;
          border: 2px solid transparent; border-bottom: none;
        }
        .shop-tab:hover { background: rgba(255,255,255,0.6); }
        .shop-tab.active {
          color: #5C3D2E; background: rgba(255,255,255,0.85);
          border-color: rgba(255,180,120,0.6);
        }
        .shop-items {
          flex: 1; overflow-y: auto; padding: 12px;
          max-height: 50vh;
        }
        .shop-empty {
          text-align: center; padding: 40px 20px; color: #B09274;
          font-size: 14px;
        }
        .shop-item {
          display: flex; align-items: center; gap: 14px;
          padding: 12px 16px;
          border-radius: 14px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid transparent;
        }
        .shop-item:hover, .shop-item.selected {
          background: rgba(255,200,150,0.2);
          border-color: rgba(255,180,120,0.5);
          transform: scale(1.02);
        }
        .shop-item.owned {
          opacity: 0.5;
          background: rgba(200,200,200,0.1);
        }
        .shop-item-icon {
          font-size: 32px;
          width: 48px; height: 48px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.6);
          border-radius: 12px;
          flex-shrink: 0;
        }
        .shop-item-info {
          flex: 1; min-width: 0;
        }
        .shop-item-name {
          font-size: 15px; font-weight: 600; color: #333;
          margin-bottom: 2px;
        }
        .shop-item-desc {
          font-size: 12px; color: #888;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .shop-item-price {
          font-size: 16px; font-weight: 700; color: #B8860B;
          flex-shrink: 0;
          padding: 4px 12px;
          border-radius: 12px;
          background: rgba(255,215,0,0.15);
        }
        .shop-item-price.affordable {
          color: #2ECC71;
          background: rgba(46,204,113,0.15);
        }
        .shop-item-price.too-expensive {
          color: #E74C3C;
          background: rgba(231,76,60,0.1);
        }
        .shop-item-price.owned-badge {
          color: #888;
          background: rgba(200,200,200,0.2);
          font-size: 13px;
        }
        .shop-footer {
          padding: 12px 24px;
          background: rgba(255,240,230,0.8);
          border-top: 1px solid rgba(255,200,150,0.3);
          display: flex; justify-content: space-between; align-items: center;
          font-size: 13px; color: #999;
        }
        .shop-footer kbd {
          background: rgba(0,0,0,0.08); border-radius: 4px;
          padding: 2px 8px; font-family: monospace; font-size: 12px;
          margin: 0 2px;
        }
      </style>
      <div class="shop-panel">
        <div class="shop-header">
          <span class="shop-title">${shopIcon} ${shopName}</span>
          <span class="shop-coins">💰 ${this.currency.coins}</span>
          <button class="shop-close" id="shop-close" title="关闭 (Q)">✕</button>
        </div>
        <div class="shop-tabs">
          ${this.sellOnly ? '' : `<div class="shop-tab ${selling ? '' : 'active'}" data-mode="buy">🛒 购买</div>`}
          <div class="shop-tab ${selling ? 'active' : ''}" data-mode="sell">💰 出售</div>
        </div>
        <div class="shop-items">
          ${items.length === 0 ? `
            <div class="shop-empty">背包里没有可以出售的东西<br>
              <span style="font-size:12px;">去野外捡些装备，或开宝箱获得吧！</span>
            </div>
          ` : items.map((entry, i) => {
            const selected = i === this.selectedIndex;
            if (selling) {
              const item = entry as InventoryItem;
              const price = getSellPrice(item.id);
              return `
                <div class="shop-item ${selected ? 'selected' : ''}" data-index="${i}">
                  <div class="shop-item-icon">${escapeHtml(item.icon)}</div>
                  <div class="shop-item-info">
                    <div class="shop-item-name">${escapeHtml(item.name)}</div>
                    <div class="shop-item-desc">持有 x${item.count}</div>
                  </div>
                  <div class="shop-item-price affordable">+${price} 💰</div>
                </div>
              `;
            }
            const item = entry as ShopItem;
            const owned = this.isOwned(item.id);
            const affordable = this.currency.canAfford(item.price);
            let priceClass = 'shop-item-price';
            let priceText = `${item.icon} ${item.price}`;
            if (owned) {
              priceClass += ' owned-badge';
              priceText = '已拥有';
            } else if (affordable) {
              priceClass += ' affordable';
            } else {
              priceClass += ' too-expensive';
            }
            return `
              <div class="shop-item ${selected ? 'selected' : ''} ${owned ? 'owned' : ''}"
                   data-index="${i}">
                <div class="shop-item-icon">${escapeHtml(item.icon)}</div>
                <div class="shop-item-info">
                  <div class="shop-item-name">${escapeHtml(item.name)}</div>
                  <div class="shop-item-desc">${escapeHtml(item.description)}</div>
                </div>
                <div class="${priceClass}">${escapeHtml(priceText)}</div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="shop-footer">
          <span><kbd>W</kbd><kbd>S</kbd> 选择 · <kbd>Enter</kbd> ${selling ? '出售' : '购买'} · ${this.sellOnly ? '' : '<kbd>Tab</kbd> 买卖 · '}<kbd>Q</kbd> 关闭</span>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    // Click handlers: tabs switch buy/sell, rows act on the selected item
    this.container.addEventListener('click', (e) => {
      const el = e.target as HTMLElement;

      if (el.closest('#shop-close')) {
        this.hide();
        return;
      }

      const tab = el.closest('.shop-tab') as HTMLElement | null;
      if (tab) {
        if (this.sellOnly && tab.dataset.mode !== 'sell') return;
        this.mode = tab.dataset.mode === 'sell' ? 'sell' : 'buy';
        this.selectedIndex = 0;
        this.render();
        return;
      }

      const target = el.closest('.shop-item') as HTMLElement | null;
      if (target) {
        this.selectedIndex = parseInt(target.dataset.index ?? '0');
        this.activate(this.selectedIndex);
        this.render();
      }
    });
  }
}

export { SHOP_CATALOGS };
