#!/usr/bin/env node

/**
 * Helper script to run a Node.js script with the correct DYLD_LIBRARY_PATH for SherpaOnnx
 *
 * Usage: node scripts/run-with-sherpaonnx.cjs your-script.js [args...]
 */

const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

// Get the script to run
const scriptToRun = process.argv[2];

if (!scriptToRun) {
  console.error('Please provide a script to run');
  console.error('Usage: node scripts/run-with-sherpaonnx.cjs your-script.js [args...]');
  process.exit(1);
}

// Determine platform-specific library paths and environment variables
let libPathEnvVar = '';
let possiblePaths = [];
let pathSeparator = process.platform === 'win32' ? ';' : ':';

if (process.platform === 'darwin') {
  // macOS uses DYLD_LIBRARY_PATH
  libPathEnvVar = 'DYLD_LIBRARY_PATH';
  possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'sherpa-onnx-darwin-arm64'),
    path.join(process.cwd(), 'node_modules', 'sherpa-onnx-darwin-x64'),
    path.join(__dirname, '..', 'node_modules', 'sherpa-onnx-darwin-arm64'),
    path.join(__dirname, '..', 'node_modules', 'sherpa-onnx-darwin-x64')
  ];
} else if (process.platform === 'linux') {
  // Linux uses LD_LIBRARY_PATH
  libPathEnvVar = 'LD_LIBRARY_PATH';
  possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'sherpa-onnx-linux-arm64'),
    path.join(process.cwd(), 'node_modules', 'sherpa-onnx-linux-x64'),
    path.join(__dirname, '..', 'node_modules', 'sherpa-onnx-linux-arm64'),
    path.join(__dirname, '..', 'node_modules', 'sherpa-onnx-linux-x64')
  ];
} else if (process.platform === 'win32') {
  // Windows uses PATH
  libPathEnvVar = 'PATH';
  possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'sherpa-onnx-win-x64'),
    path.join(__dirname, '..', 'node_modules', 'sherpa-onnx-win-x64')
  ];
}

// Find the sherpa-onnx library directory
if (libPathEnvVar) {
  let sherpaOnnxPath = '';
  for (const libPath of possiblePaths) {
    if (fs.existsSync(libPath)) {
      console.log(`Found sherpa-onnx library at ${libPath}`);
      sherpaOnnxPath = libPath;
      break;
    }
  }

  if (sherpaOnnxPath) {
    // Set the environment variable
    const currentPath = process.env[libPathEnvVar] || '';
    if (!currentPath.includes(sherpaOnnxPath)) {
      process.env[libPathEnvVar] = sherpaOnnxPath + (currentPath ? pathSeparator + currentPath : '');
      console.log(`Set ${libPathEnvVar} to ${process.env[libPathEnvVar]}`);
    }
  } else {
    console.warn(`Could not find sherpa-onnx library directory for ${process.platform}. SherpaOnnx TTS may not work correctly.`);
  }
}

// Run the script
const args = process.argv.slice(3);

console.log(`\nRunning script: ${scriptToRun} ${args.join(' ')}\n`);
console.log('If you encounter issues with SherpaOnnx TTS, try installing the dependencies:');
console.log('npm run install:sherpaonnx');
console.log('');

const nodeProcess = spawn('node', [scriptToRun, ...args], {
  stdio: 'inherit',
  env: process.env
});

nodeProcess.on('close', (code) => {
  if (code !== 0) {
    console.log('\nScript exited with an error. If the error is related to SherpaOnnx, check that:');
    console.log('1. You have installed the sherpa-onnx-node package: npm run install:sherpaonnx');
    console.log('2. The model files are downloaded correctly');
    console.log('3. You are using this helper script to run your application');
  }
  process.exit(code);
});
