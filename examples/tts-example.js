// Unified example for all TTS engines
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  AzureTTSClient,
  ElevenLabsTTSClient,
  GoogleTTSClient
} = require('../dist');

// Get engine name from command line arguments
const engineName = process.argv[2]?.toLowerCase() || 'all';
const validEngines = ['azure', 'elevenlabs', 'google', 'all'];

if (!validEngines.includes(engineName)) {
  console.error(`Error: Invalid engine name. Valid options are: ${validEngines.join(', ')}`);
  process.exit(1);
}

// Create TTS client based on engine name
async function createTTSClient(engine) {
  let client = null;

  try {
    switch (engine) {
      case 'azure':
        if (!process.env.MICROSOFT_TOKEN || !process.env.MICROSOFT_REGION) {
          console.error('Error: MICROSOFT_TOKEN and MICROSOFT_REGION environment variables are required for Azure TTS');
          return null;
        }
        client = new AzureTTSClient({
          subscriptionKey: process.env.MICROSOFT_TOKEN,
          region: process.env.MICROSOFT_REGION,
        });
        break;

      case 'elevenlabs':
        if (!process.env.ELEVENLABS_API_KEY) {
          console.error('Error: ELEVENLABS_API_KEY environment variable is required for ElevenLabs TTS');
          return null;
        }
        client = new ElevenLabsTTSClient({
          apiKey: process.env.ELEVENLABS_API_KEY,
        });
        break;

      case 'google':
        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_SA_PATH) {
          console.error('Error: GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SA_PATH environment variable is required for Google TTS');
          return null;
        }
        client = new GoogleTTSClient({
          keyFilename: process.env.GOOGLE_SA_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });
        break;

      default:
        console.error(`Unknown engine: ${engine}`);
        return null;
    }

    // Check if credentials are valid
    if (client) {
      console.log(`Checking ${engine} credentials...`);
      const credentialsValid = await client.checkCredentials();
      if (!credentialsValid) {
        console.error(`${engine} credentials are invalid or service is unavailable`);
        return null;
      }
      console.log(`${engine} credentials are valid`);
    }

    return client;
  } catch (error) {
    console.error(`Error creating ${engine} client:`, error);
    return null;
  }
}

