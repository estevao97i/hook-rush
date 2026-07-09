/**
 * GameScene — partida OFFLINE (singleplayer / vs IA local).
 * Roda a MESMA simulação compartilhada do servidor (World) localmente, em
 * passo fixo de 60 Hz: física idêntica ao online, zero duplicação.
 * A cena só renderiza (views/efeitos/câmera/HUD) e coleta inputs.
 */
import Phaser from 'phaser';
import {
  World,
  SimEvent,
  HookPhase,
  SIM_DT,
  BASE_SPEED,
  COLORS,
  PPM,
  GROUND_Y,
  GEN_AHEAD,
  PlayerCore,
} from '@hookrush/shared';
import * as C from '../config/constants';
import { SaveSystem, GameMode, AIDiff } from '../core/SaveSystem';
import { AudioManager } from '../audio/AudioManager';
import { MapRenderer } from '../world/MapRenderer';
import { PlayerView, scratchView } from '../entities/PlayerView';
import { PoseLerper } from '../systems/renderLerp';
import { AIBot } from '../entities/AIBot';
import { PlayerInput } from '../input/InputController';
import { ParticleFX } from '../fx/Particles';
import { HUD } from '../ui/HUD';
import { WallView, Parallax, drawHookHint } from '../systems/raceView';
import { GameOverData } from './GameOverScene';

const LOCAL_ID = 'p1';
const BOT_ID = 'bot';

export class GameScene extends Phaser.Scene {
  private mode: GameMode = 'single';
  private aiDiff: AIDiff = 'medium';
  private seed = 0;

  private world!: World;
  private mapR!: MapRenderer;
  private views = new Map<string, PlayerView>();
  private bot: AIBot | null = null;
  private inputCtl!: PlayerInput;
  private fxm!: ParticleFX;
  private hud!: HUD;
  private hintGfx!: Phaser.GameObjects.Graphics;
  private wallView!: WallView;
  private parallax!: Parallax;
  private trails: Array<{ id: string; em: Phaser.GameObjects.Particles.ParticleEmitter }> = [];

  private kEsc!: Phaser.Input.Keyboard.Key;
  private kF3!: Phaser.Input.Keyboard.Key;

  private acc = 0;
  /** reutilizados por passo/frame — zero alocação no caminho quente */
  private readonly simInputs = new Map<string, number>();
  private poses = new PoseLerper();
  private best = 0;
  private recordBroken = false;
  private botDeadNotified = false;
  private ending = false;

  constructor() {
    super('Game');
  }

  init(data: { mode?: GameMode; aiDiff?: AIDiff }): void {
    this.mode = data.mode ?? 'single';
    this.aiDiff = data.aiDiff ?? SaveSystem.data.aiDiff;
    this.seed = (Math.random() * 0x7fffffff) | 0;
    this.views = new Map();
    this.poses = new PoseLerper();
    this.trails = [];
    this.bot = null;
    this.acc = 0;
    this.recordBroken = false;
    this.botDeadNotified = false;
    this.ending = false;
  }

