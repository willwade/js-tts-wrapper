#!/usr/bin/env node

/**
 * Unified TTS Test Runner
 *
 * This script replaces multiple individual test files with a single, configurable test runner.
 * It can test all engines or specific engines with various test modes.
 *
 * Usage:
 *   node examples/unified-test-runner.js [engine] [--mode=MODE] [--help]
 *
 * Modes:
 *   basic       - Basic synthesis tests (default)
 *   playback    - Playback control tests
 *   features    - Comprehensive feature tests
 *   audio       - Audio-only tests (requires PLAY_AUDIO=true)
 *   example     - Comprehensive example with SSML, streaming, word boundaries
 *   debug       - Debug mode for troubleshooting engines
 *   stream      - Streaming tests with real-time playback
 *
 * Examples:
 *   node examples/unified-test-runner.js                    # Test all engines (basic mode)
 *   node examples/unified-test-runner.js azure             # Test Azure engine only
 *   node examples/unified-test-runner.js --mode=playback   # Test playback controls for all engines
 *   node examples/unified-test-runner.js --mode=example    # Comprehensive examples (replaces tts-example.js)
 *   node examples/unified-test-runner.js sherpaonnx --mode=debug  # Debug SherpaOnnx issues
 *   node examples/unified-test-runner.js playht --mode=stream     # Test streaming with real-time playback
 *   PLAY_AUDIO=true node examples/unified-test-runner.js mock --mode=audio
 */

import { getEngineConfigs, getEngineConfig, printEngineHelp } from './shared/engine-configs.js';
import { testEngine, testPlaybackControl, parseEngineArg, TEST_TEXTS } from './shared/test-utils.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, "test-output");

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);

  // Check for help
  if (args.includes('--help') || args.includes('-h')) {
    return { showHelp: true };
  }

  // Parse mode
  let mode = 'basic';
  const modeArg = args.find(arg => arg.startsWith('--mode='));
  if (modeArg) {
    mode = modeArg.split('=')[1];
    args.splice(args.indexOf(modeArg), 1);
  }

  // Parse engine
  const engine = args.length > 0 ? args[0].toLowerCase() : null;

  return { engine, mode, showHelp: false };
}

/**
 * Show help information
 */
async function showHelpInfo() {
  console.log('Unified TTS Test Runner');
  console.log('');
  console.log('Usage: node examples/unified-test-runner.js [engine] [--mode=MODE] [--help]');
  console.log('');
  console.log('Modes:');
  console.log('  basic       Basic synthesis tests (default)');
  console.log('  playback    Playback control tests');
  console.log('  features    Comprehensive feature tests');
  console.log('  audio       Audio-only tests (requires PLAY_AUDIO=true)');
  console.log('  example     Comprehensive example with SSML, streaming, word boundaries');
  console.log('  debug       Debug mode for troubleshooting engines');
  console.log('  stream      Streaming tests with real-time playback');
  console.log('');

  const configs = await getEngineConfigs();
  printEngineHelp(configs);

  console.log('Examples:');
  console.log('  node examples/unified-test-runner.js                    # Test all engines (basic mode)');
  console.log('  node examples/unified-test-runner.js azure             # Test Azure engine only');
  console.log('  node examples/unified-test-runner.js --mode=playback   # Test playback controls for all engines');
  console.log('  PLAY_AUDIO=true node examples/unified-test-runner.js mock --mode=audio');
}

/**
 * Run basic synthesis tests
 */
async function runBasicTests(engineConfigs, targetEngine = null) {
  console.log('Running basic synthesis tests...\n');

  const configsToTest = targetEngine
    ? [getEngineConfig(targetEngine, engineConfigs)].filter(Boolean)
    : engineConfigs;

  for (const config of configsToTest) {
    let client = null;
    try {
      console.log(`Initializing ${config.name}...`);
      client = config.factory();
    } catch (initError) {
      console.error(`Error initializing ${config.name}:`, initError.message, '\n');
      continue;
    }

    if (client) {
      await testEngine(config.name, client, {
        outputDir: OUTPUT_DIR,
        testFormats: ['wav', 'mp3'],
        testSSML: true,
        testPlayback: false
      });
    }
  }
}

