/**
 * Shared engine configurations for TTS testing
 * This module provides a centralized way to configure all TTS engines
 * for use across different test scripts.
 */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(projectRoot, '.envrc') });

// Also try .env if .envrc doesn't exist
import fs from 'node:fs';
if (!fs.existsSync(path.join(projectRoot, '.envrc')) && fs.existsSync(path.join(projectRoot, '.env'))) {
  dotenv.config({ path: path.join(projectRoot, '.env') });
}

/**
 * Get engine configurations for ESM imports
 * @returns {Array} Array of engine configuration objects
 */
export async function getEngineConfigs() {
  // Dynamic imports for ESM
  const {
    AzureTTSClient,
    ElevenLabsTTSClient,
    GoogleTTSClient,
    OpenAITTSClient,
    PlayHTTTSClient,
    PollyTTSClient,
    SherpaOnnxTTSClient,
    SherpaOnnxWasmTTSClient,
    EspeakTTSClient,
    EspeakWasmTTSClient,
    WatsonTTSClient,
    WitAITTSClient
  } = await import("../../dist/esm/index.js");

  const { MockTTSClient } = await import("../../dist/esm/__tests__/mock-tts-client.helper.js");

  return [
    {
      name: "mock",
      factory: () => new MockTTSClient(),
      description: "Mock TTS engine (for testing)"
    },
    {
      name: "azure",
      factory: () => new AzureTTSClient({
        subscriptionKey: process.env.MICROSOFT_TOKEN || '',
        region: process.env.MICROSOFT_REGION || '',
      }),
      description: "Microsoft Azure TTS"
    },
    {
      name: "elevenlabs",
      factory: () => new ElevenLabsTTSClient({
        apiKey: process.env.ELEVENLABS_API_KEY || '',
      }),
      description: "ElevenLabs TTS"
    },
    {
      name: "google",
      factory: () => new GoogleTTSClient({
        keyFilename: process.env.GOOGLE_SA_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
      }),
      description: "Google Cloud TTS"
    },
    {
      name: "openai",
      factory: () => new OpenAITTSClient({
        apiKey: process.env.OPENAI_API_KEY || '',
      }),
      description: "OpenAI TTS"
    },
    {
      name: "playht",
      factory: () => new PlayHTTTSClient({
        apiKey: process.env.PLAYHT_API_KEY || '',
        userId: process.env.PLAYHT_USER_ID || '',
      }),
      description: "PlayHT TTS"
    },
    {
      name: "polly",
      factory: () => new PollyTTSClient({
        region: process.env.POLLY_REGION || '',
        accessKeyId: process.env.POLLY_AWS_KEY_ID || '',
        secretAccessKey: process.env.POLLY_AWS_ACCESS_KEY || '',
      }),
      description: "AWS Polly TTS"
    },
    {
      name: "sherpaonnx",
      factory: () => new SherpaOnnxTTSClient({
        noDefaultDownload: true,
        modelPath: process.env.SHERPAONNX_MODEL_PATH || null
      }),
      description: "SherpaOnnx TTS (Node.js/Server)"
    },
    {
      name: "sherpaonnx-wasm",
      factory: () => new SherpaOnnxWasmTTSClient({
        wasmPath: process.env.SHERPAONNX_WASM_PATH || null
      }),
      description: "SherpaOnnx TTS (WebAssembly/Browser)"
    },
    {
      name: "espeak",
      factory: () => new EspeakTTSClient(),
      description: "eSpeak TTS (Node.js)"
    },
    {
      name: "espeak-wasm",
      factory: () => new EspeakWasmTTSClient(),
      description: "eSpeak TTS (WebAssembly/Browser)"
    },
    {
      name: "watson",
      factory: () => new WatsonTTSClient({
        apikey: process.env.WATSON_API_KEY || '',
        url: process.env.WATSON_URL || '',
      }),
      description: "IBM Watson TTS"
    },
    {
      name: "witai",
      factory: () => new WitAITTSClient({
        token: process.env.WITAI_TOKEN || '',
      }),
      description: "Wit.ai TTS"
    }
  ];
}

/**
 * Get engine configurations for CommonJS imports
 * @returns {Array} Array of engine configuration objects
 */
