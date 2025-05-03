#!/usr/bin/env node

// CLI Example: Load all TTS engines, let user pick engine/voice, read a sentence, and highlight each word as spoken.
// Minimal dependencies, uses js-tts-wrapper public API only.

import readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';

const ENGINES = [
  { name: 'azure', loader: async () => (await import('../dist/esm/engines/azure.js')).AzureTTSClient },
  { name: 'elevenlabs', loader: async () => (await import('../dist/esm/engines/elevenlabs.js')).ElevenLabsTTSClient },
  { name: 'google', loader: async () => (await import('../dist/esm/engines/google.js')).GoogleTTSClient },
  { name: 'openai', loader: async () => (await import('../dist/esm/engines/openai.js')).OpenAITTSClient },
  { name: 'playht', loader: async () => (await import('../dist/esm/engines/playht.js')).PlayHTTTSClient },
  { name: 'polly', loader: async () => (await import('../dist/esm/engines/polly.js')).PollyTTSClient },
  { name: 'sherpaonnx', loader: async () => (await import('../dist/esm/engines/sherpaonnx.js')).SherpaOnnxTTSClient },
  { name: 'espeak', loader: async () => (await import('../dist/esm/engines/espeak.js')).EspeakTTSClient },
];

const engineMap = {
  azure: { client: ENGINES[0].loader, options: {} },
  elevenlabs: { client: ENGINES[1].loader, options: {} },
  google: { client: ENGINES[2].loader, options: {} },
  openai: { client: ENGINES[3].loader, options: {} },
  playht: { client: ENGINES[4].loader, options: {} },
  polly: { client: ENGINES[5].loader, options: {} },
  sherpaonnx: { client: ENGINES[6].loader, options: {} },
  espeak: { client: ENGINES[7].loader, options: {} },
};

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

async function consumeStream(stream) {
  if (!stream) return;

  // Check if it's a Web ReadableStream
  if ('getReader' in stream && typeof stream.getReader === 'function') {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
        // We are just consuming, no need to process the value
      }
    } catch (error) {
      console.warn("[WARN] Error consuming Web audio stream:", error.message);
    } finally {
      reader.releaseLock();
    }
  } else if (typeof stream.on === 'function') {
    // Assume it's a Node.js Readable stream
    return new Promise((resolve, reject) => {
      stream.on('data', () => { 
        // Consume data by doing nothing with the chunk
      });
      stream.on('end', () => {
        resolve(); // Resolve promise when stream ends
      });
      stream.on('error', (err) => {
        console.warn("[WARN] Error consuming Node audio stream:", err.message);
        reject(err); // Reject promise on error
      });
      // Ensure the stream flows if it's paused
      if (typeof stream.resume === 'function') {
        stream.resume();
      }
    });
  } else {
    console.warn("[WARN] consumeStream received an unsupported stream type.");
  }
}

dotenv.config({ path: process.cwd() + '/.envrc' });

