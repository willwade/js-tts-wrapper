/**
 * SherpaOnnx Native Module Loader
 *
 * This module handles loading the sherpa-onnx-node native module with the correct
 * environment variables set for the current platform.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Platform-specific package mapping
 */
const PLATFORM_PACKAGES = {
  "darwin-arm64": "sherpa-onnx-darwin-arm64",
  "darwin-x64": "sherpa-onnx-darwin-x64",
  "linux-arm64": "sherpa-onnx-linux-arm64",
  "linux-x64": "sherpa-onnx-linux-x64",
  "win32-x64": "sherpa-onnx-win-x64",
} as const;

/**
 * Get the current platform key
 * @returns Platform key for package mapping
 */
export function getCurrentPlatformKey(): string {
  return `${process.platform}-${process.arch}` as keyof typeof PLATFORM_PACKAGES;
}

/**
 * Get the expected platform package name
 * @returns Expected package name for current platform
 */
export function getExpectedPlatformPackage(): string | null {
  const platformKey = getCurrentPlatformKey();
  return PLATFORM_PACKAGES[platformKey as keyof typeof PLATFORM_PACKAGES] || null;
}

/**
 * Find the sherpa-onnx platform-specific library directory
 * @returns Path to the library directory or null if not found
 */
export function findSherpaOnnxLibraryPath(): string | null {
  // Get the expected package for current platform
  const expectedPackage = getExpectedPlatformPackage();
  if (!expectedPackage) {
    console.warn(`Unsupported platform: ${getCurrentPlatformKey()}`);
    return null;
  }

  // Check multiple possible locations
  const possiblePaths = [
    // Current working directory
    path.join(process.cwd(), "node_modules", expectedPackage),
    // Parent directory (for development)
    path.join(process.cwd(), "..", "node_modules", expectedPackage),
    // Global node_modules
    path.join(process.cwd(), "..", "..", "node_modules", expectedPackage),
  ];

  // Also check for other platform packages as fallback
  const allPlatformPackages = Object.values(PLATFORM_PACKAGES);
  for (const pkg of allPlatformPackages) {
    if (pkg !== expectedPackage) {
      possiblePaths.push(path.join(process.cwd(), "node_modules", pkg));
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
 * Check if we're running in ES module or CommonJS context
 * @returns True if ES modules, false if CommonJS
 */
export function isESModule(): boolean {
  try {
    // Check for ES module indicators
    // In CommonJS, 'require' is defined and 'module' exists
    // In ES modules, these are not available
    return typeof require === "undefined" && typeof module === "undefined";
  } catch {
    return false;
  }
}

/**
 * Set up environment variables for the current platform
 * @param libraryPath Path to the platform-specific library
 * @returns True if environment variables were set successfully
 */
export function setupEnvironmentVariables(libraryPath: string): boolean {
  try {
    let envVarName = "";

    if (process.platform === "darwin") {
      envVarName = "DYLD_LIBRARY_PATH";
    } else if (process.platform === "linux") {
      envVarName = "LD_LIBRARY_PATH";
    } else if (process.platform === "win32") {
      envVarName = "PATH";
    } else {
      console.warn(`Unsupported platform for environment setup: ${process.platform}`);
      return false;
    }

    const currentValue = process.env[envVarName] || "";
    const separator = process.platform === "win32" ? ";" : ":";

    // Only add the path if it's not already in the environment variable
    if (!currentValue.includes(libraryPath)) {
      process.env[envVarName] = libraryPath + (currentValue ? separator + currentValue : "");
      console.log(`Set ${envVarName} to include: ${libraryPath}`);
      return true;
    }

    console.log(`${envVarName} already includes: ${libraryPath}`);
    return true;
  } catch (error) {
    console.error("Error setting up environment variables:", error);
    return false;
  }
}

/**
 * Generate installation instructions for missing platform packages
 * @returns Installation instructions string
 */
export function getInstallationInstructions(): string {
  const expectedPackage = getExpectedPlatformPackage();
  const platformKey = getCurrentPlatformKey();

  return `
To use SherpaOnnx TTS on ${platformKey}, you need to:

1. Install the required packages:
   npm install sherpa-onnx-node@^1.12.0 ${expectedPackage || "sherpa-onnx-<platform>"} decompress decompress-bzip2 decompress-tarbz2 decompress-targz tar-stream

   OR use the convenience script:
   npx js-tts-wrapper install sherpaonnx

2. Ensure you're using Node.js 16+ (current version: ${process.version})

3. If you still have issues, try the helper script:
   node scripts/run-with-sherpaonnx.cjs your-script.js

4. For cloud deployments, ensure the platform-specific package is installed:
   ${expectedPackage || "sherpa-onnx-<platform>"}
`;
}

/**
 * Load the sherpa-onnx-node module with the correct environment variables
 * @returns The loaded sherpa-onnx-node module
 */
export async function loadSherpaOnnxNode(): Promise<any> {
  // Find the library path
  const libraryPath = findSherpaOnnxLibraryPath();

  if (!libraryPath) {
    const error = new Error(
      `Could not find sherpa-onnx library directory. ${getInstallationInstructions()}`
    );
    error.name = "SherpaOnnxLibraryNotFound";
    throw error;
  }

  // Set up environment variables
  if (!setupEnvironmentVariables(libraryPath)) {
    console.warn("Failed to set up environment variables, but continuing...");
  }

  // Verify the native module exists
  const nativeModulePath = path.join(libraryPath, "sherpa-onnx.node");
  if (!fs.existsSync(nativeModulePath)) {
    const error = new Error(
      `Native module not found at ${nativeModulePath}. ${getInstallationInstructions()}`
    );
    error.name = "SherpaOnnxNativeModuleNotFound";
    throw error;
  }

  // Try to load the module
  try {
    console.log(`Loading sherpa-onnx-node from: ${libraryPath}`);

    // Use appropriate loading mechanism based on module system
    if (isESModule()) {
      console.log("Using ES module import for sherpa-onnx-node");
      return await import("sherpa-onnx-node");
    }
    console.log("Using CommonJS require for sherpa-onnx-node");
    // Verify the module can be resolved
    const resolvedPath = require.resolve("sherpa-onnx-node");
    console.log(`Resolved sherpa-onnx-node path: ${resolvedPath}`);
    return require("sherpa-onnx-node");
  } catch (loadError: unknown) {
    const error = loadError as Error;
    console.error("Failed to load sherpa-onnx-node:", error.message);

    const wrappedError = new Error(
      `Could not load sherpa-onnx-node: ${error.message}. ${getInstallationInstructions()}`
    );
    wrappedError.name = "SherpaOnnxLoadError";
    // Add cause property for better error tracking (ES2022 feature, fallback for older targets)
    (wrappedError as any).cause = error;
    throw wrappedError;
  }
}

/**
 * Check if we can run SherpaOnnx in the current environment
 * @returns Object with detailed environment check results
 */
export function canRunSherpaOnnx(): {
  canRun: boolean;
  hasMainPackage: boolean;
  hasPlatformPackage: boolean;
  hasNativeModule: boolean;
  platformKey: string;
  expectedPackage: string | null;
  foundLibraryPath: string | null;
  issues: string[];
} {
  const result = {
    canRun: false,
    hasMainPackage: false,
    hasPlatformPackage: false,
    hasNativeModule: false,
    platformKey: getCurrentPlatformKey(),
    expectedPackage: getExpectedPlatformPackage(),
    foundLibraryPath: null as string | null,
    issues: [] as string[],
  };

  try {
    // Check if the sherpa-onnx-node package is installed
    const sherpaOnnxNodePath = path.join(process.cwd(), "node_modules", "sherpa-onnx-node");
    result.hasMainPackage = fs.existsSync(sherpaOnnxNodePath);

    if (!result.hasMainPackage) {
      result.issues.push("sherpa-onnx-node package not found");
    }

    // Check if the platform-specific library is installed
    result.foundLibraryPath = findSherpaOnnxLibraryPath();
    result.hasPlatformPackage = !!result.foundLibraryPath;

    if (!result.hasPlatformPackage) {
      result.issues.push(`Platform package ${result.expectedPackage} not found`);
    }

    // Check if the native module exists
    if (result.foundLibraryPath) {
      const nativeModulePath = path.join(result.foundLibraryPath, "sherpa-onnx.node");
      result.hasNativeModule = fs.existsSync(nativeModulePath);

      if (!result.hasNativeModule) {
        result.issues.push(`Native module not found at ${nativeModulePath}`);
      }
    }

    // Can run if all components are available
    result.canRun = result.hasMainPackage && result.hasPlatformPackage && result.hasNativeModule;

    return result;
  } catch (error: unknown) {
    result.issues.push(
      `Environment check failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return result;
  }
}

/**
 * Simple boolean check for backward compatibility
 * @returns True if SherpaOnnx can run in the current environment
 */
export function canRunSherpaOnnxSimple(): boolean {
  return canRunSherpaOnnx().canRun;
}

/**
 * Create a graceful fallback loader that doesn't throw errors
 * @returns Object with loaded module or null, plus error information
 */
export async function loadSherpaOnnxNodeSafe(): Promise<{
  module: any | null;
  success: boolean;
  error: Error | null;
  environmentCheck: ReturnType<typeof canRunSherpaOnnx>;
}> {
  const environmentCheck = canRunSherpaOnnx();

  if (!environmentCheck.canRun) {
    return {
      module: null,
      success: false,
      error: new Error(
        `SherpaOnnx environment check failed: ${environmentCheck.issues.join(", ")}`
      ),
      environmentCheck,
    };
  }

  try {
    const module = await loadSherpaOnnxNode();
    return {
      module,
      success: true,
      error: null,
      environmentCheck,
    };
  } catch (error: unknown) {
    return {
      module: null,
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      environmentCheck,
    };
  }
}
