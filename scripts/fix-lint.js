#!/usr/bin/env node

/**
 * Script to fix linting issues
 */

const { execSync } = require('node:child_process');

console.log('Fixing linting issues...');

try {
  // Run Biome check which combines lint and format with --write flag
  execSync('npx biome check --write ./src/utils ./src/ssml ./src/markdown', { stdio: 'inherit' });
  console.log('Linting and formatting issues fixed!');
} catch (error) {
  console.error('Error fixing linting issues:', error.message);
  process.exit(1);
}
