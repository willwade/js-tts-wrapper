// Test script to generate audio files for each TTS engine and test audio playback
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load environment variables from .envrc at the project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..'); // Assumes script is in examples/
dotenv.config({ path: path.join(projectRoot, '.envrc') });

// Also try .env if .envrc doesn't exist
if (!fs.existsSync(path.join(projectRoot, '.envrc')) && fs.existsSync(path.join(projectRoot, '.env'))) {
  dotenv.config({ path: path.join(projectRoot, '.env') });
}

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

// Import the MockTTSClient directly from the test helpers
import { MockTTSClient } from "../dist/esm/__tests__/mock-tts-client.helper.js";

// Test texts
const TEST_TEXT = "This is a test of the text to speech engine. Testing one two three.";
const TEST_SSML = "<speak>This is a test of the <emphasis>text to speech</emphasis> engine with <break time='500ms'/> SSML.</speak>";
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
    // Check credentials first using the detailed method
    console.log(`Checking credentials for ${engineName}...`);
    try {
      const credentialsResult = await client.checkCredentialsDetailed();
      if (!credentialsResult.success) {
        console.log(`Invalid or missing credentials for ${engineName}: ${credentialsResult.error || 'Unknown error'}`);
        console.log(`Skipping ${engineName}...\n`);
        return;
      }
      console.log(`Credentials valid for ${engineName}. Found ${credentialsResult.voiceCount || 'unknown number of'} voices.`);
    } catch (credError) {
      // Fall back to the regular checkCredentials method
      try {
        const credentialsValid = await client.checkCredentials();
        if (!credentialsValid) {
          console.log(`Invalid or missing credentials for ${engineName}, skipping...\n`);
          return;
        }
        console.log(`Credentials valid for ${engineName}`);
      } catch (fallbackError) {
        console.log(`Could not check credentials for ${engineName}, will try to continue anyway.`);
      }
    }

    console.log(`Testing ${engineName}...`);

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

    // Test different formats and input types
    await testFormatAndInput(engineName, client, voice.id);

  } catch (error) {
    console.error(`Error testing ${engineName}:`, error.message, '\n');
    // Optionally log the full error stack for more details
    // console.error(error);
  }
}

// Test different formats and input types
async function testFormatAndInput(engineName, client, voiceId) {
  // Test plain text with WAV format
  try {
    const wavOutputFile = path.join(OUTPUT_DIR, `${engineName}-plain-wav.wav`);
    console.log(`Synthesizing plain text to WAV: ${wavOutputFile}...`);
    await client.synthToFile(TEST_TEXT, wavOutputFile, "wav", { voice: voiceId });
    const wavStats = fs.statSync(wavOutputFile);
    console.log(`Generated WAV file: ${wavStats.size} bytes`);
  } catch (wavError) {
    console.error(`Error generating WAV for ${engineName}:`, wavError.message);
  }

  // Test SSML with WAV format
  try {
    const ssmlWavOutputFile = path.join(OUTPUT_DIR, `${engineName}-ssml-wav.wav`);
    console.log(`Synthesizing SSML to WAV: ${ssmlWavOutputFile}...`);
    await client.synthToFile(TEST_SSML, ssmlWavOutputFile, "wav", { voice: voiceId });
    const ssmlWavStats = fs.statSync(ssmlWavOutputFile);
    console.log(`Generated SSML WAV file: ${ssmlWavStats.size} bytes`);
  } catch (ssmlWavError) {
    console.error(`Error generating SSML WAV for ${engineName}:`, ssmlWavError.message);
  }

  // Test MP3 format if supported by the engine
  try {
    const mp3OutputFile = path.join(OUTPUT_DIR, `${engineName}-plain-mp3.mp3`);
    console.log(`Synthesizing plain text to MP3: ${mp3OutputFile}...`);
    await client.synthToFile(TEST_TEXT, mp3OutputFile, "mp3", { voice: voiceId });
    const mp3Stats = fs.statSync(mp3OutputFile);
    console.log(`Generated MP3 file: ${mp3Stats.size} bytes`);
  } catch (mp3Error) {
    console.log(`MP3 format not supported by ${engineName} or error occurred:`, mp3Error.message);
  }

  // Test audio playback in browser environment (if running in browser)
  if (typeof window !== 'undefined') {
    try {
      console.log(`Testing audio playback for ${engineName}...`);

      // Set up event listeners
      client.on("start", () => console.log(`Playback started for ${engineName}`));
      client.on("end", () => console.log(`Playback ended for ${engineName}`));

      // Test plain text playback
      console.log(`Playing plain text for ${engineName}...`);
      await client.speak(TEST_TEXT, { voice: voiceId });

      // Test SSML playback
      console.log(`Playing SSML for ${engineName}...`);
      await client.speak(TEST_SSML, { voice: voiceId });
    } catch (playbackError) {
      console.error(`Error during audio playback for ${engineName}:`, playbackError.message);
    }
  }

  console.log(`Completed tests for ${engineName}\n`);
}

async function runTests() {
  // Define engines and their initialization options
  const engineConfigs = [
    // Add the Mock TTS client first for testing
    {
      name: "mock",
      factory: () => new MockTTSClient()
    },
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
        keyFilename: process.env.GOOGLE_SA_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
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
      // Initialize with specific options to avoid download issues
      factory: () => new SherpaOnnxTTSClient({
        noDefaultDownload: true, // Don't try to download models
        modelPath: process.env.SHERPAONNX_MODEL_PATH || null
      })
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