  create(): void {
    this.best = SaveSystem.data.best;
    this.world = new World(this.seed, { wallEnabled: true });

    const colorIdx = (Math.random() * COLORS.length) | 0;
    const local = this.world.addPlayer(LOCAL_ID, colorIdx);
    if (this.mode === 'versus') {
      const botColor = (colorIdx + 1 + ((Math.random() * (COLORS.length - 1)) | 0)) % COLORS.length;
      const botCore = this.world.addPlayer(BOT_ID, botColor);
      this.bot = new AIBot(botCore, this.world.map, this.aiDiff);
    }

    this.parallax = new Parallax(this);
    this.mapR = new MapRenderer(this, this.world.map);
    this.fxm = new ParticleFX(this);
    this.hintGfx = this.add.graphics().setDepth(3);
    this.wallView = new WallView(this);

    for (const p of this.world.players.values()) {
      const view = new PlayerView(this, COLORS[p.colorIdx], p.id === LOCAL_ID);
      this.views.set(p.id, view);
      this.trails.push({ id: p.id, em: this.fxm.makeTrail(view.follow, COLORS[p.colorIdx]) });
    }

    const cam = this.cameras.main;
    cam.startFollow(this.views.get(LOCAL_ID)!.follow, false, 0.14, 0.08);
    cam.setFollowOffset(-160, 80);

    if (this.best > 0) {
      const rx = local.startX + this.best * PPM;
      this.add.rectangle(rx, GROUND_Y - 130, 3, 260, 0xffd94d, 0.4).setDepth(0);
      this.add
        .text(rx, GROUND_Y - 270, 'RECORDE', { fontFamily: 'monospace', fontSize: '14px', color: '#ffd94d' })
        .setOrigin(0.5)
        .setAlpha(0.7);
    }

    const d = this.sys.game.device;
    const isMobile = d.os.android || d.os.iOS || d.os.iPad || (d.input.touch && !d.os.desktop);
    this.inputCtl = new PlayerInput(this, isMobile, () => this.pauseGame());
    this.hud = new HUD(this);
    if (this.mode === 'versus') this.hud.notice('Corrida contra a IA!');

    const kb = this.input.keyboard!;
    kb.addCapture('ESC,F3');
    this.kEsc = kb.addKey('ESC');
    this.kF3 = kb.addKey('F3');

    (window as any).hookRushScene = this; // handle de debug (console)
  }

  update(_t: number, delta: number): void {
    const JD = Phaser.Input.Keyboard.JustDown;
    if (JD(this.kEsc)) this.pauseGame();
    if (JD(this.kF3)) this.hud.debugVisible = !this.hud.debugVisible;

    // ---- simulação em passo fixo de 60 Hz (mesma do servidor) ----
    const dt = Math.min(delta / 1000, 0.05);
    this.acc += dt;
    while (this.acc >= SIM_DT) {
      this.acc -= SIM_DT;
      this.poses.capture(this.world.players); // pose anterior p/ render lerp
      this.simInputs.clear();
      this.simInputs.set(LOCAL_ID, this.inputCtl.readBits());
      if (this.bot) this.simInputs.set(BOT_ID, this.bot.readBits());
      this.handleEvents(this.world.step(this.simInputs));
    }
    // interpolação de render: sim 60 Hz → FPS livre sem stair-step
    const alpha = Phaser.Math.Clamp(this.acc / SIM_DT, 0, 1);

    // ---- render ----
    const local = this.world.players.get(LOCAL_ID)!;
    const au = AudioManager.get();
    for (const p of this.world.players.values()) {
      const pose = this.poses.sample(p, alpha);
      fillView(p, pose.x, pose.y, pose.tipX, pose.tipY);
      this.views
        .get(p.id)!
        .update(scratchView, dt, p.id === LOCAL_ID ? () => au.step() : undefined);
    }
    for (const t of this.trails) {
      const core = this.world.players.get(t.id);
      t.em.emitting = !!core?.alive && core.vx > BASE_SPEED * 1.5;
    }
    this.wallView.update(this.world.wall.x);
    this.mapR.sync();

    const cam = this.cameras.main;
    const vx = local.vx;
    const lookAhead = Phaser.Math.Clamp(vx * 0.45, 120, this.scale.width * 0.32);
    cam.followOffset.x += (-lookAhead - cam.followOffset.x) * Math.min(1, 3 * dt);
    const targetZoom = Phaser.Math.Clamp(1.04 - (vx / BASE_SPEED - 1) * 0.05, 0.8, 1.04);
    cam.setZoom(cam.zoom + (targetZoom - cam.zoom) * Math.min(1, 2 * dt));
    this.parallax.update(cam, this.scale.width);

    if (local.alive && local.hook.phase === HookPhase.Idle) {
      drawHookHint(this.hintGfx, this.world.map, local.x, local.y - 23, this.time.now);
    } else this.hintGfx.clear();

    if (!this.recordBroken && this.best > 0 && local.distance > this.best) {
      this.recordBroken = true;
      au.record();
      this.hud.notice('★ NOVO RECORDE! ★');
    }

    const botCore = this.bot ? this.world.players.get(BOT_ID) : undefined;
    let centerText: string | null = null;
    if (botCore) {
      const dd = Math.round(botCore.distance - local.distance);
      centerText = !botCore.alive
        ? 'IA eliminada! 🎉'
        : dd >= 0
          ? `IA +${dd} m à frente`
          : `IA ${Math.abs(dd)} m atrás`;
    }
    this.hud.update(dt, {
      distance: local.distance,
      best: this.best,
      speedPx: vx,
      centerText,
      centerColor: botCore && !botCore.alive ? '#7dd3a0' : undefined,
      wallGap: local.x - this.world.wall.x,
      debug: {
        fps: this.game.loop.actualFps,
        obstacles: this.world.map.blocks.length,
        seed: this.seed,
        hook: hookLabel(local),
        mult: local.mult,
        timeBonus: local.timeBonus,
        posM: local.x / PPM,
        state: local.alive ? (local.grounded ? 'chão' : 'ar') : 'morto',
      },
    });

    if (!local.alive && !this.ending) this.endRun(local, botCore);
  }

