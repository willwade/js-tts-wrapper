/**
 * SherpaOnnx Preload Script
 * 
 * This script sets the necessary environment variables for SherpaOnnx
 * when used with the Node.js --require flag.
 * 
 * Usage: node --require ./scripts/sherpaonnx-preload.cjs your-script.js
 */

const fs = require('node:fs');
const path = require('node:path');

// Determine platform-specific library paths and environment variables
let libPathEnvVar = '';
let possiblePaths = [];
let pathSeparator = process.platform === 'win32' ? ';' : ':';

if (process.platform === 'darwin') {
  // macOS uses DYLD_LIBRARY_PATH
  libPathEnvVar = 'DYLD_LIBRARY_PATH';
  possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'sherpa-onnx-darwin-arm64'),
    path.join(process.cwd(), 'node_modules', 'sherpa-onnx-darwin-x64')
  ];
} else if (process.platform === 'linux') {
  // Linux uses LD_LIBRARY_PATH
  libPathEnvVar = 'LD_LIBRARY_PATH';
  possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'sherpa-onnx-linux-arm64'),
    path.join(process.cwd(), 'node_modules', 'sherpa-onnx-linux-x64')
  ];
} else if (process.platform === 'win32') {
  // Windows uses PATH
  libPathEnvVar = 'PATH';
  possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'sherpa-onnx-win-x64')
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
