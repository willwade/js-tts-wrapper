import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '..', '..');
const browserBundle = resolve(repoRoot, 'dist', 'js-tts-wrapper.browser.js');

if (!existsSync(browserBundle)) {
  console.warn('[vue-browser-demo] Built browser bundle not found at', browserBundle);
  console.warn('Run `npm run build` from the repository root before starting the demo.');
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'js-tts-wrapper/browser': browserBundle,
      'js-tts-wrapper': browserBundle
    }
  }
});