/**
 * Run playback control tests
 */
async function runPlaybackTests(engineConfigs, targetEngine = null) {
  console.log('Running playback control tests...\n');

  const configsToTest = targetEngine
    ? [getEngineConfig(targetEngine, engineConfigs)].filter(Boolean)
    : engineConfigs.slice(0, 3); // Limit to first 3 engines for playback tests

  for (const config of configsToTest) {
    let client = null;
    try {
      console.log(`\n=== Testing Playback Control: ${config.name} ===`);
      client = config.factory();

      // Set up event listeners
      client.on("start", () => console.log(`Playback started for ${config.name}`));
      client.on("end", () => console.log(`Playback ended for ${config.name}`));
      client.on("boundary", (word, start, end) => {
        console.log(`Word boundary: "${word}" at ${start}s (duration: ${end - start}s)`);
      });

      await testPlaybackControl(client);

    } catch (error) {
      console.error(`Error testing playback control for ${config.name}:`, error.message);
    }
  }
}

/**
 * Run comprehensive feature tests
 */
async function runFeatureTests(engineConfigs, targetEngine = null) {
  console.log('Running comprehensive feature tests...\n');

  const configsToTest = targetEngine
    ? [getEngineConfig(targetEngine, engineConfigs)].filter(Boolean)
    : engineConfigs;

  for (const config of configsToTest) {
    let client = null;
    try {
      console.log(`\n=== Feature Testing: ${config.name} ===`);
      client = config.factory();

      await testEngine(config.name, client, {
        outputDir: OUTPUT_DIR,
        testFormats: ['wav', 'mp3'],
        testSSML: true,
        testPlayback: true
      });

      // Additional feature tests
      await testAdvancedFeatures(config.name, client);

    } catch (error) {
      console.error(`Error in feature testing for ${config.name}:`, error.message);
    }
  }
}

/**
 * Run audio-only tests
 */
async function runAudioTests(engineConfigs, targetEngine = null) {
  console.log('Running audio-only tests...\n');
  console.log('Note: Set PLAY_AUDIO=true to enable actual audio playback\n');

  const configsToTest = targetEngine
    ? [getEngineConfig(targetEngine, engineConfigs)].filter(Boolean)
    : engineConfigs.slice(0, 2); // Limit to first 2 engines for audio tests

  for (const config of configsToTest) {
    let client = null;
    try {
      console.log(`\n=== Audio Testing: ${config.name} ===`);
      client = config.factory();

      // Set up event listeners
      client.on("start", () => console.log(`Audio started for ${config.name}`));
      client.on("end", () => console.log(`Audio ended for ${config.name}`));
      client.on("boundary", (word, start, end) => {
        console.log(`Word: "${word}" at ${start}s`);
      });

      // Test audio playback only
      const shouldPlayAudio = process.env.PLAY_AUDIO === 'true';
      if (shouldPlayAudio) {
        console.log("Playing test audio...");
        await client.speak(TEST_TEXTS.plain);
      } else {
        console.log("Audio playback disabled (set PLAY_AUDIO=true to enable)");
      }

    } catch (error) {
      console.error(`Error in audio testing for ${config.name}:`, error.message);
    }
  }
}

/**
 * Test advanced features
 */
