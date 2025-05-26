/**
 * Shared test utilities for TTS testing
 * This module provides common testing functions used across different test scripts.
 */

import fs from "node:fs";
import path from "node:path";

// Common test texts
export const TEST_TEXTS = {
  plain: "This is a test of the text to speech engine. Testing one two three.",
  ssml: "<speak>This is a test of the <emphasis>text to speech</emphasis> engine with <break time='500ms'/> SSML.</speak>",
  playback: "This is a test of playback control methods. We will pause, resume, and stop this audio.",
  callback: "This text will be used to test word boundary callbacks with each word highlighted as it's spoken.",
  long: "Hello world. This is a test of word boundary events. Testing one two three four five."
};

/**
 * Ensure output directory exists
 * @param {string} outputDir - Path to output directory
 */
export function ensureOutputDir(outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

/**
 * Parse command line arguments for engine selection
 * @param {Array} argv - Process arguments
 * @returns {string|null} Engine name to test, or null to test all engines
 */
export function parseEngineArg(argv = process.argv) {
  const args = argv.slice(2);
  
  // If --help or -h is provided, return special value
  if (args.includes('--help') || args.includes('-h')) {
    return 'help';
  }
  
  // If an engine name is provided, return it
  if (args.length > 0) {
    return args[0].toLowerCase();
  }
  
  // Otherwise, return null to test all engines
  return null;
}

/**
 * Test a single engine with comprehensive checks
 * @param {string} engineName - Name of the engine
 * @param {Object} client - TTS client instance
 * @param {Object} options - Test options
 */
export async function testEngine(engineName, client, options = {}) {
  const {
    outputDir = "./test-output",
    testFormats = ['wav', 'mp3'],
    testSSML = true,
    testPlayback = false,
    skipCredentials = false
  } = options;

  if (!client) {
    console.log(`Skipping ${engineName} - client not initialized`);
    return;
  }

  try {
    // Check credentials first
    if (!skipCredentials) {
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
    }

    console.log(`Testing ${engineName}...`);

    // Get available voices
    console.log(`Fetching voices for ${engineName}...`);
    const voices = await client.getVoices();
    if (voices.length === 0) {
      console.log(`No voices available for ${engineName}`);
      return;
    }

    // Select appropriate voice
    let voice = selectVoice(voices, engineName);
    console.log(`Using voice: ${voice.name} (${voice.id})`);

    // Test different formats and input types
    await testFormatAndInput(engineName, client, voice.id, {
      outputDir,
      testFormats,
      testSSML,
      testPlayback
    });

  } catch (error) {
    console.error(`Error testing ${engineName}:`, error.message, '\n');
  }
}

/**
 * Select appropriate voice for testing
 * @param {Array} voices - Available voices
 * @param {string} engineName - Name of the engine
 * @returns {Object} Selected voice
 */
function selectVoice(voices, engineName) {
  // For Polly, use a standard voice that supports SSML
  if (engineName === 'polly') {
    const standardVoices = ['Geraint', 'Raveena', 'Aditi', 'Ivy', 'Joanna', 'Kendra'];
    for (const standardVoice of standardVoices) {
      const foundVoice = voices.find(v => v.id === standardVoice);
      if (foundVoice) {
        return foundVoice;
      }
    }
  }
  
  // Use the first voice for other engines
  return voices[0];
}

/**
 * Test different formats and input types
 * @param {string} engineName - Name of the engine
 * @param {Object} client - TTS client instance
 * @param {string} voiceId - Voice ID to use
 * @param {Object} options - Test options
 */
async function testFormatAndInput(engineName, client, voiceId, options = {}) {
  const {
    outputDir = "./test-output",
    testFormats = ['wav'],
    testSSML = true,
    testPlayback = false
  } = options;

  ensureOutputDir(outputDir);

  // Test plain text with different formats
  for (const format of testFormats) {
    try {
      const outputFile = path.join(outputDir, `${engineName}-plain-${format}.${format}`);
      console.log(`Synthesizing plain text to ${format.toUpperCase()}: ${outputFile}...`);
      await client.synthToFile(TEST_TEXTS.plain, outputFile, format, { voice: voiceId });
      const stats = fs.statSync(outputFile);
      console.log(`Generated ${format.toUpperCase()} file: ${stats.size} bytes`);
    } catch (error) {
      console.error(`Error generating ${format.toUpperCase()} for ${engineName}:`, error.message);
    }
  }

  // Test SSML if enabled
  if (testSSML) {
    try {
      const outputFile = path.join(outputDir, `${engineName}-ssml-wav.wav`);
      console.log(`Synthesizing SSML to WAV: ${outputFile}...`);
      await client.synthToFile(TEST_TEXTS.ssml, outputFile, 'wav', { voice: voiceId });
      const stats = fs.statSync(outputFile);
      console.log(`Generated SSML WAV file: ${stats.size} bytes`);
    } catch (error) {
      console.error(`Error generating SSML WAV for ${engineName}:`, error.message);
    }
  }

  // Test audio playback if enabled
  if (testPlayback) {
    await testAudioPlayback(engineName, client, voiceId);
  }

  console.log(`Completed tests for ${engineName}\n`);
}

/**
 * Test audio playback functionality
 * @param {string} engineName - Name of the engine
 * @param {Object} client - TTS client instance
 * @param {string} voiceId - Voice ID to use
 */
async function testAudioPlayback(engineName, client, voiceId) {
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
      await client.speak(TEST_TEXTS.plain, { voice: voiceId });

      // Wait a bit before the next playback
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Test SSML playback
      console.log(`Playing SSML for ${engineName}...`);
      await client.speak(TEST_TEXTS.ssml, { voice: voiceId });
    } else {
      console.log(`Skipping audio playback (set PLAY_AUDIO=true to enable)`);
    }
  } catch (playbackError) {
    console.error(`Error during audio playback for ${engineName}:`, playbackError.message);
  }
}

