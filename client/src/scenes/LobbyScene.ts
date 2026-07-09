/**
 * LobbyScene — RoomSystem no cliente:
 * Jogo Rápido (joinOrCreate), Criar Sala (código A8JKP para compartilhar)
 * e Entrar com Código. Mostra a lista de jogadores da sala; o host inicia.
 * Quando a fase vira Countdown/Racing, entra na OnlineGameScene.
 */
import Phaser from 'phaser';
import { GamePhase, COLORS, MAX_PLAYERS } from '@hookrush/shared';
import { UI_TEXT } from '../config/constants';
import { NetworkClient } from '../network/NetworkClient';
import { makeButton } from '../ui/widgets';
import { AudioManager } from '../audio/AudioManager';

export class LobbyScene extends Phaser.Scene {
  private net!: NetworkClient;
  private statusText!: Phaser.GameObjects.Text;
  private roomPanel: Phaser.GameObjects.Container | null = null;
  private menuButtons: Phaser.GameObjects.Container[] = [];
  private codeText!: Phaser.GameObjects.Text;
  private playersText!: Phaser.GameObjects.Text;
  private startBtn: Phaser.GameObjects.Container | null = null;
  private busy = false;

  constructor() {
    super('Lobby');
  }

  create(): void {
    // NetworkSystem é único e compartilhado entre cenas via registry
    this.net = (this.registry.get('net') as NetworkClient) ?? new NetworkClient();
    this.registry.set('net', this.net);

    const w = this.scale.width;
    const cx = w / 2;
    this.add
      .text(cx, 90, 'ONLINE', { fontFamily: 'monospace', fontSize: '56px', fontStyle: 'bold', color: '#4da6ff' })
      .setOrigin(0.5);
    this.add
      .text(cx, 140, `servidor: ${this.net.url}`, { fontFamily: 'monospace', fontSize: '13px', color: '#9aa5b1' })
      .setOrigin(0.5);
    this.statusText = this.add
      .text(cx, 178, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ffd94d' })
      .setOrigin(0.5);

    this.menuButtons = [
      makeButton(this, cx, 240, 'Jogo Rápido', () => this.guard(() => this.net.quickPlay(this.playerName()))),
      makeButton(this, cx, 306, 'Criar Sala', () => this.guard(() => this.net.createPrivate(this.playerName()))),
      makeButton(this, cx, 372, 'Entrar com Código', () => {
        const code = window.prompt('Código da sala (ex.: A8JKP):') ?? '';
        if (code.trim()) this.guard(() => this.net.joinByCode(code, this.playerName()));
      }),
      makeButton(this, cx, 438, 'Voltar', () => {
        this.net.leave();
        this.scene.start('Menu');
      }),
    ];

    this.buildRoomPanel();
    if (this.net.connected) this.showRoom(true);
    else this.showRoom(false);

    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
  }

  private onResize(): void {
    this.time.removeAllEvents();
    this.time.delayedCall(120, () => this.scene.restart());
  }

  private playerName(): string {
    return `Jogador`;
  }

  /** Executa uma ação de rede com feedback e tratamento de erro. */
  private guard(fn: () => Promise<unknown>): void {
    if (this.busy) return;
    this.busy = true;
    this.statusText.setText('Conectando...');
    fn()
      .then(() => {
        this.statusText.setText('');
        this.showRoom(true);
      })
      .catch((e: Error) => {
        this.statusText.setText(`Erro: ${e.message ?? 'falha ao conectar'}`);
      })
      .finally(() => {
        this.busy = false;
      });
  }

  private buildRoomPanel(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    const box = this.add
      .rectangle(cx, h / 2 + 40, Math.min(560, w - 20), 420, 0x1a2030)
      .setStrokeStyle(2, 0x39445a);
    const codeLabel = this.add
      .text(cx, h / 2 - 120, 'CÓDIGO DA SALA', { fontFamily: 'monospace', fontSize: '15px', color: '#9aa5b1' })
      .setOrigin(0.5);
    this.codeText = this.add
      .text(cx, h / 2 - 78, '-----', { fontFamily: 'monospace', fontSize: '52px', fontStyle: 'bold', color: '#ffd94d' })
      .setOrigin(0.5);
    this.playersText = this.add
      .text(cx, h / 2 - 20, '', { fontFamily: 'monospace', fontSize: '20px', color: UI_TEXT, align: 'center', lineSpacing: 10 })
      .setOrigin(0.5, 0);
    this.startBtn = makeButton(this, cx, h / 2 + 150, 'Começar corrida', () => this.net.sendStart());
    const leave = makeButton(this, cx, h / 2 + 210, 'Sair da sala', () => {
      this.net.leave();
      this.showRoom(false);
    }, 220, 42);
    this.roomPanel = this.add.container(0, 0, [
      box,
      codeLabel,
      this.codeText,
      this.playersText,
      this.startBtn,
      leave,
    ]);
  }

  private showRoom(inRoom: boolean): void {
    this.roomPanel?.setVisible(inRoom);
    for (const b of this.menuButtons) b.setVisible(!inRoom);
  }

  update(): void {
    const room = this.net.room;
    if (!room) {
      if (this.roomPanel?.visible) this.showRoom(false);
      return;
    }
    if (!this.roomPanel?.visible) this.showRoom(true);
    const st = room.state as any;
    if (!st) return;

    this.codeText.setText(room.roomId ?? '-----');
    const lines: string[] = [];
    let count = 0;
    st.players?.forEach?.((p: any, id: string) => {
      count++;
      const you = id === room.sessionId ? ' (você)' : '';
      const host = id === st.hostId ? ' ★' : '';
      const colorHex = '#' + (COLORS[p.colorIdx] ?? 0xffffff).toString(16).padStart(6, '0');
      lines.push(`[color=${colorHex}]●[/color] ${p.name}${you}${host}`);
    });
    // Phaser Text não interpreta BBCode — remove as tags de cor
    this.playersText.setText(
      lines.map((l) => l.replace(/\[color=[^\]]+\]|\[\/color\]/g, '')).join('\n') +
        `\n\n${count}/${MAX_PLAYERS} jogadores`,
    );
    const isHost = st.hostId === room.sessionId;
    this.startBtn?.setVisible(isHost && st.phase === GamePhase.Lobby);

    if (st.phase === GamePhase.Countdown || st.phase === GamePhase.Racing) {
      AudioManager.get().stopMusic();
      this.scene.start('OnlineGame');
    }
  }
}
