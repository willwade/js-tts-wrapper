#!/usr/bin/env node

/**
 * SherpaOnnx Environment Setup Script
 * 
 * This script sets up the necessary environment variables for SherpaOnnx
 * before the main Node.js process starts. It can be used as a preload script
 * or called directly to set up the environment.
 */

const fs = require('node:fs');
const path = require('node:path');

// Platform-specific package mapping
const PLATFORM_PACKAGES = {
  'darwin-arm64': 'sherpa-onnx-darwin-arm64',
  'darwin-x64': 'sherpa-onnx-darwin-x64',
  'linux-arm64': 'sherpa-onnx-linux-arm64',
  'linux-x64': 'sherpa-onnx-linux-x64',
  'win32-x64': 'sherpa-onnx-win-x64',
};

/**
 * Get the current platform key
 */
function getCurrentPlatformKey() {
  return `${process.platform}-${process.arch}`;
}

/**
 * Get the expected platform package name
 */
function getExpectedPlatformPackage() {
  const platformKey = getCurrentPlatformKey();
  return PLATFORM_PACKAGES[platformKey] || null;
}

/**
 * Find the sherpa-onnx platform-specific library directory
 */
function findSherpaOnnxLibraryPath() {
  const expectedPackage = getExpectedPlatformPackage();
  if (!expectedPackage) {
    return null;
  }

  // Check multiple possible locations
  const possiblePaths = [
    // Current working directory
    path.join(process.cwd(), 'node_modules', expectedPackage),
    // Parent directory (for development)
    path.join(process.cwd(), '..', 'node_modules', expectedPackage),
    // Global node_modules
    path.join(process.cwd(), '..', '..', 'node_modules', expectedPackage),
  ];

  // Also check for other platform packages as fallback
  const allPlatformPackages = Object.values(PLATFORM_PACKAGES);
  for (const pkg of allPlatformPackages) {
    if (pkg !== expectedPackage) {
      possiblePaths.push(path.join(process.cwd(), 'node_modules', pkg));
    }
  }

  // Find the first existing path
  for (const libPath of possiblePaths) {
    if (fs.existsSync(libPath)) {
      return libPath;
    }
  }

  return null;
}

/**
 * Set up environment variables for the current platform
 */
function setupEnvironmentVariables() {
  const libraryPath = findSherpaOnnxLibraryPath();
  
  if (!libraryPath) {
    console.warn(`SherpaOnnx: Could not find platform library for ${getCurrentPlatformKey()}`);
    return false;
  }

  let envVarName = '';
  
  if (process.platform === 'darwin') {
    envVarName = 'DYLD_LIBRARY_PATH';
  } else if (process.platform === 'linux') {
    envVarName = 'LD_LIBRARY_PATH';
  } else if (process.platform === 'win32') {
    envVarName = 'PATH';
  } else {
    console.warn(`SherpaOnnx: Unsupported platform for environment setup: ${process.platform}`);
    return false;
  }

  const currentValue = process.env[envVarName] || '';
  const separator = process.platform === 'win32' ? ';' : ':';

  // Only add the path if it's not already in the environment variable
  if (!currentValue.includes(libraryPath)) {
    process.env[envVarName] = libraryPath + (currentValue ? separator + currentValue : '');
    console.log(`SherpaOnnx: Set ${envVarName} to include: ${libraryPath}`);
    return true;
  }
  
  console.log(`SherpaOnnx: ${envVarName} already includes: ${libraryPath}`);
  return true;
}

/**
 * Check if SherpaOnnx can run in the current environment
 */
function checkEnvironment() {
  const platformKey = getCurrentPlatformKey();
  const expectedPackage = getExpectedPlatformPackage();
  const libraryPath = findSherpaOnnxLibraryPath();
  
  const result = {
    platform: platformKey,
    expectedPackage,
    libraryPath,
    canRun: false,
    issues: [],
  };

  if (!expectedPackage) {
    result.issues.push(`Unsupported platform: ${platformKey}`);
    return result;
  }

  if (!libraryPath) {
    result.issues.push(`Platform package ${expectedPackage} not found`);
    return result;
  }

  // Check if the native module exists
  const nativeModulePath = path.join(libraryPath, 'sherpa-onnx.node');
  if (!fs.existsSync(nativeModulePath)) {
    result.issues.push(`Native module not found at ${nativeModulePath}`);
    return result;
  }

  // Check if main package exists
  const mainPackagePath = path.join(process.cwd(), 'node_modules', 'sherpa-onnx-node');
  if (!fs.existsSync(mainPackagePath)) {
    result.issues.push('Main package sherpa-onnx-node not found');
    return result;
  }

  result.canRun = true;
  return result;
}

/**
 * Print environment status
 */
function printEnvironmentStatus() {
  const envCheck = checkEnvironment();
  
  console.log('SherpaOnnx Environment Status:');
  console.log('============================');
  console.log(`Platform: ${envCheck.platform}`);
  console.log(`Expected package: ${envCheck.expectedPackage || 'Not supported'}`);
  console.log(`Library path: ${envCheck.libraryPath || 'Not found'}`);
  console.log(`Can run: ${envCheck.canRun ? '✅ Yes' : '❌ No'}`);
  
  if (envCheck.issues.length > 0) {
    console.log('Issues:');
    for (const issue of envCheck.issues) {
      console.log(`  - ${issue}`);
    }
    
    console.log('\nTo fix these issues:');
    console.log('1. Run: node scripts/install-sherpaonnx-platform.cjs');
    console.log('2. Or manually install: npm install sherpa-onnx-node ' + (envCheck.expectedPackage || 'sherpa-onnx-<platform>'));
  }
}

// Auto-setup when required as a module
if (require.main !== module) {
  // This is being required as a module, set up environment automatically
  setupEnvironmentVariables();
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'setup':
      console.log('Setting up SherpaOnnx environment...');
      if (setupEnvironmentVariables()) {
        console.log('✅ Environment setup completed');
      } else {
        console.log('❌ Environment setup failed');
        process.exit(1);
      }
      break;
      
    case 'check':
      printEnvironmentStatus();
      break;
      
    case 'run':
      // Set up environment and run a script
      const scriptToRun = process.argv[3];
      if (!scriptToRun) {
        console.error('Usage: node scripts/sherpaonnx-env-setup.cjs run <script> [args...]');
        process.exit(1);
      }
      
      setupEnvironmentVariables();
      
      const { spawn } = require('node:child_process');
      const args = process.argv.slice(4);
      
      const childProcess = spawn('node', [scriptToRun, ...args], {
        stdio: 'inherit',
        env: process.env,
      });
      
      childProcess.on('close', (code) => {
        process.exit(code);
      });
      break;
      
    default:
      console.log('SherpaOnnx Environment Setup');
      console.log('Usage:');
      console.log('  node scripts/sherpaonnx-env-setup.cjs setup   - Set up environment variables');
      console.log('  node scripts/sherpaonnx-env-setup.cjs check   - Check environment status');
      console.log('  node scripts/sherpaonnx-env-setup.cjs run <script> [args...] - Run script with environment');
      console.log('');
      console.log('Or use as a preload module:');
      console.log('  node --require ./scripts/sherpaonnx-env-setup.cjs your-script.js');
      break;
  }
}

module.exports = {
  getCurrentPlatformKey,
  getExpectedPlatformPackage,
  findSherpaOnnxLibraryPath,
  setupEnvironmentVariables,
  checkEnvironment,
  printEnvironmentStatus,
  PLATFORM_PACKAGES,
};
