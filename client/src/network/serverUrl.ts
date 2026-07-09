/**
 * Resolução do endereço do servidor — sem tocar em código:
 * 1. query string:  ?server=192.168.0.10:2567  (ou ws://... completo)
 * 2. env de build:  VITE_SERVER_URL
 * 3. automático:    hostname da própria página + porta padrão
 *    (acessou http://192.168.x.x:5199 → conecta ws://192.168.x.x:2567)
 */
import { DEFAULT_PORT } from '@hookrush/shared';

export function getServerUrl(): string {
  const q = new URLSearchParams(window.location.search).get('server');
  if (q) return q.startsWith('ws') ? q : `ws://${q}`;
  const env = (import.meta as { env?: Record<string, string> }).env?.VITE_SERVER_URL;
  if (env) return env;
  return `ws://${window.location.hostname}:${DEFAULT_PORT}`;
}
