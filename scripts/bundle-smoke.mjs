import { rollup } from 'rollup';
import path from 'node:path';

function virtualEntryPlugin(entryCode) {
  return {
    name: 'virtual-entry',
    resolveId(id) {
      if (id === 'virtual:entry') return id;
      return null;
    },
    load(id) {
      if (id === 'virtual:entry') return entryCode;
      return null;
    },
  };
}

async function main() {
  const entry = path.resolve(process.cwd(), 'dist/browser.js');
  const entryCode = `import * as pkg from ${JSON.stringify(entry)};\n` +
    `console.log('SMOKE_IMPORT_OK', typeof pkg === 'object');\n` +
    `export default pkg;`;

  let hadWarning = false;
  const bundle = await rollup({
    input: 'virtual:entry',
    plugins: [virtualEntryPlugin(entryCode)],
    onwarn(w) {
      hadWarning = true;
      // Surface but do not fail on benign tree-shaking warnings
      console.warn('[rollup warning]', w.message);
    },
  });

  const { output } = await bundle.generate({ format: 'iife', name: 'BundleSmoke' });
  const code = output.map((o) => o.code || '').join('\n');

  if (code.includes('node:')) {
    console.error('Bundle contains node:* scheme references which should not appear in browser output');
    process.exit(1);
  }

  console.log('Bundle smoke OK. Bytes:', code.length, 'Warnings:', hadWarning ? 'yes' : 'no');
  await bundle.close();
}

main().catch((err) => {
  console.error('Bundle smoke failed:', err?.stack || err?.message || String(err));
  process.exit(1);
});