// Run example for a specific engine
async function runEngineExample(engine) {
  console.log(`\n=== Running example for ${engine.toUpperCase()} TTS ===\n`);

  const client = await createTTSClient(engine);
  if (!client) {
    console.log(`Skipping ${engine} example: credentials not available or invalid`);
    return;
  }

  try {
    // List available voices
    console.log('Fetching available voices...');
    const voices = await client.getVoices();
    console.log(`Found ${voices.length} voices`);

    // Print the first few voices
    voices.slice(0, 3).forEach(voice => {
      console.log(`- ${voice.name} (${voice.id}): ${voice.languageCodes[0].display}`);
    });

    // Get English voices
    const enVoices = await client.getVoicesByLanguage('en-US');
    console.log(`\nFound ${enVoices.length} English (US) voices`);

    // Select a voice
    if (enVoices.length > 0) {
      const voiceId = enVoices[0].id;
      console.log(`\nUsing voice: ${enVoices[0].name}`);

      // Set the voice
      client.setVoice(voiceId);
    } else {
      console.log('\nNo English voices found, using default voice');
    }

    // Convert text to speech
    console.log('\nConverting text to speech...');
    const text = `Hello, this is a test of the ${engine} Text to Speech API. It sounds quite natural, doesn't it?`;
    const outputPath = path.join(__dirname, `${engine}-output.mp3`);

    // Synthesize speech
    const audioBytes = await client.synthToBytes(text, {
      format: 'mp3',
    });

    // Save to file
    fs.writeFileSync(outputPath, Buffer.from(audioBytes));
    console.log(`Speech saved to ${outputPath}`);

    // Example with SSML (skip for ElevenLabs which doesn't support SSML)
    if (engine !== 'elevenlabs') {
      console.log('\nConverting SSML to speech...');
      const ssml = `
        <speak>
          This is an example of <emphasis level="strong">SSML</emphasis> synthesis with ${engine}.
          <break time="500ms"/>
          It supports various SSML tags like <prosody rate="slow">changing the speech rate</prosody>,
          or <prosody pitch="+2st">adjusting the pitch</prosody>.
        </speak>
      `;
      const ssmlOutputPath = path.join(__dirname, `${engine}-ssml-output.mp3`);

      try {
        // Synthesize SSML
        const ssmlAudioBytes = await client.synthToBytes(ssml, {
          format: 'mp3',
        });

        // Save to file
        fs.writeFileSync(ssmlOutputPath, Buffer.from(ssmlAudioBytes));
        console.log(`SSML speech saved to ${ssmlOutputPath}`);
      } catch (error) {
        console.error('Error synthesizing SSML:', error.message);
      }
    }

    // Example with streaming
    console.log('\nConverting text to speech using streaming...');
    const streamingText = `This is an example of streaming synthesis with ${engine} TTS.`;
    const streamingOutputPath = path.join(__dirname, `${engine}-streaming-output.mp3`);

    try {
      // Get streaming audio
      const streamResult = await client.synthToBytestream(streamingText, {
        format: 'mp3',
        useWordBoundary: true, // Request word boundaries
      });

      // Process the stream
      let stream;
      let wordBoundaries = [];

      if ('audioStream' in streamResult) {
        stream = streamResult.audioStream;
        wordBoundaries = streamResult.wordBoundaries;
        console.log(`Received ${wordBoundaries.length} word boundaries`);
      } else {
        stream = streamResult;
      }

      // Read the stream
      const reader = stream.getReader();
      const chunks = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      // Combine chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const streamingAudioBytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        streamingAudioBytes.set(chunk, offset);
        offset += chunk.length;
      }

      // Save to file
      fs.writeFileSync(streamingOutputPath, Buffer.from(streamingAudioBytes));
      console.log(`Streaming speech saved to ${streamingOutputPath}`);

      // Print word boundaries if available
      if (wordBoundaries.length > 0) {
        console.log('\nWord boundaries:');
        wordBoundaries.slice(0, 5).forEach(wb => {
          console.log(`- "${wb.text}" at ${wb.offset / 10000}s (duration: ${wb.duration / 10000}s)`);
        });
        if (wordBoundaries.length > 5) {
          console.log(`... and ${wordBoundaries.length - 5} more`);
        }
      }
    } catch (error) {
      console.error('Error with streaming synthesis:', error.message);
    }

    // Example with word boundary events
    console.log('\nTesting word boundary events...');
    const boundaryText = `This is a test of word boundary events with ${engine} TTS.`;

    try {
      const wordBoundaries = [];

      // Create a word boundary callback
      const callback = (word, start, end) => {
        wordBoundaries.push({ word, start, end });
      };

      // Use startPlaybackWithCallbacks
      await client.startPlaybackWithCallbacks(boundaryText, callback);

      // Print word boundaries
      console.log(`Received ${wordBoundaries.length} word boundary events`);
      if (wordBoundaries.length > 0) {
        console.log('First few word boundaries:');
        wordBoundaries.slice(0, 5).forEach(wb => {
          console.log(`- "${wb.word}" at ${wb.start}s (duration: ${wb.end - wb.start}s)`);
        });
        if (wordBoundaries.length > 5) {
          console.log(`... and ${wordBoundaries.length - 5} more`);
        }
      }
    } catch (error) {
      console.error('Error with word boundary events:', error.message);
    }

    console.log(`\n${engine.toUpperCase()} example completed successfully!`);
  } catch (error) {
    console.error(`Error running ${engine} example:`, error);
  }
}

// Main function to run examples
async function runExamples() {
  if (engineName === 'all') {
    // Run examples for all engines
    for (const engine of ['azure', 'elevenlabs', 'google']) {
      await runEngineExample(engine);
    }
  } else {
    // Run example for specific engine
    await runEngineExample(engineName);
  }
}

// Run the examples
runExamples();
