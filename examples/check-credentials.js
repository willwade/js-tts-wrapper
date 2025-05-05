#!/usr/bin/env node

/**
 * Script to check credentials for all TTS engines
 * This script tests each engine's checkCredentials method and provides detailed information
 * about which engines are working and which are not.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load environment variables from .env at the project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

// Also try .envrc if .env doesn't exist
if (!fs.existsSync(path.join(projectRoot, '.env')) && fs.existsSync(path.join(projectRoot, '.envrc'))) {
  dotenv.config({ path: path.join(projectRoot, '.envrc') });
}

import {
  AzureTTSClient,
  ElevenLabsTTSClient,
  GoogleTTSClient,
  OpenAITTSClient,
  PlayHTTTSClient,
  PollyTTSClient,
  SherpaOnnxTTSClient,
  SherpaOnnxWasmTTSClient,
  WatsonTTSClient,
  WitAITTSClient,
  EspeakTTSClient
} from "../dist/esm/index.js";

// Define colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m"
};

/**
 * Check credentials for a TTS engine
 * @param {string} engineName - Name of the engine
 * @param {object} client - TTS client instance
 * @returns {Promise<object>} - Result object with success/error information
 */
async function checkEngineCredentials(engineName, client) {
  console.log(`${colors.bright}${colors.blue}Checking credentials for ${engineName}...${colors.reset}`);

  try {
    // First check if required environment variables are set
    const envVarsStatus = checkRequiredEnvVars(engineName);
    if (!envVarsStatus.success) {
      return {
        engine: engineName,
        success: false,
        error: `Missing required environment variables: ${envVarsStatus.missing.join(', ')}`,
        envVarsSet: envVarsStatus.set,
        envVarsMissing: envVarsStatus.missing
      };
    }

    // Call the checkCredentialsDetailed method
    console.log(`${colors.dim}Calling ${engineName}.checkCredentialsDetailed()...${colors.reset}`);
    const startTime = Date.now();
    const result = await client.checkCredentialsDetailed();
    const endTime = Date.now();

    if (result.success) {
      console.log(`${colors.green}✓ ${engineName} credentials are valid (${endTime - startTime}ms)${colors.reset}`);

      if (result.voiceCount !== undefined) {
        console.log(`${colors.green}✓ Found ${result.voiceCount} voices for ${engineName}${colors.reset}`);
      }

      // Try to get voices as an additional check if voiceCount is not provided
      if (result.voiceCount === undefined) {
        try {
          console.log(`${colors.dim}Getting voices for ${engineName}...${colors.reset}`);
          const voicesStartTime = Date.now();
          const voices = await client.getVoices();
          const voicesEndTime = Date.now();

          console.log(`${colors.green}✓ Got ${voices.length} voices for ${engineName} (${voicesEndTime - voicesStartTime}ms)${colors.reset}`);

          return {
            engine: engineName,
            success: true,
            voiceCount: voices.length,
            responseTime: endTime - startTime,
            voicesResponseTime: voicesEndTime - voicesStartTime
          };
        } catch (voicesError) {
          console.log(`${colors.yellow}⚠ ${engineName} credentials are valid but getVoices() failed: ${voicesError.message}${colors.reset}`);
          return {
            engine: engineName,
            success: true,
            error: `getVoices() failed: ${voicesError.message}`,
            responseTime: endTime - startTime
          };
        }
      } else {
        return {
          engine: engineName,
          success: true,
          voiceCount: result.voiceCount,
          responseTime: endTime - startTime
        };
      }
    } else {
      console.log(`${colors.red}✗ ${engineName} credentials are invalid (${endTime - startTime}ms)${colors.reset}`);
      if (result.error) {
        console.log(`${colors.red}  Error: ${result.error}${colors.reset}`);
      }
      return {
        engine: engineName,
        success: false,
        error: result.error || "checkCredentialsDetailed() returned false",
        responseTime: endTime - startTime
      };
    }
  } catch (error) {
    console.log(`${colors.red}✗ Error checking ${engineName} credentials: ${error.message}${colors.reset}`);
    return {
      engine: engineName,
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if required environment variables are set for an engine
 * @param {string} engineName - Name of the engine
 * @returns {object} - Object with success flag and arrays of set/missing variables
 */
function checkRequiredEnvVars(engineName) {
  let requiredVars = [];

  switch (engineName.toLowerCase()) {
    case "azure":
      requiredVars = ["MICROSOFT_TOKEN", "MICROSOFT_REGION"];
      break;
    case "elevenlabs":
      requiredVars = ["ELEVENLABS_API_KEY"];
      break;
    case "google":
      requiredVars = ["GOOGLE_APPLICATION_CREDENTIALS"];
      break;
    case "openai":
      requiredVars = ["OPENAI_API_KEY"];
      break;
    case "playht":
      requiredVars = ["PLAYHT_API_KEY", "PLAYHT_USER_ID"];
      break;
    case "polly":
      requiredVars = ["POLLY_REGION", "POLLY_AWS_KEY_ID", "POLLY_AWS_ACCESS_KEY"];
      break;
    case "watson":
      requiredVars = ["WATSON_API_KEY", "WATSON_REGION", "WATSON_INSTANCE_ID"];
      break;
    case "witai":
      requiredVars = ["WITAI_TOKEN"];
      break;
    case "sherpaonnx":
    case "sherpaonnx-wasm":
    case "espeak":
      // These don't require credentials
      return { success: true, set: [], missing: [] };
    default:
      console.log(`${colors.yellow}⚠ Unknown engine: ${engineName}${colors.reset}`);
      return { success: false, set: [], missing: ["Unknown engine"] };
  }

  const set = [];
  const missing = [];

  for (const varName of requiredVars) {
    if (process.env[varName]) {
      set.push(varName);
    } else {
      missing.push(varName);
    }
  }

  return {
    success: missing.length === 0,
    set,
    missing
  };
}

/**
 * Create a TTS client instance
 * @param {string} engineName - Name of the engine
 * @returns {object|null} - TTS client instance or null if creation failed
 */
function createTTSClient(engineName) {
  try {
    switch (engineName.toLowerCase()) {
      case "azure":
        return new AzureTTSClient({
          subscriptionKey: process.env.MICROSOFT_TOKEN || '',
          region: process.env.MICROSOFT_REGION || '',
        });
      case "elevenlabs":
        return new ElevenLabsTTSClient({
          apiKey: process.env.ELEVENLABS_API_KEY || '',
        });
      case "google":
        return new GoogleTTSClient({
          keyFilename: process.env.GOOGLE_SA_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
        });
      case "openai":
        return new OpenAITTSClient({
          apiKey: process.env.OPENAI_API_KEY || '',
        });
      case "playht":
        return new PlayHTTTSClient({
          apiKey: process.env.PLAYHT_API_KEY || '',
          userId: process.env.PLAYHT_USER_ID || '',
        });
      case "polly":
        return new PollyTTSClient({
          region: process.env.POLLY_REGION || '',
          accessKeyId: process.env.POLLY_AWS_KEY_ID || '',
          secretAccessKey: process.env.POLLY_AWS_ACCESS_KEY || '',
        });
      case "sherpaonnx":
        return new SherpaOnnxTTSClient({
          noDefaultDownload: true, // Don't download models for this test
        });
      case "sherpaonnx-wasm":
        return new SherpaOnnxWasmTTSClient({});
      case "watson":
        return new WatsonTTSClient({
          apiKey: process.env.WATSON_API_KEY || '',
          region: process.env.WATSON_REGION || '',
          instanceId: process.env.WATSON_INSTANCE_ID || '',
        });
      case "witai":
        return new WitAITTSClient({
          token: process.env.WITAI_TOKEN || '',
        });
      case "espeak":
        return new EspeakTTSClient();
      default:
        console.log(`${colors.yellow}⚠ Unknown engine: ${engineName}${colors.reset}`);
        return null;
    }
  } catch (error) {
    console.error(`${colors.red}Error creating ${engineName} client:${colors.reset}`, error);
    return null;
  }
}

/**
 * Run the credential check for all engines
 */
async function runCredentialChecks() {
  console.log(`${colors.bright}${colors.magenta}=== TTS Engine Credential Check ===\n${colors.reset}`);

  const engines = [
    "azure",
    "elevenlabs",
    "google",
    "openai",
    "playht",
    "polly",
    "sherpaonnx",
    "sherpaonnx-wasm",
    "watson",
    "witai",
    "espeak"
  ];

  const results = [];

  for (const engineName of engines) {
    const client = createTTSClient(engineName);
    if (client) {
      const result = await checkEngineCredentials(engineName, client);
      results.push(result);
      console.log(); // Add a blank line between engines
    } else {
      results.push({
        engine: engineName,
        success: false,
        error: "Failed to create client"
      });
      console.log(); // Add a blank line between engines
    }
  }

  // Print summary
  console.log(`${colors.bright}${colors.magenta}=== Summary ===\n${colors.reset}`);

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`${colors.bright}Total engines checked: ${results.length}${colors.reset}`);
  console.log(`${colors.green}Successful: ${successful.length}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed.length}${colors.reset}\n`);

  if (successful.length > 0) {
    console.log(`${colors.bright}${colors.green}Working engines:${colors.reset}`);
    for (const result of successful) {
      console.log(`  ${colors.green}✓ ${result.engine}${colors.reset}${result.voiceCount ? ` (${result.voiceCount} voices)` : ''}`);
    }
    console.log();
  }

  if (failed.length > 0) {
    console.log(`${colors.bright}${colors.red}Failed engines:${colors.reset}`);
    for (const result of failed) {
      console.log(`  ${colors.red}✗ ${result.engine}: ${result.error}${colors.reset}`);
    }
    console.log();
  }
}

// Run the credential checks
runCredentialChecks().catch(console.error);
