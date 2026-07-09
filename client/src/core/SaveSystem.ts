/**
 * Salvamento local (localStorage): recorde, volumes e preferências.
 */
export type GameMode = 'single' | 'versus';
export type AIDiff = 'easy' | 'medium' | 'hard' | 'insane';

export interface SaveData {
  best: number; // melhor distância (m)
  musicVol: number; // 0..1
  sfxVol: number; // 0..1
  mode: GameMode; // último modo jogado
  aiDiff: AIDiff; // dificuldade preferida da IA
}

const KEY = 'hook-rush-save-v1';

const DEFAULTS: SaveData = {
  best: 0,
  musicVol: 0.7,
  sfxVol: 0.8,
  mode: 'single',
  aiDiff: 'medium',
};

export class SaveSystem {
  static data: SaveData = SaveSystem.load();

  private static load(): SaveData {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      /* storage indisponível: usa defaults em memória */
    }
    return { ...DEFAULTS };
  }

  static save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(SaveSystem.data));
    } catch {
      /* ignora (modo privado etc.) */
    }
  }

  /** Registra distância e retorna true se for novo recorde. */
  static submitDistance(distM: number): boolean {
    if (distM > SaveSystem.data.best) {
      SaveSystem.data.best = Math.floor(distM);
      SaveSystem.save();
      return true;
    }
    return false;
  }
}
