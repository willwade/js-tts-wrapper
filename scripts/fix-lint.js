#!/usr/bin/env node

/**
 * Script to fix linting issues
 */

const { execSync } = require('node:child_process');

console.log('Fixing linting issues...');

try {
  // Run Biome with --write flag to fix issues
  execSync('npx biome lint --write ./src', { stdio: 'inherit' });
  console.log('Linting issues fixed!');

  // Also run formatter
  execSync('npx biome format --write ./src', { stdio: 'inherit' });
  console.log('Formatting applied!');
} catch (error) {
  console.error('Error fixing linting issues:', error.message);
  process.exit(1);
}
