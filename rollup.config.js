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
    plugins: [typescript({ tsconfig: "./tsconfig.json" }), resolve(), commonjs(), json()],
    // External dependencies that should not be bundled
    external: ["speechmarkdown-js"]
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
        tsconfig: "./tsconfig.browser.json",
        declaration: false
      }),
      resolve({
        browser: true
      }),
      commonjs(),
      json()
    ],
    // External dependencies that should not be bundled
    external: ["speechmarkdown-js"]
  }
];
