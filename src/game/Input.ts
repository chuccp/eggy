export class Input {
  keys = new Set<string>();
  justPressed = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  scrollDelta = 0;
  pointerLocked = false;

  // Gamepad state
  gamepadConnected = false;
  private gpButtons: boolean[] = [];
  private gpPrevButtons: boolean[] = [];
  private gpAxes: number[] = [0, 0, 0, 0];
  private gpJustPressed: boolean[] = [];

  constructor(private canvas: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    window.addEventListener('wheel', (e) => {
      this.scrollDelta += e.deltaY;
    });

    canvas.addEventListener('click', () => {
      if (!this.pointerLocked) {
        canvas.requestPointerLock();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });

    // Gamepad connect/disconnect events
    window.addEventListener('gamepadconnected', () => {
      this.gamepadConnected = true;
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.gamepadConnected = false;
    });
  }

  /** Poll gamepad state — call once per frame before reading inputs */
  pollGamepad() {
    const gamepads = navigator.getGamepads();
    const gp = gamepads.find(g => g !== null);
    if (!gp) {
      this.gamepadConnected = false;
      return;
    }
    this.gamepadConnected = true;

    // Store previous button state for just-pressed detection
    this.gpPrevButtons = [...this.gpButtons];
    this.gpButtons = gp.buttons.map(b => b.pressed);
    this.gpAxes = [...gp.axes];

    // Detect just-pressed
    this.gpJustPressed = this.gpButtons.map((pressed, i) =>
      pressed && !(this.gpPrevButtons[i] ?? false),
    );
  }

  isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  consumeMouseDelta(): { dx: number; dy: number } {
    let dx = this.mouseDX;
    let dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;

    // Add right stick as camera movement
    if (this.gamepadConnected) {
      const rx = this.gpAxes[2] ?? 0;
      const ry = this.gpAxes[3] ?? 0;
      if (Math.abs(rx) > 0.1) dx += rx * 40;
      if (Math.abs(ry) > 0.1) dy += ry * 40;
    }

    return { dx, dy };
  }

  consumeScrollDelta(): number {
    const d = this.scrollDelta;
    this.scrollDelta = 0;
    return d;
  }

  wasJustPressed(code: string): boolean {
    return this.justPressed.has(code);
  }

  consumeJustPressed() {
    this.justPressed.clear();
    this.gpJustPressed = [];
  }

  // Keyboard + Gamepad combined inputs
  get forward(): boolean {
    return this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp')
      || (this.gamepadConnected && (this.gpAxes[1] ?? 0) < -0.15);
  }
  get backward(): boolean {
    return this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown')
      || (this.gamepadConnected && (this.gpAxes[1] ?? 0) > 0.15);
  }
  get left(): boolean {
    return this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft')
      || (this.gamepadConnected && (this.gpAxes[0] ?? 0) < -0.15);
  }
  get right(): boolean {
    return this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight')
      || (this.gamepadConnected && (this.gpAxes[0] ?? 0) > 0.15);
  }
  get jump(): boolean {
    return this.isKeyDown('Space')
      || (this.gamepadConnected && (this.gpButtons[0] ?? false)); // A button
  }
  get sprint(): boolean {
    return this.isKeyDown('ShiftLeft') || this.isKeyDown('ShiftRight')
      || (this.gamepadConnected && (this.gpButtons[1] ?? false)); // B button
  }
  get interact(): boolean {
    return this.isKeyDown('KeyE')
      || (this.gamepadConnected && (this.gpButtons[2] ?? false)); // X button
  }
  get escape(): boolean {
    return this.isKeyDown('Escape')
      || (this.gamepadConnected && (this.gpButtons[9] ?? false)); // Start button
  }

  /** Check if a gamepad button was just pressed (for E-key interactions) */
  gpJustPressedButton(idx: number): boolean {
    return this.gamepadConnected && (this.gpJustPressed[idx] ?? false);
  }
}
