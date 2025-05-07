/**
 * SherpaOnnx Native Module Loader
 *
 * This module handles loading the sherpa-onnx-node native module with the correct
 * environment variables set for the current platform.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Find the sherpa-onnx platform-specific library directory
 * @returns Path to the library directory or null if not found
 */
export function findSherpaOnnxLibraryPath(): string | null {
  // Determine platform-specific library paths
  let possiblePaths: string[] = [];

  if (process.platform === "darwin") {
    // macOS
    possiblePaths = [
      path.join(process.cwd(), "node_modules", "sherpa-onnx-darwin-arm64"),
      path.join(process.cwd(), "node_modules", "sherpa-onnx-darwin-x64"),
    ];
  } else if (process.platform === "linux") {
    // Linux
    possiblePaths = [
      path.join(process.cwd(), "node_modules", "sherpa-onnx-linux-arm64"),
      path.join(process.cwd(), "node_modules", "sherpa-onnx-linux-x64"),
    ];
  } else if (process.platform === "win32") {
    // Windows
    possiblePaths = [path.join(process.cwd(), "node_modules", "sherpa-onnx-win-x64")];
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
 * Load the sherpa-onnx-node module with the correct environment variables
 * @returns The loaded sherpa-onnx-node module
 */
export async function loadSherpaOnnxNode(): Promise<any> {
  // Find the library path
  const libraryPath = findSherpaOnnxLibraryPath();

  if (!libraryPath) {
    throw new Error(
      "Could not find sherpa-onnx library directory. " +
        "Please install the sherpa-onnx-node package with: npm run install:sherpaonnx"
    );
  }

  // Set the environment variable
  let envVarName = "";
  if (process.platform === "darwin") {
    envVarName = "DYLD_LIBRARY_PATH";
  } else if (process.platform === "linux") {
    envVarName = "LD_LIBRARY_PATH";
  } else if (process.platform === "win32") {
    envVarName = "PATH";
  }

  if (envVarName) {
    const currentValue = process.env[envVarName] || "";
    const separator = process.platform === "win32" ? ";" : ":";

    // Only add the path if it's not already in the environment variable
    if (!currentValue.includes(libraryPath)) {
      process.env[envVarName] = libraryPath + (currentValue ? separator + currentValue : "");
    }
  }

  // Try to load the module
  try {
    // For CommonJS
    if (typeof require !== "undefined") {
      // Try to resolve the path first to check if the module exists
      try {
        const resolvedPath = require.resolve("sherpa-onnx-node");
        console.log(`Resolved sherpa-onnx-node path: ${resolvedPath}`);

        // Check if the native module exists
        const nativeModulePath = path.join(libraryPath, "sherpa-onnx.node");
        if (!fs.existsSync(nativeModulePath)) {
          console.warn(`Native module not found at ${nativeModulePath}`);
          throw new Error(`Native module not found at ${nativeModulePath}`);
        }

        // Try to load the module
        return require("sherpa-onnx-node");
      } catch (resolveError) {
        console.error(`Error resolving sherpa-onnx-node: ${resolveError}`);
        throw resolveError;
      }
    } else {
      // For ESM
      return await import("sherpa-onnx-node");
    }
  } catch (error) {
    // If loading fails, provide helpful error message
    console.warn(
      "Failed to load sherpa-onnx-node directly. " +
      "This might be because the environment variables need to be set before the Node.js process starts."
    );

    console.error("\nTo use SherpaOnnx TTS, you need to:");
    console.error("1. Install the sherpa-onnx-node package: npm run install:sherpaonnx");
    console.error("2. Run your application with the correct environment variables:");
    console.error(`   - On macOS: DYLD_LIBRARY_PATH=${libraryPath} node your-script.js`);
    console.error("   - On Linux: LD_LIBRARY_PATH=/path/to/node_modules/sherpa-onnx-linux-x64 node your-script.js");
    console.error("   - On Windows: No special environment variable needed");
    console.error("3. Or use the helper script: node scripts/run-with-sherpaonnx.cjs your-script.js");

    throw new Error(
      "Could not load sherpa-onnx-node. " +
      "Please use the run-with-sherpaonnx.cjs script to run your application: " +
      "node scripts/run-with-sherpaonnx.cjs your-script.js"
    );
  }
}

/**
 * Check if we can run SherpaOnnx in the current environment
 * @returns True if SherpaOnnx can run in the current environment
 */
export function canRunSherpaOnnx(): boolean {
  try {
    // Check if the sherpa-onnx-node package is installed
    const sherpaOnnxNodePath = path.join(process.cwd(), "node_modules", "sherpa-onnx-node");
    if (!fs.existsSync(sherpaOnnxNodePath)) {
      return false;
    }

    // Check if the platform-specific library is installed
    return !!findSherpaOnnxLibraryPath();
  } catch (error) {
    return false;
  }
}
