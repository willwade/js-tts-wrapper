#!/usr/bin/env node

/**
 * Cleanup script for examples directory
 * This script identifies and optionally removes duplicate/redundant test files
 * that can be replaced by the unified test runner.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const examplesDir = path.resolve(__dirname, '..', 'examples');

// Files that can be safely removed (replaced by unified test runner)
const REDUNDANT_FILES = [
  'test-audio-playback.cjs',
  'test-audio-playback.js',
  'test-direct-audio.js',
  'test-elevenlabs.js',
  'test-espeak.js',
  'test-mock.js',
  'test-node-audio-esm.js',
  'test-node-audio-playback.js',
  'test-node-audio-util.js',
  'test-node-audio.cjs',
  'test-node-audio.js',
  'test-playback-control-engines.cjs',
  'test-playback-control-engines.js',
  'test-playback-control.cjs',
  'test-playback-control.js',
  'test-sherpaonnx-download.js',
  'test-sherpaonnx-fixed.cjs',
  'test-sherpaonnx.js',
  'test-sound-play.js',
  'test-tts-factory.js'
];

// Files to keep (have unique functionality)
const KEEP_FILES = [
  'test-engines.js',           // Main comprehensive test (will be updated)
  'test-engines.cjs',          // CommonJS version (will be updated)
  'test-sherpaonnx-features.js', // Detailed SherpaOnnx analysis
  'browser-test.html',         // Browser testing
  'check-credentials.js',      // Credential checking utility
  'cli-highlight-all-engines.mjs', // CLI highlighting
  'debug-sherpaonnx.cjs',      // Debug utility
  'playht-stream-test.mjs',    // Specific streaming test
  'tts-example.js',           // Basic example
  'README.md'                 // Documentation
];

/**
 * Analyze files in examples directory
 */
function analyzeFiles() {
  console.log('Analyzing examples directory...\n');
  
  const files = fs.readdirSync(examplesDir).filter(file => 
    fs.statSync(path.join(examplesDir, file)).isFile()
  );
  
  console.log('Files found:');
  files.forEach(file => {
    const status = REDUNDANT_FILES.includes(file) ? '🗑️  REDUNDANT' : 
                   KEEP_FILES.includes(file) ? '✅ KEEP' : 
                   '❓ UNKNOWN';
    console.log(`  ${file.padEnd(35)} ${status}`);
  });
  
  console.log(`\nSummary:`);
  console.log(`  Total files: ${files.length}`);
  console.log(`  Redundant files: ${REDUNDANT_FILES.filter(f => files.includes(f)).length}`);
  console.log(`  Files to keep: ${KEEP_FILES.filter(f => files.includes(f)).length}`);
  console.log(`  Unknown files: ${files.filter(f => !REDUNDANT_FILES.includes(f) && !KEEP_FILES.includes(f)).length}`);
  
  return files;
}

/**
 * Remove redundant files
 */
function removeRedundantFiles(dryRun = true) {
  console.log(`\n${dryRun ? 'DRY RUN: Would remove' : 'Removing'} redundant files...\n`);
  
  const removedFiles = [];
  
  REDUNDANT_FILES.forEach(file => {
    const filePath = path.join(examplesDir, file);
    if (fs.existsSync(filePath)) {
      console.log(`${dryRun ? 'Would remove' : 'Removing'}: ${file}`);
      if (!dryRun) {
        fs.unlinkSync(filePath);
      }
      removedFiles.push(file);
    }
  });
  
  console.log(`\n${dryRun ? 'Would remove' : 'Removed'} ${removedFiles.length} files.`);
  return removedFiles;
}

/**
 * Create migration guide
 */
function createMigrationGuide() {
  const guide = `# Examples Directory Migration Guide

This guide explains how the examples directory has been reorganized to reduce duplication.

## Removed Files and Their Replacements

The following files have been removed and replaced by the unified test runner:

${REDUNDANT_FILES.map(file => `- \`${file}\` → Use \`unified-test-runner.js\` with appropriate mode`).join('\n')}

## New Unified Test Runner

The new \`unified-test-runner.js\` replaces most individual test files:

### Basic Usage
\`\`\`bash
# Test all engines (basic mode)
node examples/unified-test-runner.js

# Test specific engine
node examples/unified-test-runner.js azure

# Test with different modes
node examples/unified-test-runner.js --mode=playback
node examples/unified-test-runner.js --mode=features
PLAY_AUDIO=true node examples/unified-test-runner.js --mode=audio
\`\`\`

### Migration Examples

| Old Command | New Command |
|-------------|-------------|
| \`node examples/test-mock.js\` | \`node examples/unified-test-runner.js mock\` |
| \`node examples/test-elevenlabs.js\` | \`node examples/unified-test-runner.js elevenlabs\` |
| \`node examples/test-playback-control.js\` | \`node examples/unified-test-runner.js --mode=playback\` |
| \`node examples/test-node-audio.js\` | \`node examples/unified-test-runner.js --mode=audio\` |

## Shared Modules

New shared modules provide common functionality:

- \`shared/engine-configs.js\` - Centralized engine configuration
- \`shared/test-utils.js\` - Common test utilities

## Remaining Files

These files are kept for specific functionality:

${KEEP_FILES.map(file => `- \`${file}\` - ${getFileDescription(file)}`).join('\n')}
`;

  const guidePath = path.join(examplesDir, 'MIGRATION.md');
  fs.writeFileSync(guidePath, guide);
  console.log(`\nCreated migration guide: ${guidePath}`);
}

/**
 * Get description for a file
 */
function getFileDescription(file) {
  const descriptions = {
    'test-engines.js': 'Main comprehensive test suite (ESM)',
    'test-engines.cjs': 'Main comprehensive test suite (CommonJS)',
    'test-sherpaonnx-features.js': 'Detailed SherpaOnnx feature analysis',
    'browser-test.html': 'Browser-based testing interface',
    'check-credentials.js': 'Credential validation utility',
    'cli-highlight-all-engines.mjs': 'CLI highlighting demonstration',
    'debug-sherpaonnx.cjs': 'SherpaOnnx debugging utility',
    'playht-stream-test.mjs': 'PlayHT streaming test',
    'tts-example.js': 'Basic usage example',
    'README.md': 'Documentation'
  };
  return descriptions[file] || 'Specific functionality';
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  
  console.log('Examples Directory Cleanup Tool');
  console.log('================================\n');
  
  if (dryRun) {
    console.log('Running in DRY RUN mode. Use --execute to actually remove files.\n');
  }
  
  // Analyze current state
  analyzeFiles();
  
  // Show what would be removed
  removeRedundantFiles(dryRun);
  
  // Create migration guide
  if (!dryRun) {
    createMigrationGuide();
  }
  
  console.log('\nNext steps:');
  console.log('1. Review the analysis above');
  console.log('2. Run with --execute to actually remove redundant files');
  console.log('3. Update any scripts that reference the removed files');
  console.log('4. Test the unified test runner');
  console.log('5. Update documentation');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { analyzeFiles, removeRedundantFiles, createMigrationGuide };
