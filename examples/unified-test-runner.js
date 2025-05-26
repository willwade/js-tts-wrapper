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
 *
 * Examples:
 *   node examples/unified-test-runner.js                    # Test all engines (basic mode)
 *   node examples/unified-test-runner.js azure             # Test Azure engine only
 *   node examples/unified-test-runner.js --mode=playback   # Test playback controls for all engines
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
    default:
      console.error(`Unknown mode: ${mode}`);
      console.log('Available modes: basic, playback, features, audio');
      process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('All tests completed');
  console.log('='.repeat(60));
}

// Run the main function
main().catch(console.error);
