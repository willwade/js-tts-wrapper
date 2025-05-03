// Test script to generate WAV files for each TTS engine
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load environment variables from .envrc at the project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..'); // Assumes script is in examples/
dotenv.config({ path: path.join(projectRoot, '.envrc') });

import {
  AzureTTSClient,
  ElevenLabsTTSClient,
  GoogleTTSClient,
  OpenAITTSClient,
  PlayHTTTSClient,
  PollyTTSClient,
  SherpaOnnxTTSClient,
  EspeakTTSClient // Import Espeak normally from ESM
} from "../dist/esm/index.js"; // Import from ESM index

const TEST_TEXT = "This is a test of the text to speech engine Testing one two three";
const OUTPUT_DIR = path.join(__dirname, "test-output");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

async function testEngine(engineName, client) {
  if (!client) {
    console.log(`Skipping ${engineName} - client not initialized`);
    return;
  }

  try {
    // Check credentials first (client should handle missing ones gracefully or throw)
    console.log(`Checking credentials for ${engineName}...`);
    // NOTE: Not all clients might implement checkCredentials. Rely on synthToFile errors for now.
    // const credentialsValid = await client.checkCredentials(); 
    // if (!credentialsValid) {
    //   console.log(`Invalid or missing credentials for ${engineName}, skipping...\n`);
    //   return;
    // }
    // console.log(`Credentials valid for ${engineName}`);

    console.log(`Testing ${engineName}...`);
    const outputFile = path.join(OUTPUT_DIR, `${engineName}-test.wav`);
    
    // Get available voices
    console.log(`Fetching voices for ${engineName}...`);
    const voices = await client.getVoices();
    if (voices.length === 0) {
      console.log(`No voices available for ${engineName}`);
      return;
    }

    // Use the first available voice
    const voice = voices[0];
    console.log(`Using voice: ${voice.name} (${voice.id})`);

    // Generate speech and save to file
    console.log(`Synthesizing to ${outputFile}...`);
    await client.synthToFile(TEST_TEXT, outputFile, "wav", { voice: voice.id });
    console.log(`Generated ${outputFile}`);
    
    // Log file size as a basic check
    const stats = fs.statSync(outputFile);
    console.log(`File size: ${stats.size} bytes\n`);
  } catch (error) {
    console.error(`Error testing ${engineName}:`, error.message, '\n');
    // Optionally log the full error stack for more details
    // console.error(error);
  }
}

async function runTests() {
  // Define engines and their initialization options
  const engineConfigs = [
    {
      name: "azure",
      factory: () => new AzureTTSClient({
        subscriptionKey: process.env.MICROSOFT_TOKEN || '',
        region: process.env.MICROSOFT_REGION || '',
      })
    },
    {
      name: "elevenlabs",
      factory: () => new ElevenLabsTTSClient({
        apiKey: process.env.ELEVENLABS_API_KEY || '',
      })
    },
    {
      name: "google",
      factory: () => new GoogleTTSClient({
        // Ensure GOOGLE_APPLICATION_CREDENTIALS points to the key file
        // keyFilename: process.env.GOOGLE_SA_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
      }) // Google client often uses ADC (Application Default Credentials)
    },
    {
      name: "openai",
      factory: () => new OpenAITTSClient({
        apiKey: process.env.OPENAI_API_KEY || '',
      })
    },
    {
      name: "playht",
      factory: () => new PlayHTTTSClient({
        apiKey: process.env.PLAYHT_API_KEY || '',
        userId: process.env.PLAYHT_USER_ID || '',
      })
    },
    {
      name: "polly",
      factory: () => new PollyTTSClient({
        region: process.env.POLLY_REGION || '',
        accessKeyId: process.env.POLLY_AWS_KEY_ID || '',
        secretAccessKey: process.env.POLLY_AWS_ACCESS_KEY || '',
      })
    },
    {
      name: "sherpaonnx",
      // Initialize directly, allowing the client to download default models if needed
      factory: () => new SherpaOnnxTTSClient({})
    },
    {
      name: "espeak",
      factory: () => new EspeakTTSClient() // Initialize espeak directly
    }
  ];

  for (const config of engineConfigs) {
    let client = null;
    try {
      console.log(`Initializing ${config.name}...`);
      client = config.factory();
    } catch (initError) {
      console.error(`Error initializing ${config.name}:`, initError.message, '\n');
      continue; // Skip to the next engine if initialization fails
    }
    
    if (client) { // Only test if client was successfully initialized
      await testEngine(config.name, client);
    }
  }
}

// Run the tests
runTests().catch(console.error);
