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
  SherpaOnnxWasmTTSClient, // Add SherpaOnnx WASM client
  EspeakTTSClient, // Import Espeak normally from ESM
  WitAITTSClient
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

    // For Polly, use a standard voice that supports SSML
    let voice;
    if (engineName === 'polly') {
      // Find a standard voice that supports SSML
      // Only standard voices support SSML, neural voices don't
      // Standard voices include: Geraint, Raveena, Aditi, etc.
      const standardVoices = ['Geraint', 'Raveena', 'Aditi', 'Ivy', 'Joanna', 'Kendra'];
      for (const standardVoice of standardVoices) {
        const foundVoice = voices.find(v => v.id === standardVoice);
        if (foundVoice) {
          voice = foundVoice;
          break;
        }
      }
      // Fall back to the first voice if no standard voice is found
      if (!voice) {
        voice = voices[0];
      }
    } else {
      // Use the first voice for other engines
      voice = voices[0];
    }

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
    // Use WAV format for all engines
    const format = 'wav';
    const extension = 'wav';

    const wavOutputFile = path.join(OUTPUT_DIR, `${engineName}-plain-wav.${extension}`);
    console.log(`Synthesizing plain text to ${format.toUpperCase()}: ${wavOutputFile}...`);
    await client.synthToFile(TEST_TEXT, wavOutputFile, format, { voice: voiceId });
    const wavStats = fs.statSync(wavOutputFile);
    console.log(`Generated ${format.toUpperCase()} file: ${wavStats.size} bytes`);
  } catch (wavError) {
    console.error(`Error generating WAV/MP3 for ${engineName}:`, wavError.message);
  }

  // Test SSML with WAV format
  try {
    // Use WAV format for all engines
    const format = 'wav';
    const extension = 'wav';

    const ssmlWavOutputFile = path.join(OUTPUT_DIR, `${engineName}-ssml-wav.${extension}`);
    console.log(`Synthesizing SSML to ${format.toUpperCase()}: ${ssmlWavOutputFile}...`);
    await client.synthToFile(TEST_SSML, ssmlWavOutputFile, format, { voice: voiceId });
    const ssmlWavStats = fs.statSync(ssmlWavOutputFile);
    console.log(`Generated SSML ${format.toUpperCase()} file: ${ssmlWavStats.size} bytes`);
  } catch (ssmlWavError) {
    console.error(`Error generating SSML WAV/MP3 for ${engineName}:`, ssmlWavError.message);
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

  // Test audio playback in any environment (browser or Node.js)
  try {
    console.log(`Testing audio playback for ${engineName}...`);

    // Set up event listeners
    client.on("start", () => console.log(`Playback started for ${engineName}`));
    client.on("end", () => console.log(`Playback ended for ${engineName}`));
    client.on("boundary", (word, start, end) => {
      console.log(`Word boundary: "${word}" at ${start}s (duration: ${end - start}s)`);
    });

    // Check if we should play audio
    const shouldPlayAudio = process.env.PLAY_AUDIO === 'true';

    if (shouldPlayAudio) {
      // Test plain text playback
      console.log(`Playing plain text for ${engineName}...`);
      await client.speak(TEST_TEXT, { voice: voiceId });

      // Wait a bit before the next playback
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test SSML playback
      console.log(`Playing SSML for ${engineName}...`);
      await client.speak(TEST_SSML, { voice: voiceId });
    } else {
      console.log(`Skipping audio playback (set PLAY_AUDIO=true to enable)`);
    }
  } catch (playbackError) {
    console.error(`Error during audio playback for ${engineName}:`, playbackError.message);
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
      name: "sherpaonnx-wasm",
      // Initialize SherpaOnnx WASM client (for Node.js testing)
      factory: () => new SherpaOnnxWasmTTSClient({
        wasmPath: process.env.SHERPAONNX_WASM_PATH || null
      })
    },
    {
      name: "espeak",
      factory: () => new EspeakTTSClient() // Initialize espeak directly
    },
    {
      name: "witai",
      factory: () => new WitAITTSClient({
        token: process.env.WITAI_TOKEN || '',
      })
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

/**
 * Parse command line arguments
 * @returns {string|null} Engine name to test, or null to test all engines
 */
function parseArgs() {
  // Get command line arguments (skip the first two: node and script name)
  const args = process.argv.slice(2);

  // If --help or -h is provided, show help and exit
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node test-engines.js [engine]');
    console.log('');
    console.log('Options:');
    console.log('  --help, -h     Show this help message');
    console.log('');
    console.log('Available engines:');
    console.log('  mock           Mock TTS engine (for testing)');
    console.log('  azure          Microsoft Azure TTS');
    console.log('  elevenlabs     ElevenLabs TTS');
    console.log('  google         Google Cloud TTS');
    console.log('  openai         OpenAI TTS');
    console.log('  playht         PlayHT TTS');
    console.log('  polly          AWS Polly TTS');
    console.log('  sherpaonnx     SherpaOnnx TTS (Node.js/Server)');
    console.log('  sherpaonnx-wasm SherpaOnnx TTS (WebAssembly/Browser)');
    console.log('  espeak         eSpeak TTS');
    console.log('  witai          Wit.ai TTS');
    console.log('');
    console.log('If no engine is specified, all engines will be tested.');
    process.exit(0);
  }

  // If an engine name is provided, return it
  if (args.length > 0) {
    return args[0].toLowerCase();
  }

  // Otherwise, return null to test all engines
  return null;
}

// Get the engine to test (if specified)
const engineToTest = parseArgs();

// Run the tests
if (engineToTest) {
  console.log(`Testing only the ${engineToTest} engine...\n`);

  // Define all engine configs
  const engineConfigs = [
    { name: "mock", factory: () => new MockTTSClient() },
    { name: "azure", factory: () => new AzureTTSClient({ subscriptionKey: process.env.MICROSOFT_TOKEN || '', region: process.env.MICROSOFT_REGION || '' }) },
    { name: "elevenlabs", factory: () => new ElevenLabsTTSClient({ apiKey: process.env.ELEVENLABS_API_KEY || '' }) },
    { name: "google", factory: () => new GoogleTTSClient({ keyFilename: process.env.GOOGLE_SA_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || '' }) },
    { name: "openai", factory: () => new OpenAITTSClient({ apiKey: process.env.OPENAI_API_KEY || '' }) },
    { name: "playht", factory: () => new PlayHTTTSClient({ apiKey: process.env.PLAYHT_API_KEY || '', userId: process.env.PLAYHT_USER_ID || '' }) },
    { name: "polly", factory: () => new PollyTTSClient({ region: process.env.POLLY_REGION || '', accessKeyId: process.env.POLLY_AWS_KEY_ID || '', secretAccessKey: process.env.POLLY_AWS_ACCESS_KEY || '' }) },
    { name: "sherpaonnx", factory: () => new SherpaOnnxTTSClient({ noDefaultDownload: true, modelPath: process.env.SHERPAONNX_MODEL_PATH || null }) },
    { name: "sherpaonnx-wasm", factory: () => new SherpaOnnxWasmTTSClient({ wasmPath: process.env.SHERPAONNX_WASM_PATH || null }) },
    { name: "espeak", factory: () => new EspeakTTSClient() },
    { name: "witai", factory: () => new WitAITTSClient({ token: process.env.WITAI_TOKEN || '' }) }
  ];

  // Find the specified engine
  const engineConfig = engineConfigs.find(config => config.name === engineToTest);

  if (engineConfig) {
    try {
      console.log(`Initializing ${engineConfig.name}...`);
      const client = engineConfig.factory();
      testEngine(engineConfig.name, client).catch(console.error);
    } catch (error) {
      console.error(`Error initializing ${engineConfig.name}:`, error.message);
    }
  } else {
    console.error(`Unknown engine: ${engineToTest}`);
    console.log('Run with --help to see available engines.');
    process.exit(1);
  }
} else {
  // Test all engines
  runTests().catch(console.error);
}
