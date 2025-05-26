#!/usr/bin/env node

/**
 * CLI for js-tts-wrapper
 * Handles installation of optional dependencies and other commands
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the package root directory
const packageRoot = path.resolve(__dirname, "..");

/**
 * Execute a command and return a promise
 * @param {string} command - Command to execute
 * @param {string[]} args - Command arguments
 * @param {object} options - Spawn options
 * @returns {Promise<void>}
 */
function executeCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command} ${args.join(" ")}`);

    const child = spawn(command, args, {
      stdio: "inherit",
      cwd: options.cwd || process.cwd(),
      ...options,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Install dependencies for a specific engine
 * @param {string} engine - Engine name
 */
async function installEngine(engine) {
  const engineDeps = {
    azure: ["microsoft-cognitiveservices-speech-sdk"],
    google: ["@google-cloud/text-to-speech"],
    elevenlabs: ["node-fetch@2"],
    playht: ["node-fetch@2"],
    polly: ["@aws-sdk/client-polly"],
    openai: ["openai"],
    witai: [],
    "node-audio": ["sound-play", "speaker", "pcm-convert"],
    sherpaonnx: [
      "sherpa-onnx-node@^1.12.0",
      "decompress",
      "decompress-bzip2",
      "decompress-tarbz2",
      "decompress-targz",
      "tar-stream",
    ],
    cloud: [
      "microsoft-cognitiveservices-speech-sdk",
      "@google-cloud/text-to-speech",
      "@aws-sdk/client-polly",
      "openai",
    ],
    all: [
      "microsoft-cognitiveservices-speech-sdk",
      "@google-cloud/text-to-speech",
      "@aws-sdk/client-polly",
      "openai",
      "node-fetch@2",
      "sherpa-onnx-node@^1.12.0",
      "decompress",
      "decompress-bzip2",
      "decompress-tarbz2",
      "decompress-targz",
      "tar-stream",
      "sound-play",
      "speaker",
      "pcm-convert",
    ],
  };

  const deps = engineDeps[engine];
  if (!deps) {
    throw new Error(
      `Unknown engine: ${engine}. Available engines: ${Object.keys(engineDeps).join(", ")}`
    );
  }

  if (deps.length === 0) {
    console.log(`No additional dependencies required for ${engine}`);
    return;
  }

  console.log(`Installing dependencies for ${engine}: ${deps.join(", ")}`);
  await executeCommand("npm", ["install", ...deps]);
  console.log(`Successfully installed dependencies for ${engine}`);
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
js-tts-wrapper CLI

Usage:
  npx js-tts-wrapper <command> [options]

Commands:
  install <engine>     Install dependencies for a specific TTS engine
  help                 Show this help message

Available engines:
  azure               Microsoft Azure TTS
  google              Google Cloud TTS
  elevenlabs          ElevenLabs TTS
  playht              PlayHT TTS
  polly               AWS Polly TTS
  openai              OpenAI TTS
  witai               Wit.ai TTS
  sherpaonnx          SherpaOnnx TTS (offline)
  node-audio          Node.js audio playback dependencies
  cloud               All cloud TTS engines
  all                 All engines and dependencies

Examples:
  npx js-tts-wrapper install sherpaonnx
  npx js-tts-wrapper install azure
  npx js-tts-wrapper install all
`);
}

/**
 * Main CLI function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
    showHelp();
    return;
  }

  const command = args[0];

  try {
    switch (command) {
      case "install":
        if (args.length < 2) {
          console.error("Error: Engine name required for install command");
          console.log('Run "npx js-tts-wrapper help" for usage information');
          process.exit(1);
        }
        await installEngine(args[1]);
        break;

      case "run":
        // Handle legacy "run install:engine" format
        if (args.length >= 2 && args[1].startsWith("install:")) {
          const engine = args[1].replace("install:", "");
          await installEngine(engine);
        } else {
          console.error("Error: Unknown run command");
          console.log('Run "npx js-tts-wrapper help" for usage information');
          process.exit(1);
        }
        break;

      default:
        console.error(`Error: Unknown command: ${command}`);
        console.log('Run "npx js-tts-wrapper help" for usage information');
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the CLI
main().catch((error) => {
  console.error(`Unexpected error: ${error.message}`);
  process.exit(1);
});
