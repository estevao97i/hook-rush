/**
 * Controles touch fixos, sempre acima do jogo (depth alto, scrollFactor 0):
 * - esquerda, empilhados: ▲ pular (em cima) e ▼ deslizar (embaixo);
 * - direita: ⊙ gancho, grande — segurar mantém a corda, soltar solta;
 * - pause no topo direito.
 * Botões circulares brancos translúcidos (BTN_OPACITY), tamanho/posição/
 * opacidade configuráveis em constants.ts, respeitando as safe areas
 * (notch) e reposicionados a cada resize/rotação.
 */
import Phaser from 'phaser';
import * as C from '../config/constants';
import { InputBits } from '@hookrush/shared';

interface HoldButton {
  circle: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  radius: number;
  down: boolean;
  queued: boolean; // borda de "apertou agora"
}

/** Lê uma safe-area inset (CSS var do index.html) convertida para px lógicos. */
function safeInset(scene: Phaser.Scene, side: 'top' | 'right' | 'bottom' | 'left'): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--sa-${side}`);
  const css = parseFloat(raw) || 0;
  const ratio = scene.scale.height / Math.max(1, scene.scale.displaySize.height);
  return css * ratio;
}

export class MobileControls {
  private jump: HoldButton;
  private slide: HoldButton;
  private hook: HoldButton;
  private pauseBtn: HoldButton;

  constructor(private scene: Phaser.Scene, onPause: () => void) {
    scene.input.addPointer(2); // até 4 toques simultâneos (3 botões + folga)

    this.jump = this.mkButton('▲', C.BTN_RADIUS);
    this.slide = this.mkButton('▼', C.BTN_RADIUS);
    this.hook = this.mkButton('⊙', C.BTN_RADIUS_HOOK);
    this.pauseBtn = this.mkButton('❚❚', 34);
    this.pauseBtn.circle.on('pointerdown', onPause);

    this.layout();
    scene.scale.on('resize', this.layout, this);
    scene.events.once('shutdown', () => scene.scale.off('resize', this.layout, this));
  }

  private mkButton(label: string, radius: number): HoldButton {
    const circle = this.scene.add
      .circle(0, 0, radius, 0xffffff, C.BTN_OPACITY)
      .setStrokeStyle(2, 0xffffff, 0.55)
      .setScrollFactor(0)
      .setDepth(200)
      .setInteractive();
    const text = this.scene.add
      .text(0, 0, label, {
        fontFamily: 'monospace',
        fontSize: `${Math.round(radius * 0.62)}px`,
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setAlpha(0.9);
    const b: HoldButton = { circle, label: text, radius, down: false, queued: false };
    circle.on('pointerdown', () => {
      b.down = true;
      b.queued = true;
      circle.setFillStyle(0xffffff, C.BTN_OPACITY_PRESSED);
    });
    const release = () => {
      b.down = false;
      circle.setFillStyle(0xffffff, C.BTN_OPACITY);
    };
    circle.on('pointerup', release);
    circle.on('pointerout', release);
    return b;
  }

  /** Posiciona os botões dentro da safe area — chamado no resize/rotação. */
  private layout(): void {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const il = safeInset(this.scene, 'left');
    const ir = safeInset(this.scene, 'right');
    const ib = safeInset(this.scene, 'bottom');
    const it = safeInset(this.scene, 'top');
    // telas estreitas (vertical): reduz os botões proporcionalmente
    const k = Phaser.Math.Clamp(w / 900, 0.68, 1);

    const place = (b: HoldButton, x: number, y: number) => {
      b.circle.setPosition(x, y).setScale(k);
      b.label.setPosition(x, y).setScale(k);
    };

    const lx = il + C.BTN_MARGIN + C.BTN_RADIUS * k;
    const slideY = h - ib - C.BTN_MARGIN - C.BTN_RADIUS * k;
    const jumpY = slideY - (C.BTN_RADIUS * 2 + C.BTN_GAP) * k;
    place(this.jump, lx, jumpY); // superior: pular
    place(this.slide, lx, slideY); // inferior: deslizar

    const hx = w - ir - C.BTN_MARGIN - C.BTN_RADIUS_HOOK * k;
    const hy = h - ib - C.BTN_MARGIN - C.BTN_RADIUS_HOOK * k;
    place(this.hook, hx, hy); // direita: gancho (grande)

    place(this.pauseBtn, w - ir - 52, it + 52);
  }

  /**
   * Bits do frame: cada botão vira EXATAMENTE o mesmo input do teclado.
   * `queued` garante que um toque mais curto que um tick registre 1 tick.
   */
  consumeBits(): number {
    let bits = 0;
    if (this.jump.down || this.jump.queued) bits |= InputBits.Jump;
    if (this.slide.down || this.slide.queued) bits |= InputBits.Slide;
    if (this.hook.down || this.hook.queued) bits |= InputBits.Hook;
    this.jump.queued = false;
    this.slide.queued = false;
    this.hook.queued = false;
    return bits;
  }
}