export function getEngineConfigsCJS() {
  // CommonJS imports
  const {
    AzureTTSClient,
    ElevenLabsTTSClient,
    GoogleTTSClient,
    OpenAITTSClient,
    PlayHTTTSClient,
    PollyTTSClient,
    SherpaOnnxTTSClient,
    EspeakTTSClient,
    EspeakWasmTTSClient,
    WatsonTTSClient,
    WitAITTSClient
  } = require('../../dist/cjs/index.js');

  const { MockTTSClient } = require('../../dist/cjs/__tests__/mock-tts-client.helper.js');

  return [
    {
      name: "mock",
      factory: () => new MockTTSClient(),
      description: "Mock TTS engine (for testing)"
    },
    {
      name: "azure",
      factory: () => new AzureTTSClient({
        subscriptionKey: process.env.MICROSOFT_TOKEN || '',
        region: process.env.MICROSOFT_REGION || '',
      }),
      description: "Microsoft Azure TTS"
    },
    {
      name: "elevenlabs",
      factory: () => new ElevenLabsTTSClient({
        apiKey: process.env.ELEVENLABS_API_KEY || '',
      }),
      description: "ElevenLabs TTS"
    },
    {
      name: "google",
      factory: () => new GoogleTTSClient({
        keyFilename: process.env.GOOGLE_SA_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
      }),
      description: "Google Cloud TTS"
    },
    {
      name: "openai",
      factory: () => new OpenAITTSClient({
        apiKey: process.env.OPENAI_API_KEY || '',
      }),
      description: "OpenAI TTS"
    },
    {
      name: "playht",
      factory: () => new PlayHTTTSClient({
        apiKey: process.env.PLAYHT_API_KEY || '',
        userId: process.env.PLAYHT_USER_ID || '',
      }),
      description: "PlayHT TTS"
    },
    {
      name: "polly",
      factory: () => new PollyTTSClient({
        region: process.env.POLLY_REGION || '',
        accessKeyId: process.env.POLLY_AWS_KEY_ID || '',
        secretAccessKey: process.env.POLLY_AWS_ACCESS_KEY || '',
      }),
      description: "AWS Polly TTS"
    },
    {
      name: "sherpaonnx",
      factory: () => new SherpaOnnxTTSClient({
        noDefaultDownload: false,
        modelId: "mms_eng",
        modelPath: process.env.SHERPAONNX_MODEL_PATH || null
      }),
      description: "SherpaOnnx TTS (Node.js/Server)"
    },
    {
      name: "espeak",
      factory: () => new EspeakTTSClient(),
      description: "eSpeak TTS (Node.js)"
    },
    {
      name: "espeak-wasm",
      factory: () => new EspeakWasmTTSClient(),
      description: "eSpeak TTS (WebAssembly/Browser)"
    },
    {
      name: "watson",
      factory: () => new WatsonTTSClient({
        apikey: process.env.WATSON_API_KEY || '',
        url: process.env.WATSON_URL || '',
      }),
      description: "IBM Watson TTS"
    },
    {
      name: "witai",
      factory: () => new WitAITTSClient({
        token: process.env.WITAI_TOKEN || '',
      }),
      description: "Wit.ai TTS"
    }
  ];
}

/**
 * Get a specific engine configuration by name
 * @param {string} engineName - Name of the engine
 * @param {Array} configs - Array of engine configurations
 * @returns {Object|null} Engine configuration or null if not found
 */
export function getEngineConfig(engineName, configs) {
  return configs.find(config => config.name === engineName) || null;
}

/**
 * Get list of available engine names
 * @param {Array} configs - Array of engine configurations
 * @returns {Array} Array of engine names
 */
export function getAvailableEngines(configs) {
  return configs.map(config => config.name);
}

/**
 * Print help information about available engines
 * @param {Array} configs - Array of engine configurations
 */
export function printEngineHelp(configs) {
  console.log('Available engines:');
  configs.forEach(config => {
    console.log(`  ${config.name.padEnd(15)} ${config.description}`);
  });
  console.log('');
  console.log('If no engine is specified, all engines will be tested.');
}
