/**
 * Áudio 100% sintetizado via Web Audio API — sem arquivos externos.
 * SFX: passos, pulo, gancho, impacto, recorde, menu.
 * Música: loop generativo simples (baixo + arpejo + chimbal de ruído).
 * Volumes separados de música e SFX.
 */
import { SaveSystem } from '../core/SaveSystem';

export class AudioManager {
  private static inst: AudioManager | null = null;
  static get(): AudioManager {
    if (!AudioManager.inst) AudioManager.inst = new AudioManager();
    return AudioManager.inst;
  }

  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private noiseBuf: AudioBuffer | null = null;

  private musicTimer: number | null = null;
  private nextT = 0;
  private stepIdx = 0;

  /** Deve ser chamado após o primeiro gesto do usuário (regra dos browsers). */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      // buffer de ruído branco compartilhado
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.setMusicVol(SaveSystem.data.musicVol);
      this.setSfxVol(SaveSystem.data.sfxVol);
    }
    void this.ctx.resume();
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  setMusicVol(v: number): void {
    if (this.ctx) this.musicGain.gain.value = v * 0.5;
  }

  setSfxVol(v: number): void {
    if (this.ctx) this.sfxGain.gain.value = v;
  }

  // ---------- primitivas ----------

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    slideTo?: number,
    delay = 0,
    dest?: GainNode,
  ): void {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(dest ?? this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol: number, filterFreq: number, type: BiquadFilterType = 'lowpass', when = 0, dest?: GainNode): void {
    if (!this.ctx || !this.noiseBuf) return;
    const t0 = when > 0 ? when : this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest ?? this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // ---------- SFX ----------

  click(): void {
    this.tone(700, 0.05, 'square', 0.18, 950);
  }

  jump(): void {
    this.tone(340, 0.13, 'sine', 0.28, 640);
  }

  step(): void {
    this.noise(0.03, 0.05, 1400);
  }

  /** Whoosh do arremesso da corda (a conexão toca attach() ao chegar). */
  throwHook(): void {
    this.noise(0.09, 0.12, 2200, 'bandpass');
  }

  attach(): void {
    this.tone(950, 0.09, 'triangle', 0.26, 680);
    this.noise(0.04, 0.14, 3200, 'highpass');
  }

  release(good: boolean): void {
    if (good) this.tone(500, 0.16, 'sine', 0.26, 920);
    else this.noise(0.12, 0.12, 700);
  }

  impact(): void {
    this.noise(0.18, 0.3, 320);
    this.tone(140, 0.2, 'sawtooth', 0.2, 55);
  }

  perfect(): void {
    this.tone(880, 0.06, 'sine', 0.14, 1180);
  }

  record(): void {
    this.tone(660, 0.09, 'square', 0.16);
    this.tone(880, 0.09, 'square', 0.16, undefined, 0.1);
    this.tone(1108, 0.2, 'square', 0.18, undefined, 0.2);
  }

  fall(): void {
    this.tone(420, 0.55, 'sawtooth', 0.24, 70);
  }

  // ---------- Música ----------

  playMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextT = this.ctx.currentTime + 0.1;
    this.stepIdx = 0;
    this.musicTimer = window.setInterval(() => this.schedule(), 80);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  /** Agenda notas ~0,2 s à frente (sequenciador simples em colcheias). */
  private schedule(): void {
    if (!this.ctx) return;
    const spb = 60 / 132 / 2; // colcheias a 132 BPM
    while (this.nextT < this.ctx.currentTime + 0.2) {
      const bar = Math.floor(this.stepIdx / 8) % 4;
      const s = this.stepIdx % 8;
      const roots = [110, 87.31, 130.81, 98]; // A2 F2 C3 G2
      if (s === 0 || s === 4) {
        this.tone(roots[bar], 0.22, 'triangle', 0.4, undefined, this.nextT - this.ctx.currentTime, this.musicGain);
      }
      const arp = [220, 261.6, 329.6, 392, 440, 392, 329.6, 261.6];
      this.tone(arp[s] * (bar === 2 ? 1.189 : 1), 0.11, 'square', 0.09, undefined, this.nextT - this.ctx.currentTime, this.musicGain);
      if (s % 2 === 0) this.noise(0.03, s === 0 ? 0.1 : 0.05, 6000, 'highpass', this.nextT, this.musicGain);
      this.nextT += spb;
      this.stepIdx++;
    }
  }
}
