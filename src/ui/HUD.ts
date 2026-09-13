export class HUD {
  private container: HTMLElement;
  private iconLayer: HTMLElement;
  private miniMap: HTMLElement;
  private controls: HTMLElement;
  private message: HTMLElement;
  private interactHint: HTMLElement;

  onToggleInventory?: () => void;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'hud';
    this.container.innerHTML = `
      <style>
        #hud {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none; z-index: 10;
          font-family: 'Segoe UI', 'PingFang SC', sans-serif;
        }
        .minimap {
          position: absolute; top: 20px; left: 20px;
          width: 120px; height: 120px; border-radius: 50%;
          background: rgba(255,255,255,0.2); backdrop-filter: blur(4px);
          border: 2px solid rgba(255,255,255,0.4);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; color: rgba(255,255,255,0.7);
        }
        .minimap-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #FF6B6B; position: absolute;
          box-shadow: 0 0 6px #FF6B6B;
        }
        .controls-hint {
          position: absolute; bottom: 20px; right: 20px;
          background: rgba(0,0,0,0.3); backdrop-filter: blur(4px);
          border-radius: 12px; padding: 12px 18px;
          color: rgba(255,255,255,0.8); font-size: 13px; line-height: 1.8;
        }
        .controls-hint kbd {
          background: rgba(255,255,255,0.2); border-radius: 4px;
          padding: 1px 6px; font-family: monospace; font-size: 12px;
        }
        .egg-count {
          position: absolute; top: 20px; right: 20px;
          background: rgba(255,215,0,0.3); backdrop-filter: blur(4px);
          border-radius: 20px; padding: 8px 16px;
          color: #FFD700; font-size: 16px; font-weight: 700;
        }
        .coin-display {
          position: absolute; top: 60px; right: 20px;
          background: rgba(255,215,0,0.2); backdrop-filter: blur(4px);
          border-radius: 20px; padding: 6px 14px;
          color: #DAA520; font-size: 14px; font-weight: 600;
          border: 1px solid rgba(255,215,0,0.3);
          transition: transform 0.2s;
        }
        .coin-display.bump {
          transform: scale(1.15);
        }
        .message {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: rgba(255,215,0,0.9); color: #333;
          padding: 16px 32px; border-radius: 16px;
          font-size: 20px; font-weight: 700;
          opacity: 0; transition: opacity 0.3s;
        }
        .message.show { opacity: 1; }
        .pointer-hint {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          color: rgba(255,255,255,0.7); font-size: 16px;
          text-align: center;
        }
        .interact-hint {
          position: absolute; bottom: 100px; left: 50%; transform: translateX(-50%);
          background: rgba(0,0,0,0.5); backdrop-filter: blur(6px);
          border-radius: 10px; padding: 8px 20px;
          color: #fff; font-size: 15px; font-weight: 600;
          letter-spacing: 1px; opacity: 0; transition: opacity 0.25s;
          white-space: nowrap;
        }
        .interact-hint.show { opacity: 1; }
        .interact-hint kbd {
          background: rgba(255,255,255,0.25); border-radius: 4px;
          padding: 2px 8px; font-family: monospace; font-size: 13px;
          margin-right: 4px;
        }
      </style>
      <div class="minimap">
        <div class="minimap-dot"></div>
        <span style="position:absolute;bottom:8px;">休闲小镇</span>
      </div>
      <div class="egg-count" id="egg-count">🥚 0 / 3</div>
      <div class="coin-display" id="coin-display">💰 100</div>
      <div class="controls-hint">
        <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动 &nbsp;
        <kbd>Space</kbd> 跳跃 &nbsp;
        <kbd>Shift</kbd> 奔跑<br>
        <kbd>Space</kbd> 连按 扇翅膀飞行<br>
        <kbd>鼠标</kbd> 视角 &nbsp;
        <kbd>滚轮</kbd> 缩放 &nbsp;
        <kbd>I</kbd> 或点右上 🎒 物品栏 &nbsp;
        <kbd>ESC</kbd> 释放鼠标
      </div>
      <div class="interact-hint" id="interact-hint"></div>
      <div class="message" id="hud-message"></div>
      <div class="pointer-hint" id="pointer-hint" style="display:none;">
        点击屏幕开始操控
      </div>
    `;

    document.body.appendChild(this.container);
    this.miniMap = this.container.querySelector('.minimap')!;
    this.controls = this.container.querySelector('.controls-hint')!;
    this.message = this.container.querySelector('#hud-message')!;
    this.interactHint = this.container.querySelector('#interact-hint')!;

    // Clickable shortcut icons live in their own layer above the menus (z-index),
    // so they stay clickable whenever the mouse cursor is free (e.g. after Esc).
    this.iconLayer = document.createElement('div');
    this.iconLayer.id = 'hud-icons';
    this.iconLayer.innerHTML = `
      <style>
        #hud-icons {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          pointer-events: none; z-index: 300;
          font-family: 'Segoe UI', 'PingFang SC', sans-serif;
        }
        .hud-icon-btn {
          position: absolute; top: 104px; right: 20px;
          width: 54px; height: 54px; border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          font-size: 25px; line-height: 1; cursor: pointer;
          background: rgba(255,255,255,0.88);
          border: 2px solid rgba(255,200,150,0.9);
          box-shadow: 0 4px 14px rgba(0,0,0,0.2);
          pointer-events: auto; transition: transform 0.15s, background 0.15s;
        }
        .hud-icon-btn:hover { transform: scale(1.08); background: #fff; }
        .hud-icon-btn:active { transform: scale(0.96); }
        .hud-icon-btn .hud-icon-label {
          position: absolute; bottom: -17px; left: 50%; transform: translateX(-50%);
          font-size: 10px; font-weight: 600; color: #fff;
          text-shadow: 0 1px 3px rgba(0,0,0,0.7); white-space: nowrap;
        }
      </style>
      <button class="hud-icon-btn" id="hud-inventory" title="物品栏">
        🎒<span class="hud-icon-label">物品栏</span>
      </button>
    `;
    document.body.appendChild(this.iconLayer);
    this.iconLayer
      .querySelector('#hud-inventory')!
      .addEventListener('click', () => this.onToggleInventory?.());
  }

  updateEggCount(count: number) {
    const el = this.container.querySelector('#egg-count');
    if (el) el.textContent = `🥚 ${count} / 3`;
  }

  updateCoins(amount: number) {
    const el = this.container.querySelector('#coin-display');
    if (el) {
      el.textContent = `💰 ${amount}`;
      el.classList.add('bump');
      setTimeout(() => el.classList.remove('bump'), 200);
    }
  }

  showMessage(text: string, duration = 2000) {
    this.message.textContent = text;
    this.message.classList.add('show');
    setTimeout(() => this.message.classList.remove('show'), duration);
  }

  showPointerHint(show: boolean) {
    const hint = this.container.querySelector('#pointer-hint') as HTMLElement;
    if (hint) hint.style.display = show ? 'block' : 'none';
  }

  showInteractHint(label: string) {
    this.interactHint.textContent = label;
    this.interactHint.classList.add('show');
  }

  hideInteractHint() {
    this.interactHint.classList.remove('show');
  }

  destroy() {
    this.container.remove();
  }
}
