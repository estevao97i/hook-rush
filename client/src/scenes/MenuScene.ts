/**
 * Menu principal: Jogar, Singleplayer, Multiplayer (vs IA), Configurações,
 * Controles, Créditos e Sair. Painéis simples sobrepostos.
 * Todas as posições usam a largura/altura ATUAL da tela (tela cheia
 * adaptativa) e a cena se recria em resize/rotação.
 */
import Phaser from 'phaser';
import { COLORS, UI_TEXT } from '../config/constants';
import { SaveSystem, GameMode, AIDiff } from '../core/SaveSystem';
import { AudioManager } from '../audio/AudioManager';
import { makeButton, makeSlider } from '../ui/widgets';

const DIFF_LABELS: Array<[AIDiff, string]> = [
  ['easy', 'Fácil'],
  ['medium', 'Médio'],
  ['hard', 'Difícil'],
  ['insane', 'Insano'],
];

export class MenuScene extends Phaser.Scene {
  private panel: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Menu');
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;

    // desbloqueia o áudio no primeiro gesto (regra dos navegadores)
    this.input.once('pointerdown', () => {
      const au = AudioManager.get();
      au.unlock();
      au.playMusic();
    });

    this.addBackdrop(w, h);

    const title = this.add
      .text(cx, 110, 'HOOK RUSH', {
        fontFamily: 'monospace',
        fontSize: '84px',
        fontStyle: 'bold',
        color: '#4da6ff',
      })
      .setOrigin(0.5)
      .setShadow(0, 6, '#000000', 12, false, true);
    // telas estreitas (celular na vertical): encolhe o título para caber
    title.setScale(Math.min(1, (w - 40) / title.width));
    this.add
      .text(cx, 168, 'corra · pule · balance · fuja da parede', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#9aa5b1',
      })
      .setOrigin(0.5);

    const best = SaveSystem.data.best;
    this.add
      .text(cx, 204, best > 0 ? `Recorde: ${best} m` : '', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffd94d',
      })
      .setOrigin(0.5);

    const items: Array<[string, () => void]> = [
      ['Jogar', () => this.startGame(SaveSystem.data.mode)],
      ['Singleplayer', () => this.startGame('single')],
      ['Multiplayer (vs IA)', () => this.startGame('versus')],
      ['Online (até 4)', () => this.scene.start('Lobby')],
      ['Configurações', () => this.showSettings()],
      ['Controles', () => this.showControls()],
      ['Créditos', () => this.showCredits()],
      ['Sair', () => this.quit()],
    ];
    const btnW = Math.min(320, w - 40);
    items.forEach(([label, cb], i) => makeButton(this, cx, 254 + i * 57, label, cb, btnW, 50));

    this.addMascot(w, h);

    // resize/rotação: recria o menu com as novas dimensões.
    // Usa timer da PRÓPRIA CENA (delayedCall): morre junto com ela — um
    // setTimeout global poderia disparar depois do shutdown e ressuscitar
    // a cena por cima do jogo.
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
  }

  private onResize(): void {
    this.time.removeAllEvents();
    this.time.delayedCall(120, () => this.scene.restart());
  }

  startGame(mode: GameMode): void {
    SaveSystem.data.mode = mode;
    SaveSystem.save();
    AudioManager.get().stopMusic();
    this.scene.start('Game', { mode, aiDiff: SaveSystem.data.aiDiff });
  }

  // ---------- painéis ----------

  private openPanel(title: string): Phaser.GameObjects.Container {
    this.panel?.destroy();
    const w = this.scale.width;
    const h = this.scale.height;
    const blocker = this.add
      .rectangle(w / 2, h / 2, w * 3, h * 3, 0x0b0e14, 0.82)
      .setInteractive();
    const box = this.add
      .rectangle(w / 2, h / 2, Math.min(640, w - 20), 480, 0x1a2030)
      .setStrokeStyle(2, 0x39445a);
    const t = this.add
      .text(w / 2, h / 2 - 200, title, {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: UI_TEXT,
      })
      .setOrigin(0.5);
    const back = makeButton(this, w / 2, h / 2 + 190, 'Voltar', () => {
      this.panel?.destroy();
      this.panel = null;
    }, 220, 46);
    this.panel = this.add.container(0, 0, [blocker, box, t, back]).setDepth(50);
    return this.panel;
  }

  private showSettings(): void {
    const p = this.openPanel('Configurações');
    const w = this.scale.width;
    const h = this.scale.height;
    const sw = Math.min(300, w - 120);
    const cx = w / 2 - sw / 2;
    const au = AudioManager.get();
    p.add(
      makeSlider(this, cx, h / 2 - 120, sw, 'Volume da música', SaveSystem.data.musicVol, (v) => {
        SaveSystem.data.musicVol = v;
        SaveSystem.save();
        au.setMusicVol(v);
      }),
    );
    p.add(
      makeSlider(this, cx, h / 2 - 40, sw, 'Volume dos efeitos', SaveSystem.data.sfxVol, (v) => {
        SaveSystem.data.sfxVol = v;
        SaveSystem.save();
        au.setSfxVol(v);
      }),
    );
    p.add(
      this.add.text(cx, h / 2 + 24, 'Dificuldade da IA', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: UI_TEXT,
      }),
    );
    const chips: Phaser.GameObjects.Rectangle[] = [];
    const chipW = Math.min(100, (w - 80) / 4 - 8);
    DIFF_LABELS.forEach(([key, label], i) => {
      const x = cx + chipW / 2 + i * (chipW + 8);
      const y = h / 2 + 70;
      const bg = this.add
        .rectangle(x, y, chipW, 40, SaveSystem.data.aiDiff === key ? 0x4da6ff : 0x232a38)
        .setStrokeStyle(2, 0x39445a)
        .setInteractive({ useHandCursor: true });
      const txt = this.add
        .text(x, y, label, { fontFamily: 'monospace', fontSize: '14px', color: UI_TEXT })
        .setOrigin(0.5);
      bg.on('pointerup', () => {
        SaveSystem.data.aiDiff = key;
        SaveSystem.save();
        AudioManager.get().click();
        chips.forEach((c, j) => c.setFillStyle(DIFF_LABELS[j][0] === key ? 0x4da6ff : 0x232a38));
      });
      chips.push(bg);
      p.add([bg, txt]);
    });
  }

  private showControls(): void {
    const p = this.openPanel('Controles');
    const lines = [
      'PC',
      '  Espaço ......... pular (segurar = mais alto)',
      '  Shift / ↓ / S ... deslizar',
      '  Mouse (segurar).. corda — soltar o botão solta',
      '  ESC ............. pause      F3 ... debug',
      '',
      'CELULAR / TABLET',
      '  ▲ ............... pular     ▼ ... deslizar',
      '  ⊙ (segurar) ..... corda',
      '',
      'A parede vermelha te persegue. NÃO PARE.',
    ];
    p.add(
      this.add
        .text(this.scale.width / 2, this.scale.height / 2 - 10, lines.join('\n'), {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: UI_TEXT,
          lineSpacing: 8,
        })
        .setOrigin(0.5),
    );
  }

  private showCredits(): void {
    const p = this.openPanel('Créditos');
    p.add(
      this.add
        .text(
          this.scale.width / 2,
          this.scale.height / 2 - 10,
          'HOOK RUSH\n\nUm runner infinito de gancho\nfeito com Phaser 3 + TypeScript.\n\nVisual, física, mapa e sons: 100% procedurais.\nNenhum asset externo foi utilizado.',
          { fontFamily: 'monospace', fontSize: '18px', color: UI_TEXT, align: 'center', lineSpacing: 8 },
        )
        .setOrigin(0.5),
    );
  }

  private quit(): void {
    window.close();
    // navegadores geralmente bloqueiam window.close() — avisa o jogador
    const p = this.openPanel('Sair');
    p.add(
      this.add
        .text(this.scale.width / 2, this.scale.height / 2 - 10, 'Pode fechar a aba quando quiser :)', {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: UI_TEXT,
        })
        .setOrigin(0.5),
    );
  }

  // ---------- decoração ----------

  private addBackdrop(w: number, h: number): void {
    for (let i = 0; i < 18; i++) {
      this.add
        .rectangle(
          Math.random() * w,
          Math.random() * h,
          30 + Math.random() * 110,
          30 + Math.random() * 190,
          i % 2 ? 0x1c2230 : 0x161b26,
        )
        .setDepth(-10);
    }
  }

  /** Mascote: o personagem minimalista quicando no canto. */
  private addMascot(w: number, h: number): void {
    if (w < 640) return; // sem espaço em telas estreitas
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const g = this.add.graphics({ x: w - 190, y: h - 150 });
    const leg = Phaser.Display.Color.IntegerToColor(color).darken(22).color;
    g.lineStyle(3, leg, 1);
    g.lineBetween(0, 12, -8, 26);
    g.lineBetween(2, 12, 10, 26);
    g.fillStyle(leg);
    g.fillCircle(-8, 26, 3);
    g.fillCircle(10, 26, 3);
    g.fillStyle(color);
    g.fillCircle(0, 0, 16);
    g.fillStyle(0xffffff);
    g.fillCircle(5, -4, 4.5);
    g.fillCircle(13, -4, 4.5);
    g.fillStyle(0x111111);
    g.fillCircle(6.5, -4, 2);
    g.fillCircle(14.5, -4, 2);
    this.tweens.add({ targets: g, y: '-=18', duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
}
