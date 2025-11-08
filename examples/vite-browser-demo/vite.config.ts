import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fileDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(fileDir, '..', '..');
const browserBundle = resolve(repoRoot, 'dist', 'js-tts-wrapper.browser.js');

if (!existsSync(browserBundle)) {
  console.warn('[vite-browser-demo] Build artifact missing at', browserBundle);
  console.warn('Run `npm run build` from the repository root before starting the demo.');
}

export default defineConfig({
  root: fileDir,
  build: {
    outDir: resolve(fileDir, 'dist'),
    emptyOutDir: true
  },
  resolve: {
    alias: {
      'js-tts-wrapper/browser': browserBundle,
      'js-tts-wrapper': browserBundle
    }
  }
});
