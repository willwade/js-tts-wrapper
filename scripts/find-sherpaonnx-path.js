#!/usr/bin/env node

/**
 * Find the sherpa-onnx library path for the current platform
 * 
 * This script helps users find the correct path to the sherpa-onnx library
 * for their platform, which is needed to set the environment variables.
 */

const path = require('node:path');
const fs = require('node:fs');

// Determine platform-specific library paths
let possiblePaths = [];
let envVarName = '';

if (process.platform === 'darwin') {
  // macOS
  envVarName = 'DYLD_LIBRARY_PATH';
  possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'sherpa-onnx-darwin-arm64'),
    path.join(process.cwd(), 'node_modules', 'sherpa-onnx-darwin-x64')
  ];
} else if (process.platform === 'linux') {
  // Linux
  envVarName = 'LD_LIBRARY_PATH';
  possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'sherpa-onnx-linux-arm64'),
    path.join(process.cwd(), 'node_modules', 'sherpa-onnx-linux-x64')
  ];
} else if (process.platform === 'win32') {
  // Windows
  envVarName = 'PATH';
  possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'sherpa-onnx-win-x64')
  ];
}

// Find the first existing path
let foundPath = null;
for (const libPath of possiblePaths) {
  if (fs.existsSync(libPath)) {
    foundPath = libPath;
    break;
  }
}

// Print the results
console.log(`Platform: ${process.platform}`);
console.log(`Architecture: ${process.arch}`);
console.log(`Environment variable: ${envVarName}`);

if (foundPath) {
  console.log(`\nFound sherpa-onnx library at: ${foundPath}`);
  console.log(`\nTo use SherpaOnnx TTS, run your script with:`);
  
  if (process.platform === 'win32') {
    console.log(`$env:${envVarName} = "${foundPath};$env:${envVarName}"`);
  } else {
    console.log(`${envVarName}=${foundPath} node your-script.js`);
  }
  
  console.log(`\nOr add to your shell profile:`);
  
  if (process.platform === 'darwin') {
    console.log(`echo 'export ${envVarName}=${foundPath}:$${envVarName}' >> ~/.zshrc`);
  } else if (process.platform === 'linux') {
    console.log(`echo 'export ${envVarName}=${foundPath}:$${envVarName}' >> ~/.bashrc`);
  } else if (process.platform === 'win32') {
    console.log(`[Environment]::SetEnvironmentVariable("${envVarName}", "${foundPath};$env:${envVarName}", "User")`);
  }
} else {
  console.log('\nCould not find sherpa-onnx library directory.');
  console.log('Make sure you have installed the sherpa-onnx-node package:');
  console.log('npm install sherpa-onnx-node');
  
  console.log('\nPaths checked:');
  for (const libPath of possiblePaths) {
    console.log(`- ${libPath}`);
  }
}
