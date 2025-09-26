import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { minify } from 'terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = join(__dirname, '..', 'dist');

const targets = [
  {
    input: 'js-tts-wrapper.browser.js',
    output: 'js-tts-wrapper.browser.min.js',
    format: 'esm'
  },
  {
    input: 'js-tts-wrapper.browser.umd.js',
    output: 'js-tts-wrapper.browser.umd.min.js',
    format: 'umd'
  }
];

async function minifyFile({ input, output, format }) {
  const sourcePath = join(distDir, input);
  const outputPath = join(distDir, output);
  const mapPath = `${outputPath}.map`;

  const code = await readFile(sourcePath, 'utf8');
  const { code: minified, map } = await minify(code, {
    module: format === 'esm',
    toplevel: format !== 'esm',
    sourceMap: {
      filename: output,
      url: `${output}.map`
    }
  });

  if (!minified) {
    throw new Error(`Terser returned empty output for ${input}`);
  }

  await writeFile(outputPath, `${minified}\n//# sourceMappingURL=${output}.map\n`, 'utf8');
  if (map) {
    await writeFile(mapPath, map, 'utf8');
  }
}

async function run() {
  for (const target of targets) {
    await minifyFile(target);
  }
}

run().catch(error => {
  console.error('Minification failed:', error);
  process.exitCode = 1;
});
