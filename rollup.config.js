const typescript = require("@rollup/plugin-typescript");
const resolve = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const json = require("@rollup/plugin-json");
const pkg = require("./package.json");

const pathPolyfill = () => {
  const VIRTUAL_ID = "\0polyfill-path";
  return {
    name: "path-polyfill",
    resolveId(source) {
      if (source === "path") {
        return VIRTUAL_ID;
      }
      return null;
    },
    load(id) {
      if (id === VIRTUAL_ID) {
        return `
const sep = '/';
const slashRegex = new RegExp('/{2,}', 'g');

const normalize = (input = '') => {
  if (!input) return '';
  return input.replace(slashRegex, '/');
};

const trimTrailing = (input = '') => {
  if (!input) return '';
  let result = input;
  while (result.length > 1 && result.endsWith('/')) {
    result = result.slice(0, -1);
  }
  return result;
};

const join = (...segments) => {
  const cleaned = [];
  for (const segment of segments) {
    if (segment !== undefined && segment !== null && segment !== '') {
      cleaned.push(String(segment));
    }
  }
  if (cleaned.length === 0) {
    return '.';
  }
  return normalize(cleaned.join('/')) || '.';
};

const dirname = (input = '') => {
  const normalized = trimTrailing(normalize(input)) || '';
  if (!normalized) return '.';
  if (normalized === '/') return '/';
  const idx = normalized.lastIndexOf('/');
  if (idx === -1) return '.';
  if (idx === 0) return '/';
  return normalized.slice(0, idx);
};

const basename = (input = '') => {
  const normalized = trimTrailing(normalize(input));
  if (!normalized) return '';
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? normalized : normalized.slice(idx + 1);
};

const extname = (input = '') => {
  const base = basename(input);
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  return base.slice(idx);
};

const resolve = (...segments) => {
  let resolved = '';
  for (const segment of segments) {
    if (!segment) continue;
    const value = String(segment);
    if (value.startsWith('/')) {
      resolved = value;
    } else if (resolved) {
      resolved = trimTrailing(resolved) + '/' + value;
    } else {
      resolved = value;
    }
  }
  if (!resolved) return '.';
  const normalized = normalize(resolved) || '.';
  if (normalized === '/') return '/';
  return normalized;
};

export { sep, normalize, join, dirname, basename, extname, resolve };
export default { sep, normalize, join, dirname, basename, extname, resolve };
`;
      }
      return null;
    }
  };
};

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
      }
    ],
    plugins: [
      typescript({
        // Use inline compiler options to avoid outDir conflicts
        tsconfig: false,
        declaration: false,
        target: "ES2018",
        downlevelIteration: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        // Only transpile our sources; do not transpile node_modules TS
        include: ['src/**/*.ts'],
        exclude: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.spec.ts', '**/*.test.ts', '**/*.spec.ts', 'test/**']
      }),
      resolve(),
      commonjs(),
      json()
    ],
    // External dependencies (optional/native or environment-specific) that should not be bundled
    external: [
      // Native sherpa packages (optional at runtime; load lazily only when used)
      "sherpa-onnx-node",
      "sherpa-onnx-win-x64",
      "sherpa-onnx-linux-x64",
      "sherpa-onnx-linux-arm64",
      "sherpa-onnx-darwin-x64",
      "sherpa-onnx-darwin-arm64",
      // Optional Node-only eSpeak backend
      "text2wav",
      // Browser-only utilities that must not be bundled into Node entry
      // (avoid AMD/UMD shims causing import-time errors in CJS builds)
      "compressjs",
      "js-untar",
      // Node built-ins
      "node:module",
      "node:path",
      "node:fs",
      "node:os",
      "node:child_process",
      "path",
      "fs",
      "os",
      "module",
      "child_process",
      "constants",
      "stream",
      "util",
      "assert",
      "events",
      "buffer",
      "string_decoder",
      "zlib"
    ]
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
        file: "dist/js-tts-wrapper.browser.umd.js",
        format: "umd",
        name: "JSTTSWrapper",
        sourcemap: true,
        inlineDynamicImports: true,
        globals: {
          "speechmarkdown-js": "SpeechMarkdown",
          path: "path"
        }
      }
    ],
    plugins: [
      pathPolyfill(),
      typescript({
        // Use inline compiler options to avoid outDir conflicts
        tsconfig: false,
        declaration: false,
        target: "ES2018",
        downlevelIteration: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        // Only transpile our sources; do not transpile node_modules TS
        include: ['src/**/*.ts'],
        exclude: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.spec.ts', '**/*.test.ts', '**/*.spec.ts', 'test/**']
      }),
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      json()
    ],
    // External dependencies that should not be bundled
    external: []
  }
];
