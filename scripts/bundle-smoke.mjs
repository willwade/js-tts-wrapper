import { rollup } from 'rollup';
import path from 'node:path';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';

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

async function bundleAndCheck({ entryCode, plugins = [], label }) {
  let hadWarning = false;
  const bundle = await rollup({
    input: 'virtual:entry',
    plugins: [virtualEntryPlugin(entryCode), ...plugins],
    onwarn(w) {
      hadWarning = true;
      // Surface but do not fail on benign tree-shaking warnings
      console.warn(`[rollup warning:${label}]`, w.message);
    },
  });

  const { output } = await bundle.generate({
    format: 'iife',
    name: 'BundleSmoke',
    inlineDynamicImports: true,
  });
  const code = output.map((o) => o.code || '').join('\n');

  // Fail only if there appear to be actual imports of node:* builtins,
  // not just string literals left in dead branches.
  const nodeImportRegex = /(from\s+['"]node:|require\(['"]node:|import\(['"]node:)/;
  if (nodeImportRegex.test(code)) {
    console.error(`${label} appears to import Node builtins (node:*) in browser output`);
    process.exit(1);
  }

  console.log(`${label} OK. Bytes:`, code.length, 'Warnings:', hadWarning ? 'yes' : 'no');
  await bundle.close();
}

async function main() {
  // Use the pre-bundled browser artifact that already inlines browser deps.
  const browserBundleEntry = path.resolve(process.cwd(), 'dist/js-tts-wrapper.browser.js');
  const browserBundleEntryCode = `import * as pkg from ${JSON.stringify(browserBundleEntry)};\n` +
    `console.log('SMOKE_IMPORT_OK', typeof pkg === 'object');\n` +
    `export default pkg;`;

  await bundleAndCheck({
    entryCode: browserBundleEntryCode,
    label: 'Browser bundle smoke',
  });

  await bundleAndCheck({
    entryCode: `import { AzureTTSClient } from 'js-tts-wrapper';\nconsole.log(typeof AzureTTSClient);\n`,
    label: 'Root package browser smoke',
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false,
        exportConditions: ['browser'],
      }),
      commonjs(),
      json(),
    ],
  });
}

main().catch((err) => {
  console.error('Bundle smoke failed:', err?.stack || err?.message || String(err));
  process.exit(1);
});