/**
 * Test playback control methods
 * @param {Object} client - TTS client instance
 * @param {Object} options - Test options
 */
export async function testPlaybackControl(client, options = {}) {
  const { shouldPlayAudio = process.env.PLAY_AUDIO === 'true' } = options;

  console.log(`Audio playback is ${shouldPlayAudio ? 'ENABLED' : 'DISABLED'} (set PLAY_AUDIO=true to enable)`);

  // Test 1: Basic playback with pause/resume/stop
  console.log("\n=== Test 1: Basic Playback with Pause/Resume/Stop ===");
  console.log("Text:", TEST_TEXTS.playback);

  try {
    // Start playback
    console.log("Starting playback...");
    const playPromise = client.speak(TEST_TEXTS.playback);

    // Pause after 2 seconds
    setTimeout(() => {
      console.log("Pausing playback...");
      client.pause();
    }, 2000);

    // Resume after 4 seconds
    setTimeout(() => {
      console.log("Resuming playback...");
      client.resume();
    }, 4000);

    // Stop after 6 seconds
    setTimeout(() => {
      console.log("Stopping playback...");
      client.stop();
    }, 6000);

    // Wait for the original promise to complete
    try {
      await playPromise;
    } catch (error) {
      // It's expected that the promise might reject if we stopped playback
      console.log("Playback was interrupted as expected");
    }

    console.log("Test 1 completed");
  } catch (error) {
    console.error("Error in Test 1:", error);
  }

  // Wait a bit before the next test
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Word boundary callbacks
  console.log("\n=== Test 2: Word Boundary Callbacks ===");
  console.log("Text:", TEST_TEXTS.callback);

  try {
    // Create a word boundary callback
    const wordBoundaries = [];
    const callback = (word, start, end) => {
      wordBoundaries.push({ word, start, end });
      console.log(`Word boundary callback: "${word}" at ${start}s (duration: ${end - start}s)`);
    };

    // Start playback with callbacks
    console.log("Starting playback with callbacks...");
    await client.startPlaybackWithCallbacks(TEST_TEXTS.callback, callback);

    // Print summary of word boundaries
    console.log(`Received ${wordBoundaries.length} word boundary events`);
    console.log("Test 2 completed");
  } catch (error) {
    console.error("Error in Test 2:", error);
  }
}
