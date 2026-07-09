/**
 * Constantes do CLIENTE.
 * Toda a física/gameplay vem de @hookrush/shared (fonte única — nunca
 * duplicada); aqui ficam apenas valores de apresentação (tela, UI, cores
 * de cenário e botões de toque).
 */
export * from '@hookrush/shared/config/gameConfig';

// ---- Tela (render) ----
export const GAME_W = 1280; // largura de design (referência)
export const GAME_H = 720; // altura lógica fixa
export const MIN_GAME_W = 360;
export const MAX_GAME_W = 2560;

// ---- Botões de toque (mobile) ----
export const BTN_RADIUS = 62;
export const BTN_RADIUS_HOOK = 84;
export const BTN_OPACITY = 0.4;
export const BTN_OPACITY_PRESSED = 0.62;
export const BTN_MARGIN = 26;
export const BTN_GAP = 20;

// ---- Cores de cenário/UI ----
export const BLOCK_COLOR = 0x2e3440;
export const BLOCK_EDGE = 0x4c566a;
export const ANCHOR_COLOR = 0xffd94d;
export const UI_TEXT = '#e8ecf4';
