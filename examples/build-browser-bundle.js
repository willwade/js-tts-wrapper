const { rollup } = require('rollup');
const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const terser = require('@rollup/plugin-terser');

async function build() {
  console.log('Building browser bundle for examples...');
  
  // Create a bundle
  const bundle = await rollup({
    input: '../dist/js-tts-wrapper.browser.js',
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      json()
    ]
  });

  // Generate output
  await bundle.write({
    file: 'js-tts-wrapper.browser.bundle.js',
    format: 'esm',
    sourcemap: true
  });

  // Generate minified output
  await bundle.write({
    file: 'js-tts-wrapper.browser.bundle.min.js',
    format: 'esm',
    sourcemap: true,
    plugins: [terser()]
  });

  // Generate UMD output
  await bundle.write({
    file: 'js-tts-wrapper.browser.bundle.umd.js',
    format: 'umd',
    name: 'JSTTSWrapper',
    sourcemap: true
  });

  // Generate minified UMD output
  await bundle.write({
    file: 'js-tts-wrapper.browser.bundle.umd.min.js',
    format: 'umd',
    name: 'JSTTSWrapper',
    sourcemap: true,
    plugins: [terser()]
  });

  // Close the bundle
  await bundle.close();

  console.log('Browser bundle built successfully!');
}

build().catch(err => {
  console.error('Error building browser bundle:', err);
  process.exit(1);
});
