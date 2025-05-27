#!/usr/bin/env node

/**
 * Automatic platform package installer for SherpaOnnx
 * 
 * This script automatically detects the current platform and installs
 * the appropriate platform-specific package for SherpaOnnx TTS.
 */

const { spawn } = require('node:child_process');
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
 * Check if a package is already installed
 */
function isPackageInstalled(packageName) {
  try {
    const packagePath = path.join(process.cwd(), 'node_modules', packageName);
    return fs.existsSync(packagePath);
  } catch {
    return false;
  }
}

/**
 * Install a package using npm
 */
function installPackage(packageName) {
  return new Promise((resolve, reject) => {
    console.log(`Installing ${packageName}...`);
    
    const npmProcess = spawn('npm', ['install', packageName], {
      stdio: 'inherit',
      shell: true,
    });

    npmProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Successfully installed ${packageName}`);
        resolve();
      } else {
        reject(new Error(`Failed to install ${packageName} (exit code: ${code})`));
      }
    });

    npmProcess.on('error', (error) => {
      reject(new Error(`Failed to spawn npm process: ${error.message}`));
    });
  });
}

/**
 * Main installation function
 */
async function main() {
  console.log('🔍 SherpaOnnx Platform Package Installer');
  console.log('========================================');
  
  const platformKey = getCurrentPlatformKey();
  const expectedPackage = getExpectedPlatformPackage();
  
  console.log(`Platform: ${platformKey}`);
  console.log(`Expected package: ${expectedPackage || 'Not supported'}`);
  
  if (!expectedPackage) {
    console.error(`❌ Unsupported platform: ${platformKey}`);
    console.error('Supported platforms:');
    for (const [platform, pkg] of Object.entries(PLATFORM_PACKAGES)) {
      console.error(`  - ${platform}: ${pkg}`);
    }
    process.exit(1);
  }

  // Check if main package is installed
  if (!isPackageInstalled('sherpa-onnx-node')) {
    console.log('📦 Installing main sherpa-onnx-node package...');
    try {
      await installPackage('sherpa-onnx-node@^1.12.0');
    } catch (error) {
      console.error(`❌ Failed to install sherpa-onnx-node: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log('✅ sherpa-onnx-node is already installed');
  }

  // Check if platform package is installed
  if (!isPackageInstalled(expectedPackage)) {
    console.log(`📦 Installing platform package ${expectedPackage}...`);
    try {
      await installPackage(expectedPackage);
    } catch (error) {
      console.error(`❌ Failed to install ${expectedPackage}: ${error.message}`);
      console.error('');
      console.error('💡 Troubleshooting tips:');
      console.error('1. Make sure you have internet connectivity');
      console.error('2. Try running with --verbose flag: npm install --verbose');
      console.error('3. Check if the package exists on npm registry');
      console.error('4. For cloud deployments, ensure the platform is correctly detected');
      process.exit(1);
    }
  } else {
    console.log(`✅ ${expectedPackage} is already installed`);
  }

  // Install additional dependencies
  const additionalDeps = [
    'decompress',
    'decompress-bzip2', 
    'decompress-tarbz2',
    'decompress-targz',
    'tar-stream'
  ];

  console.log('📦 Installing additional dependencies...');
  for (const dep of additionalDeps) {
    if (!isPackageInstalled(dep)) {
      try {
        await installPackage(dep);
      } catch (error) {
        console.warn(`⚠️  Failed to install ${dep}: ${error.message}`);
        console.warn('This may cause issues with model downloading');
      }
    } else {
      console.log(`✅ ${dep} is already installed`);
    }
  }

  console.log('');
  console.log('🎉 SherpaOnnx installation completed!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Test the installation: node examples/test-engines.js sherpaonnx');
  console.log('2. If you encounter issues, try: node scripts/run-with-sherpaonnx.cjs your-script.js');
  console.log('3. For cloud deployments, ensure environment variables are set correctly');
}

// Run the installer
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Installation failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  getCurrentPlatformKey,
  getExpectedPlatformPackage,
  isPackageInstalled,
  installPackage,
  PLATFORM_PACKAGES,
};
