import { createStartScreen } from './ui/StartScreen';
import { HUD } from './ui/HUD';
import { Game } from './game/Game';
import { SaveManager } from './game/SaveManager';

let game: Game | null = null;
let hud: HUD | null = null;

function init() {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);

  const saveManager = new SaveManager();

  createStartScreen((eggColor) => {
    game = new Game(canvas, eggColor);
    hud = new HUD();
    game.setHUD(hud);

    // Initialize HUD with saved egg count
    hud.updateEggCount(game.eggsFoundCount);

    game.onEggFound = () => {
      if (hud && game) hud.showMessage(`🎉 发现隐藏彩蛋！(${game.eggsFoundCount}/3)`);
    };

    // Show welcome back message if save exists
    if (saveManager.hasSave()) {
      const saveTime = saveManager.getSaveTime();
      if (saveTime) {
        const timeStr = saveTime.toLocaleString('zh-CN');
        setTimeout(() => {
          if (hud) hud.showMessage(`💾 欢迎回来！上次游玩: ${timeStr}`, 3000);
        }, 500);
      }
    }

    game.start();

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      if (hud) hud.showPointerHint(!locked);
    });
  });
}

init();