async function testAdvancedFeatures(engineName, client) {
  try {
    console.log(`Testing advanced features for ${engineName}...`);

    // Test property management
    const originalRate = client.getProperty('rate');
    client.setProperty('rate', 'slow');
    console.log(`Rate changed to: ${client.getProperty('rate')}`);
    client.setProperty('rate', originalRate);

    // Test voice management
    const voices = await client.getVoices();
    console.log(`Voice count: ${voices.length}`);

    // Test streaming if available
    if (typeof client.synthToBytestream === 'function') {
      console.log('Testing streaming...');
      const result = await client.synthToBytestream(TEST_TEXTS.plain);
      console.log(`Stream result: ${result.audioStream ? 'Success' : 'Failed'}`);
    }

  } catch (error) {
    console.log(`Advanced features test failed for ${engineName}: ${error.message}`);
  }
}

/**
 * Run comprehensive example mode (replaces tts-example.js)
 */
async function runExampleMode(engineConfigs, targetEngine = null) {
  console.log('Running comprehensive examples with SSML, streaming, and word boundaries...\n');

  const configsToTest = targetEngine
    ? [getEngineConfig(targetEngine, engineConfigs)].filter(Boolean)
    : engineConfigs.slice(0, 3); // Limit to first 3 engines for comprehensive examples

  for (const config of configsToTest) {
    let client = null;
    try {
      console.log(`\n=== Comprehensive Example: ${config.name} ===`);
      client = config.factory();

      // Check credentials
      const credentialsValid = await client.checkCredentials();
      if (!credentialsValid) {
        console.log(`Skipping ${config.name} - invalid credentials`);
        continue;
      }

      // Get voices and select appropriate one
      const voices = await client.getVoices();
      console.log(`Found ${voices.length} voices`);

      if (voices.length === 0) {
        console.log(`No voices available for ${config.name}`);
        continue;
      }

      // Select voice
      const voice = voices[0];
      console.log(`Using voice: ${voice.name} (${voice.id})`);
      await client.setVoice(voice.id);

      // Test 1: Basic synthesis
      console.log('\n--- Test 1: Basic Text Synthesis ---');
      const basicText = `Hello, this is a test of the ${config.name} Text to Speech API. It sounds quite natural, doesn't it?`;
      const basicAudio = await client.synthToBytes(basicText);
      console.log(`Generated basic audio: ${basicAudio.length} bytes`);

      // Test 2: SSML synthesis (skip for engines that don't support it)
      if (!['elevenlabs', 'sherpaonnx', 'openai', 'playht'].includes(config.name)) {
        console.log('\n--- Test 2: SSML Synthesis ---');
        const ssmlText = `<speak>This is an example of <emphasis level="strong">SSML</emphasis> synthesis with ${config.name}. <break time="500ms"/> It supports various SSML tags like <prosody rate="slow">changing the speech rate</prosody>.</speak>`;
        try {
          const ssmlAudio = await client.synthToBytes(ssmlText);
          console.log(`Generated SSML audio: ${ssmlAudio.length} bytes`);
        } catch (error) {
          console.log(`SSML synthesis failed: ${error.message}`);
        }
      }

      // Test 3: Streaming synthesis
      console.log('\n--- Test 3: Streaming Synthesis ---');
      try {
        const streamText = `This is an example of streaming synthesis with ${config.name} TTS.`;
        const streamResult = await client.synthToBytestream(streamText);

        if (streamResult.audioStream) {
          const reader = streamResult.audioStream.getReader();
          let totalBytes = 0;
          let chunks = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.length;
            chunks++;
          }

          console.log(`Streaming completed: ${totalBytes} bytes in ${chunks} chunks`);

          if (streamResult.wordBoundaries && streamResult.wordBoundaries.length > 0) {
            console.log(`Word boundaries: ${streamResult.wordBoundaries.length} events`);
            streamResult.wordBoundaries.slice(0, 3).forEach((wb, i) => {
              console.log(`  ${i + 1}. "${wb.text || wb.word}" at ${wb.offset || wb.start}ms`);
            });
          }
        }
      } catch (error) {
        console.log(`Streaming synthesis failed: ${error.message}`);
      }

      // Test 4: Word boundary events
      console.log('\n--- Test 4: Word Boundary Events ---');
      try {
        const boundaryText = `This is a test of word boundary events with ${config.name} TTS.`;
        const wordBoundaries = [];

        const callback = (word, start, end) => {
          wordBoundaries.push({ word, start, end });
        };

        await client.startPlaybackWithCallbacks(boundaryText, callback);
        console.log(`Received ${wordBoundaries.length} word boundary events`);

        if (wordBoundaries.length > 0) {
          wordBoundaries.slice(0, 3).forEach((wb, i) => {
            console.log(`  ${i + 1}. "${wb.word}" at ${wb.start}s (duration: ${wb.end - wb.start}s)`);
          });
        }
      } catch (error) {
        console.log(`Word boundary events failed: ${error.message}`);
      }

      console.log(`\n${config.name.toUpperCase()} comprehensive example completed!`);

    } catch (error) {
      console.error(`Error in comprehensive example for ${config.name}:`, error.message);
    }
  }
}

