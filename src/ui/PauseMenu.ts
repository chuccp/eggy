export class PauseMenu {
  private container: HTMLElement | null = null;
  private visible = false;

  onResume?: () => void;
  onReturnToStart?: () => void;
  onVolumeChange?: (vol: number) => void;
  onExit?: () => void;
  onOpenInventory?: () => void;
  private volume = 0.5;

  toggle() {
    if (this.visible) this.hide();
    else this.show();
  }

  show() {
    this.visible = true;
    this.render();
  }

  hide() {
    this.visible = false;
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  isVisible(): boolean { return this.visible; }

  handleKey(key: string): boolean {
    if (!this.visible) return false;
    if (key === 'Escape') {
      this.hide();
      this.onResume?.();
      return true;
    }
    return false;
  }

  private render() {
    if (this.container) this.container.remove();

    this.container = document.createElement('div');
    this.container.id = 'pause-menu';
    this.container.innerHTML = `
      <style>
        #pause-menu {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          z-index: 200; pointer-events: all;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(8px);
          font-family: 'Segoe UI', 'PingFang SC', sans-serif;
        }
        .pause-panel {
          background: linear-gradient(135deg, #fff9f0, #fff0e6);
          border-radius: 24px;
          padding: 36px 48px;
          min-width: 320px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          border: 2px solid rgba(255,200,150,0.4);
          text-align: center;
        }
        .pause-title {
          font-size: 28px; font-weight: 800; color: #5C3D2E;
          margin-bottom: 30px;
        }
        .pause-btn {
          display: block; width: 100%;
          padding: 14px 24px; margin-bottom: 12px;
          font-size: 16px; font-weight: 600;
          border: 2px solid transparent;
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s;
          color: #5C3D2E;
          background: rgba(255,255,255,0.5);
        }
        .pause-btn:hover {
          background: rgba(255,200,150,0.3);
          border-color: rgba(255,180,120,0.5);
          transform: scale(1.03);
        }
        .pause-btn.primary {
          background: linear-gradient(135deg, #FFE4C4, #FFD4A4);
          font-size: 18px;
          border-color: rgba(255,180,120,0.4);
        }
        .pause-btn.primary:hover {
          background: linear-gradient(135deg, #FFD4A4, #FFC494);
        }
        .pause-btn.danger {
          color: #c44;
        }
        .volume-row {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 12px; padding: 10px 16px;
          background: rgba(255,255,255,0.4);
          border-radius: 12px;
        }
        .volume-label { font-size: 14px; color: #666; min-width: 50px; }
        .volume-slider {
          flex: 1; height: 6px;
          -webkit-appearance: none; appearance: none;
          background: rgba(0,0,0,0.1); border-radius: 3px;
          outline: none;
        }
        .volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 18px; height: 18px; border-radius: 50%;
          background: #FFB380; cursor: pointer;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        .volume-value { font-size: 14px; color: #888; min-width: 36px; text-align: right; }
        .pause-hint {
          margin-top: 16px; font-size: 12px; color: #aaa;
        }
        .pause-hint kbd {
          background: rgba(0,0,0,0.08); border-radius: 4px;
          padding: 2px 8px; font-family: monospace;
        }
      </style>
      <div class="pause-panel">
        <div class="pause-title">⏸ 游戏暂停</div>
        <button class="pause-btn primary" id="pause-resume">▶ 继续游戏</button>
        <button class="pause-btn" id="pause-inventory">🎒 物品栏</button>
        <div class="volume-row">
          <span class="volume-label">🔊 音量</span>
          <input type="range" class="volume-slider" id="pause-volume" min="0" max="100" value="${Math.round(this.volume * 100)}">
          <span class="volume-value" id="pause-vol-val">${Math.round(this.volume * 100)}%</span>
        </div>
        <button class="pause-btn" id="pause-return">🏠 回到起点</button>
        <button class="pause-btn danger" id="pause-exit">🚪 退出到主界面</button>
        <div class="pause-hint">按 <kbd>Esc</kbd> 继续游戏</div>
      </div>
    `;

    document.body.appendChild(this.container);

    // Button handlers
    this.container.querySelector('#pause-resume')!.addEventListener('click', () => {
      this.hide();
      this.onResume?.();
    });

    this.container.querySelector('#pause-inventory')!.addEventListener('click', () => {
      this.hide();
      this.onOpenInventory?.();
    });

    this.container.querySelector('#pause-return')!.addEventListener('click', () => {
      this.hide();
      this.onReturnToStart?.();
      this.onResume?.();
    });

    this.container.querySelector('#pause-exit')!.addEventListener('click', () => {
      this.hide();
      this.onExit?.();
    });

    // Volume slider
    const slider = this.container.querySelector('#pause-volume') as HTMLInputElement;
    const volVal = this.container.querySelector('#pause-vol-val')!;
    slider.addEventListener('input', () => {
      this.volume = parseInt(slider.value) / 100;
      volVal.textContent = `${slider.value}%`;
      this.onVolumeChange?.(this.volume);
    });
  }
}