  /** Eventos da simulação → efeitos (partículas/som/câmera). */
  private handleEvents(events: SimEvent[]): void {
    const cam = this.cameras.main;
    const au = AudioManager.get();
    for (const e of events) {
      const isLocal = e.playerId === LOCAL_ID;
      switch (e.type) {
        case 'jump':
          this.fxm.dustBurst(e.x, e.y, 5);
          if (isLocal) au.jump();
          break;
        case 'land':
          if ((e.v ?? 0) > 420) this.fxm.dustBurst(e.x, e.y, Math.min(12, Math.round((e.v ?? 0) / 80)));
          break;
        case 'hit':
          this.fxm.sparkBurst(e.x, e.y);
          if (isLocal) {
            cam.shake(120, 0.005);
            au.impact();
          }
          break;
        case 'perfect':
          if (isLocal) {
            au.perfect();
            this.hud.pulseSpeed();
          }
          break;
        case 'throw':
          if (isLocal) au.throwHook();
          break;
        case 'attach':
          if (isLocal) au.attach();
          break;
        case 'release':
          if (isLocal) au.release(e.v === 1);
          break;
        case 'fall':
        case 'wallkill':
          if (isLocal) {
            au.fall();
            cam.shake(220, 0.008);
          } else if (!this.botDeadNotified) {
            this.botDeadNotified = true;
            this.hud.notice(e.type === 'wallkill' ? 'A parede pegou a IA!' : 'A IA caiu!');
          }
          break;
      }
    }
  }

  private pauseGame(): void {
    if (this.ending || this.scene.isPaused()) return;
    AudioManager.get().click();
    this.scene.launch('Pause');
    this.scene.pause();
  }

  private endRun(local: PlayerCore, botCore?: PlayerCore): void {
    this.ending = true;
    this.cameras.main.stopFollow();
    const isRecord = SaveSystem.submitDistance(local.distance);
    const data: GameOverData = {
      mode: this.mode,
      aiDiff: this.aiDiff,
      dist: local.distance,
      best: SaveSystem.data.best,
      isRecord,
      aiDist: botCore?.distance ?? 0,
      playerWon: local.distance >= (botCore?.distance ?? 0),
    };
    this.time.delayedCall(350, () => {
      this.scene.launch('GameOver', data);
      this.scene.pause();
    });
  }
}

/** Preenche o ViewState pooled (consumido sincronamente pelo view.update). */
function fillView(p: PlayerCore, x: number, y: number, tipX: number, tipY: number): void {
  scratchView.x = x;
  scratchView.y = y;
  scratchView.vx = p.vx;
  scratchView.grounded = p.grounded;
  scratchView.crouched = p.crouched;
  scratchView.stunned = p.stunT > 0;
  scratchView.alive = p.alive;
  scratchView.hookPhase = p.hook.phase;
  scratchView.hookTipX = tipX;
  scratchView.hookTipY = tipY;
}

function hookLabel(p: PlayerCore): string {
  switch (p.hook.phase) {
    case HookPhase.Attached:
      return `preso (${p.hook.ropeLen.toFixed(0)}px)`;
    case HookPhase.Firing:
      return 'disparando';
    case HookPhase.Retracting:
      return 'recolhendo';
    default:
      return 'livre';
  }
}