/**
 * Run debug mode (replaces debug-sherpaonnx.cjs)
 */
async function runDebugMode(engineConfigs, targetEngine = null) {
  console.log('Running debug mode for troubleshooting engines...\n');

  const configsToTest = targetEngine
    ? [getEngineConfig(targetEngine, engineConfigs)].filter(Boolean)
    : [getEngineConfig('sherpaonnx', engineConfigs)].filter(Boolean); // Default to SherpaOnnx

  for (const config of configsToTest) {
    console.log(`\n=== Debug Mode: ${config.name} ===`);

    // Environment check
    console.log('\n--- Environment Variables ---');
    if (config.name === 'sherpaonnx') {
      console.log('DYLD_LIBRARY_PATH:', process.env.DYLD_LIBRARY_PATH || '(not set)');
      console.log('LD_LIBRARY_PATH:', process.env.LD_LIBRARY_PATH || '(not set)');
      console.log('PATH:', process.env.PATH ? '(set)' : '(not set)');
    }

    // Package check
    console.log('\n--- Package Check ---');
    try {
      if (config.name === 'sherpaonnx') {
        const sherpaOnnxNode = await import('sherpa-onnx-node');
        console.log('sherpa-onnx-node: ✓ Loaded successfully');
        console.log('Available exports:', Object.keys(sherpaOnnxNode));
      }
    } catch (error) {
      console.log(`Package load error: ${error.message}`);
    }

    // Client creation
    console.log('\n--- Client Creation ---');
    try {
      const client = config.factory();
      console.log(`${config.name} client: ✓ Created successfully`);

      // Credentials check
      console.log('\n--- Credentials Check ---');
      const credentialsValid = await client.checkCredentials();
      console.log(`Credentials: ${credentialsValid ? '✓ Valid' : '✗ Invalid'}`);

      if (credentialsValid) {
        // Voice check
        console.log('\n--- Voice Check ---');
        const voices = await client.getVoices();
        console.log(`Voices: ✓ Found ${voices.length} voices`);

        // Basic synthesis test
        console.log('\n--- Basic Synthesis Test ---');
        const testText = `This is a debug test of the ${config.name} TTS engine.`;
        const audioBytes = await client.synthToBytes(testText);
        console.log(`Synthesis: ✓ Generated ${audioBytes.length} bytes`);
      }

    } catch (error) {
      console.error(`Debug error for ${config.name}:`, error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

/**
 * Run streaming mode with real-time playback (replaces playht-stream-test.mjs)
 */
async function runStreamMode(engineConfigs, targetEngine = null) {
  console.log('Running streaming mode with real-time playback...\n');

  const configsToTest = targetEngine
    ? [getEngineConfig(targetEngine, engineConfigs)].filter(Boolean)
    : [getEngineConfig('playht', engineConfigs)].filter(Boolean); // Default to PlayHT

  for (const config of configsToTest) {
    console.log(`\n=== Streaming Mode: ${config.name} ===`);

    try {
      const client = config.factory();

      // Check credentials
      const credentialsValid = await client.checkCredentials();
      if (!credentialsValid) {
        console.log(`Skipping ${config.name} - invalid credentials`);
        continue;
      }

      const streamText = `Hello world, this is a real-time streaming test using ${config.name}.`;
      console.log(`Streaming text: "${streamText}"`);

      // Get streaming audio
      const streamResult = await client.synthToBytestream(streamText);

      if (!streamResult.audioStream) {
        console.log('No audio stream received');
        continue;
      }

      console.log('✓ Audio stream received');

      // Check if ffplay is available for real-time playback
      const shouldPlayAudio = process.env.PLAY_AUDIO === 'true';

      if (shouldPlayAudio) {
        console.log('Attempting real-time playback with ffplay...');

        try {
          const { spawn } = await import('child_process');
          const ffplayProcess = spawn('ffplay', ['-autoexit', '-nodisp', '-i', 'pipe:0'], {
            stdio: ['pipe', 'pipe', 'pipe']
          });

          // Pipe the stream to ffplay
          const reader = streamResult.audioStream.getReader();

          const pump = async () => {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                ffplayProcess.stdin.end();
                break;
              }
              if (!ffplayProcess.stdin.write(value)) {
                await new Promise(resolve => ffplayProcess.stdin.once('drain', resolve));
              }
            }
          };

          pump().catch(err => {
            console.error('Error pumping stream:', err.message);
            if (!ffplayProcess.killed) ffplayProcess.kill();
          });

          ffplayProcess.on('close', (code) => {
            console.log(`ffplay exited with code ${code}`);
          });

          ffplayProcess.on('error', (err) => {
            console.error('ffplay error (is it installed?):', err.message);
          });

        } catch (error) {
          console.log('Real-time playback failed:', error.message);
          console.log('Install ffplay for real-time audio playback');
        }
      } else {
        // Just consume the stream
        const reader = streamResult.audioStream.getReader();
        let totalBytes = 0;
        let chunks = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          totalBytes += value.length;
          chunks++;
        }

        console.log(`Stream consumed: ${totalBytes} bytes in ${chunks} chunks`);
        console.log('Set PLAY_AUDIO=true for real-time playback');
      }

    } catch (error) {
      console.error(`Streaming error for ${config.name}:`, error.message);
    }
  }
}

/**
 * Main function
 */
async function main() {
  const { engine, mode, showHelp } = parseArgs();

  if (showHelp) {
    await showHelpInfo();
    return;
  }

  console.log('='.repeat(60));
  console.log('Unified TTS Test Runner');
  console.log('='.repeat(60));
  console.log(`Mode: ${mode}`);
  console.log(`Engine: ${engine || 'all'}`);
  console.log('');

  const engineConfigs = await getEngineConfigs();

  // Validate engine if specified
  if (engine && !getEngineConfig(engine, engineConfigs)) {
    console.error(`Unknown engine: ${engine}`);
    console.log('Run with --help to see available engines.');
    process.exit(1);
  }

  // Run tests based on mode
  switch (mode) {
    case 'basic':
      await runBasicTests(engineConfigs, engine);
      break;
    case 'playback':
      await runPlaybackTests(engineConfigs, engine);
      break;
    case 'features':
      await runFeatureTests(engineConfigs, engine);
      break;
    case 'audio':
      await runAudioTests(engineConfigs, engine);
      break;
    case 'example':
      await runExampleMode(engineConfigs, engine);
      break;
    case 'debug':
      await runDebugMode(engineConfigs, engine);
      break;
    case 'stream':
      await runStreamMode(engineConfigs, engine);
      break;
    default:
      console.error(`Unknown mode: ${mode}`);
      console.log('Available modes: basic, playback, features, audio, example, debug, stream');
      process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('All tests completed');
  console.log('='.repeat(60));
}

// Run the main function
main().catch(console.error);
