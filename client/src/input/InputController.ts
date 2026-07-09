/**
 * InputSystem (cliente) — converte teclado/mouse/touch em InputBits.
 * Espaço = Jump, Shift/↓/S = Slide, mouse esquerdo (hold) = Hook.
 * O MESMO bitmask alimenta a predição local e vai para o servidor —
 * o cliente nunca envia posição/velocidade/física.
 */
import Phaser from 'phaser';
import { InputBits } from '@hookrush/shared';
import { MobileControls } from './MobileControls';

export class PlayerInput {
  private kSpace: Phaser.Input.Keyboard.Key;
  private kUp: Phaser.Input.Keyboard.Key;
  private kW: Phaser.Input.Keyboard.Key;
  private kDown: Phaser.Input.Keyboard.Key;
  private kS: Phaser.Input.Keyboard.Key;
  private kShift: Phaser.Input.Keyboard.Key;
  private clickHook = false; // toque/clique curtíssimo ainda registra 1 tick
  readonly mobile: MobileControls | null = null;

  constructor(private scene: Phaser.Scene, useTouch: boolean, onPause: () => void) {
    const kb = scene.input.keyboard!;
    kb.addCapture('SPACE,DOWN,SHIFT,S,W,UP');
    this.kSpace = kb.addKey('SPACE');
    this.kUp = kb.addKey('UP');
    this.kW = kb.addKey('W');
    this.kDown = kb.addKey('DOWN');
    this.kS = kb.addKey('S');
    this.kShift = kb.addKey('SHIFT');
    if (useTouch) {
      this.mobile = new MobileControls(scene, onPause);
    } else {
      scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.leftButtonDown()) this.clickHook = true;
      });
    }
  }

  /** Bitmask do frame — mesma semântica no offline, na predição e no servidor. */
  readBits(): number {
    let bits = 0;
    if (this.kSpace.isDown || this.kUp.isDown || this.kW.isDown) bits |= InputBits.Jump;
    if (this.kShift.isDown || this.kDown.isDown || this.kS.isDown) bits |= InputBits.Slide;
    if (!this.mobile) {
      const held = this.scene.input.mousePointer?.leftButtonDown() ?? false;
      if (held || this.clickHook) bits |= InputBits.Hook;
      this.clickHook = false;
    } else {
      bits |= this.mobile.consumeBits();
    }
    return bits;
  }
}
