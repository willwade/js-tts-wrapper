#!/usr/bin/env node

/**
 * Script to prepare the package for publishing
 */

const fs = require('fs');
const path = require('path');

// Paths
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const packageJsonPath = path.join(rootDir, 'package.json');

// Ensure the dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

// Read the package.json file
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

function rewriteDistPath(value) {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.startsWith('./dist/')) {
    return `./${value.slice('./dist/'.length)}`;
  }

  if (value.startsWith('dist/')) {
    return `./${value.slice('dist/'.length)}`;
  }

  return value;
}

function rewriteDistPathsDeep(value) {
  if (Array.isArray(value)) {
    return value.map(rewriteDistPathsDeep);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, rewriteDistPathsDeep(nestedValue)])
    );
  }

  return rewriteDistPath(value);
}

// Create a new package.json for the dist directory
const distPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  main: 'cjs/index.js',
  module: 'esm/index.js',
  browser: rewriteDistPath(packageJson.browser || 'dist/js-tts-wrapper.browser.js'),
  types: 'index.d.ts',
  author: packageJson.author,
  license: packageJson.license,
  repository: packageJson.repository,
  keywords: packageJson.keywords || ['tts', 'text-to-speech', 'azure', 'google', 'elevenlabs'],
  type: packageJson.type || 'module',
  exports: rewriteDistPathsDeep(packageJson.exports || {}),
  dependencies: {
    ...(packageJson.dependencies || {})
  },
  optionalDependencies: {
    ...(packageJson.optionalDependencies || {})
  },
  peerDependencies: {
    ...(packageJson.peerDependencies || {})
  },
  peerDependenciesMeta: {
    ...(packageJson.peerDependenciesMeta || {})
  },
  dependencyGroups: {
    ...(packageJson.dependencyGroups || {})
  },
  overrides: {
    ...(packageJson.overrides || {})
  },
  engines: {
    ...(packageJson.engines || { node: '>=14.0.0' })
  }
};

// Write the new package.json to the dist directory
fs.writeFileSync(
  path.join(distDir, 'package.json'),
  JSON.stringify(distPackageJson, null, 2)
);

// Copy README.md to the dist directory
try {
  fs.copyFileSync(
    path.join(rootDir, 'README.md'),
    path.join(distDir, 'README.md')
  );
  console.log('Copied README.md to dist directory');
} catch (error) {
  console.warn('Warning: Could not copy README.md', error);
}

// Copy LICENSE to the dist directory if it exists
try {
  if (fs.existsSync(path.join(rootDir, 'LICENSE'))) {
    fs.copyFileSync(
      path.join(rootDir, 'LICENSE'),
      path.join(distDir, 'LICENSE')
    );
    console.log('Copied LICENSE to dist directory');
  }
} catch (error) {
  console.warn('Warning: Could not copy LICENSE', error);
}

console.log('Package preparation complete!');
console.log('To publish the package, run:');
console.log('  cd dist');
console.log('  npm publish');
