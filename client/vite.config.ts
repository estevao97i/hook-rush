import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      // código compartilhado (simulação/física/mapa) importado como fonte TS
      '@hookrush/shared': fileURLToPath(new URL('../shared/src', import.meta.url)),
    },
  },
  server: {
    port: 5199,
    host: true,
    fs: { allow: ['..'] },
  },
});
