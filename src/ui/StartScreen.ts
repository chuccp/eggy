import { COLORS } from '../utils/colors';

/** Remembers the last egg colour the player picked. */
const EGG_COLOR_KEY = 'danzai_egg_color';

function loadSavedColor(): number | null {
  try {
    const raw = localStorage.getItem(EGG_COLOR_KEY);
    if (raw === null) return null;
    const value = Number(raw);
    return COLORS.eggOptions.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function saveColor(color: number) {
  try {
    localStorage.setItem(EGG_COLOR_KEY, String(color));
  } catch {
    // storage unavailable (private mode) — the default colour is used instead
  }
}

export function createStartScreen(onStart: (color: number) => void): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = 'start-screen';
  overlay.innerHTML = `
    <style>
      #start-screen {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: linear-gradient(135deg, #FFB3BA 0%, #BAE1FF 50%, #BAFFC9 100%);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        z-index: 100; font-family: 'Segoe UI', 'PingFang SC', sans-serif;
        transition: opacity 0.5s;
      }
      #start-screen.hidden { opacity: 0; pointer-events: none; }
      .title {
        font-size: 72px; font-weight: 900; color: #fff;
        text-shadow: 3px 3px 0 #FFB3BA, 6px 6px 0 rgba(0,0,0,0.1);
        margin-bottom: 10px; letter-spacing: 8px;
      }
      .subtitle {
        font-size: 20px; color: rgba(255,255,255,0.8); margin-bottom: 40px;
      }
      .color-picker {
        display: flex; gap: 12px; margin-bottom: 40px;
      }
      .color-btn {
        width: 48px; height: 48px; border-radius: 50%; border: 3px solid transparent;
        cursor: pointer; transition: transform 0.2s, border-color 0.2s;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      }
      .color-btn:hover { transform: scale(1.15); }
      .color-btn.selected { border-color: #fff; transform: scale(1.2); }
      .start-btn {
        padding: 16px 48px; font-size: 22px; font-weight: 700;
        background: #fff; color: #FF8C94; border: none; border-radius: 30px;
        cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.15);
        transition: transform 0.2s, box-shadow 0.2s;
        letter-spacing: 4px;
      }
      .start-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }
      .hint { margin-top: 30px; font-size: 14px; color: rgba(255,255,255,0.6); }
    </style>
    <div class="title">蛋仔闲逛</div>
    <div class="subtitle">一个轻松的 3D 闲逛小游戏</div>
    <div class="color-picker" id="color-picker"></div>
    <button class="start-btn" id="start-btn">开始闲逛</button>
    <div class="hint">选择你喜欢的蛋仔颜色，然后开始探索吧！</div>
  `;

  document.body.appendChild(overlay);

  // Start on whatever colour was used last time
  let selectedColor = loadSavedColor() ?? COLORS.eggOptions[0];

  // Color buttons
  const picker = overlay.querySelector('#color-picker')!;
  COLORS.eggOptions.forEach((color) => {
    const btn = document.createElement('div');
    btn.className = `color-btn${color === selectedColor ? ' selected' : ''}`;
    btn.style.backgroundColor = `#${color.toString(16).padStart(6, '0')}`;
    btn.addEventListener('click', () => {
      picker.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = color;
    });
    picker.appendChild(btn);
  });

  // Start button — guard against a second start (Enter key repeat / double click),
  // which would spin up a second Game loop sharing the same canvas.
  let started = false;
  overlay.querySelector('#start-btn')!.addEventListener('click', () => {
    if (started) return;
    started = true;
    saveColor(selectedColor);
    overlay.classList.add('hidden');
    setTimeout(() => overlay.remove(), 500);
    onStart(selectedColor);
  });

  return overlay;
}
