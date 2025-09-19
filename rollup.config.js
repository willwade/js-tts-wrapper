const typescript = require("@rollup/plugin-typescript");
const resolve = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const terser = require("@rollup/plugin-terser");
const json = require("@rollup/plugin-json");
const pkg = require("./package.json");

module.exports = [
  // Node.js build
  {
    input: "src/index.ts",
    output: [
      {
        file: pkg.main,
        format: "cjs",
        sourcemap: true,
        inlineDynamicImports: true
      },
      {
        file: pkg.module || "dist/index.esm.js",
        format: "esm",
        sourcemap: true,
        inlineDynamicImports: true
      },
      {
        file: "dist/index.umd.js",
        format: "umd",
        name: "TTSWrapper",
        sourcemap: true,
        inlineDynamicImports: true
      },
    ],
    plugins: [
      typescript({
        // Use inline compiler options to avoid outDir conflicts
        tsconfig: false,
        declaration: false,
        // Only transpile our sources; do not transpile node_modules TS
        include: ['src/**/*.ts']
      }),
      resolve(),
      commonjs(),
      json()
    ],
    // External dependencies that should not be bundled
    external: []
  },
  // Browser build
  {
    input: "src/browser.ts",
    output: [
      {
        file: "dist/js-tts-wrapper.browser.js",
        format: "esm",
        sourcemap: true,
        inlineDynamicImports: true
      },
      {
        file: "dist/js-tts-wrapper.browser.min.js",
        format: "esm",
        sourcemap: true,
        inlineDynamicImports: true,
        plugins: [terser()]
      },
      {
        file: "dist/js-tts-wrapper.browser.umd.js",
        format: "umd",
        name: "JSTTSWrapper",
        sourcemap: true,
        inlineDynamicImports: true,
        globals: {
          "speechmarkdown-js": "SpeechMarkdown"
        }
      },
      {
        file: "dist/js-tts-wrapper.browser.umd.min.js",
        format: "umd",
        name: "JSTTSWrapper",
        sourcemap: true,
        inlineDynamicImports: true,
        globals: {
          "speechmarkdown-js": "SpeechMarkdown"
        },
        plugins: [terser()]
      }
    ],
    plugins: [
      typescript({
        // Use inline compiler options to avoid outDir conflicts
        tsconfig: false,
        declaration: false,
        // Only transpile our sources; do not transpile node_modules TS
        include: ['src/**/*.ts']
      }),
      resolve({
        browser: true
      }),
      commonjs(),
      json()
    ],
    // External dependencies that should not be bundled
    external: []
  }
];