(async () => {
  console.log('Available engines:');
  ENGINES.forEach((e, i) => console.log(`${i + 1}. ${e.name}`));
  const engineIdx = parseInt(await prompt('Choose engine number: '), 10) - 1;
  if (engineIdx < 0 || engineIdx >= ENGINES.length) {
    return console.error('Invalid engine selection.');
  }
  const selectedEngineName = ENGINES[engineIdx].name;
  const EngineClient = engineMap[selectedEngineName].client;
  const engineOptions = engineMap[selectedEngineName].options || {};

  // Prepare credentials or options
  let clientOptions = engineOptions; // Start with default options

  // --- Engine-Specific Credential Loading --- 
  if (selectedEngineName === 'polly') {
    if (!process.env.POLLY_REGION || !process.env.POLLY_AWS_KEY_ID || !process.env.POLLY_AWS_ACCESS_KEY) {
      console.error('Error: POLLY_REGION, POLLY_AWS_KEY_ID, and POLLY_AWS_ACCESS_KEY environment variables are required for the polly engine.');
      process.exit(1); // Exit if credentials are missing
    }
    clientOptions = {
      region: process.env.POLLY_REGION,
      accessKeyId: process.env.POLLY_AWS_KEY_ID,
      secretAccessKey: process.env.POLLY_AWS_ACCESS_KEY,
    };
  } else if (selectedEngineName === 'elevenlabs') {
    // Example: Add similar logic for other engines if needed
    if (!process.env.ELEVENLABS_API_KEY) {
      console.error('Error: ELEVENLABS_API_KEY environment variable is required for the elevenlabs engine.');
      process.exit(1);
    }
    clientOptions = { apiKey: process.env.ELEVENLABS_API_KEY };
  } else if (selectedEngineName === 'azure') {
    if (!process.env.MICROSOFT_REGION || !process.env.MICROSOFT_TOKEN) {
      console.error('Error: MICROSOFT_REGION and MICROSOFT_TOKEN environment variables are required for the azure engine.');
      process.exit(1);
    }
    clientOptions = {
      region: process.env.MICROSOFT_REGION,
      subscriptionKey: process.env.MICROSOFT_TOKEN,
    };
  } else if (selectedEngineName === 'playht') { // Example for PlayHT
    if (!process.env.PLAYHT_USER_ID || !process.env.PLAYHT_API_KEY) {
      console.error('Error: PLAYHT_USER_ID and PLAYHT_API_KEY environment variables are required for the playht engine.');
      process.exit(1);
    }
    clientOptions = {
      userId: process.env.PLAYHT_USER_ID,
      apiKey: process.env.PLAYHT_API_KEY,
    };
  } // Add others like Google if they need specific keys not handled by default env vars

  try {
    // Instantiate the client using the determined class and options/credentials
    const ClientClass = await EngineClient(); // CALL the loader function and await its result
    const client = new ClientClass(clientOptions); // Instantiate the class
    // List voices (if supported)
    let voices = [{ id: 'default', name: 'Default' }];
    // Use getVoices/_getVoices for all engines
    if (client.getVoices) {
      try {
        voices = await client.getVoices();
      } catch (e) {
        console.error('Error getting voices:', e);
      }
    } else if (client._getVoices) {
      try {
        voices = await client._getVoices();
      } catch (e) {
        console.error('Error getting voices:', e);
      }
    }
    console.log('DEBUG: About to print voices:', voices.length);
    if (voices.length === 0 && selectedEngineName === 'playht' && e?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      console.warn('Warning: Could not connect to PlayHT API to fetch voices. Please check network connection or try again later.');
    }
    voices.slice(0, 20).forEach((v, i) => console.log(`${i + 1}. ${v.name || v.id}`));
    if (voices.length > 20) {
      console.log(`...and ${voices.length - 20} more voices not shown.`);
    }
    console.log('DEBUG: About to prompt for voice number');
    const voiceIdx = parseInt(await prompt('Choose voice number: '), 10) - 1;
    console.log('DEBUG: Voice index selected:', voiceIdx);
    const voiceObj = voices[voiceIdx] || voices[0];
    const voice = voiceObj.id || voiceObj.name || 'default';
    if (ENGINES[engineIdx].name === 'espeak') {
      console.log('[DEBUG] Selected espeak-ng voice object:', voiceObj);
    }

    const text = await prompt('Enter text to read: ');
    console.log('Speaking and highlighting...');

    let marks = [];

    try {
      // --- Universal Call to synthToBytestream --- 
      console.log(`[DEBUG] Calling synthToBytestream for ${selectedEngineName}...`);
      const { audioStream, wordBoundaries } = await client.synthToBytestream(text, { voice });

      // Store boundaries if received
      marks = wordBoundaries || [];
      console.log(`[DEBUG] Received ${marks.length} word boundaries.`);

      // Consume the audio stream (important for completion, even if not playing)
      console.log('[DEBUG] Consuming audio stream...');
      await consumeStream(audioStream);
      console.log('[DEBUG] Audio stream consumed.');

    } catch (err) {
      console.error(`Error during ${selectedEngineName} synthToBytestream: ${err.message}`);
      // Optionally fallback to estimated marks on error?
      // Or just proceed with empty marks
      marks = [];
    }

    // --- Highlight words as spoken --- 
    if (marks && marks.length > 0) {
      console.log('[DEBUG] Starting highlighting loop with received boundaries...');
      let lastOffset = 0;
      // Prepare words from original text for matching/display
      // This regex splits by whitespace while keeping it, useful for reconstructing the line.
      const wordsInText = text.split(/(\s+)/);

      for (let i = 0; i < marks.length; i++) {
        const mark = marks[i];
        // Ensure offset is a number and calculate delay
        const currentOffset = typeof mark.offset === 'number' ? mark.offset : (lastOffset + 400); // Fallback offset
        const delay = Math.max(0, currentOffset - lastOffset); // Ensure delay isn't negative
        lastOffset = currentOffset;

        if (delay > 0) {
          await new Promise(res => setTimeout(res, delay));
        }

        // Find and highlight the word based on mark.text
        // Note: Simple matching, might fail with punctuation or repeated words.
        let highlighted = false;
        const highlightedText = wordsInText.map(w => {
          if (!highlighted && w === mark.text) {
            highlighted = true;
            return `\x1b[43m\x1b[30m${w}\x1b[0m`; // Yellow background, black text
          }
          return w;
        }).join('');

        process.stdout.write(`\r${highlightedText}   `);
      }
      process.stdout.write('\nDone!\n');
    } else {
      // --- Fallback Highlighting (if no boundaries received) --- 
      console.log('[INFO] No word boundaries received. Using estimated timing for highlighting.');
      const words = text.split(/\s+/).filter(w => w.length > 0);
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const highlightedText = words.map((w, idx) => 
          idx === i ? `\x1b[43m\x1b[30m${w}\x1b[0m` : w
        ).join(' ');
        process.stdout.write(`\r${highlightedText}   `);
        await new Promise(res => setTimeout(res, 400)); // Fixed delay
      }
      process.stdout.write('\nDone!\n');
    }
  } catch (err) {
    console.error('Error in main execution:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
  }
})();
