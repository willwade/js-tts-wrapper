const typescript = require("@rollup/plugin-typescript");
const resolve = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const pkg = require("./package.json");

module.exports = [
  {
    input: "src/index.ts",
    output: [
      { file: pkg.main, format: "cjs" },
      { file: pkg.module, format: "esm" },
      { file: "dist/index.umd.js", format: "umd", name: "TTSWrapper" },
    ],
    plugins: [typescript({ tsconfig: "./tsconfig.json" }), resolve(), commonjs()],
    // External dependencies that should not be bundled
    external: ["speechmarkdown-js"],
  },
];
