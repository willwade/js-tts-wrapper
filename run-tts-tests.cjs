#!/usr/bin/env node

/**
 * TTS Engine Test Runner
 * 
 * This script runs Jest tests for specific TTS engines.
 * Usage: node run-tts-tests.cjs [engine-name]
 * 
 * Examples:
 *   node run-tts-tests.cjs azure
 *   node run-tts-tests.cjs google
 *   node run-tts-tests.cjs sherpaonnx
 */

const { spawn } = require('child_process');
const path = require('path');

// Get the engine name from command line arguments
const engineName = process.argv[2];

if (!engineName) {
  console.error('Usage: node run-tts-tests.cjs <engine-name>');
  console.error('Available engines: azure, google, polly, openai, elevenlabs, playht, upliftai, sherpaonnx, sherpaonnx-wasm, sapi, espeak, system');
  process.exit(1);
}

// Map engine names to test patterns
const engineTestPatterns = {
  'azure': 'azure',
  'google': 'google',
  'polly': 'polly',
  'openai': 'openai',
  'elevenlabs': 'elevenlabs',
  'playht': 'playht',
  'upliftai': 'upliftai',
  'sherpaonnx': 'sherpaonnx',
  'sherpaonnx-wasm': 'sherpaonnx-wasm',
  'sapi': 'sapi',
  'espeak': 'espeak',
  'system': 'system'
};

const testPattern = engineTestPatterns[engineName];

if (!testPattern) {
  console.error(`Unknown engine: ${engineName}`);
  console.error('Available engines:', Object.keys(engineTestPatterns).join(', '));
  process.exit(1);
}

console.log(`Running tests for ${engineName} engine...`);

// Set up environment variables for Jest
const env = {
  ...process.env,
  NODE_OPTIONS: '--experimental-vm-modules'
};

// Run Jest with the specific test pattern
const jestArgs = [
  '--testNamePattern', testPattern,
  '--verbose'
];

const jestProcess = spawn('npx', ['jest', ...jestArgs], {
  stdio: 'inherit',
  env: env,
  shell: true
});

jestProcess.on('close', (code) => {
  console.log(`\nTest process exited with code ${code}`);
  process.exit(code);
});

jestProcess.on('error', (error) => {
  console.error('Failed to start test process:', error);
  process.exit(1);
});
