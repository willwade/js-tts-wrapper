// Unified example for all TTS engines
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AzureTTSClient,
  ElevenLabsTTSClient,
  GoogleTTSClient,
  OpenAITTSClient,
  PlayHTTTSClient,
  PollyTTSClient,
  SherpaOnnxTTSClient,
  WatsonTTSClient,
  WitAITTSClient,
} from "../dist/esm/index.js";

// Load environment variables
dotenv.config();

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get engine name from command line arguments
const engineName = process.argv[2]?.toLowerCase() || "all";
const validEngines = ["azure", "elevenlabs", "google", "openai", "playht", "polly", "sherpaonnx", "watson", "witai", "all"];

if (!validEngines.includes(engineName)) {
  console.error(`Error: Invalid engine name. Valid options are: ${validEngines.join(", ")}`);
  process.exit(1);
}

// Create TTS client based on engine name
async function createTTSClient(engine) {
  let client = null;

  try {
    switch (engine) {
      case "azure":
        if (!process.env.MICROSOFT_TOKEN || !process.env.MICROSOFT_REGION) {
          console.error(
            "Error: MICROSOFT_TOKEN and MICROSOFT_REGION environment variables are required for Azure TTS"
          );
          return null;
        }
        client = new AzureTTSClient({
          subscriptionKey: process.env.MICROSOFT_TOKEN,
          region: process.env.MICROSOFT_REGION,
        });
        break;

      case "elevenlabs":
        if (!process.env.ELEVENLABS_API_KEY) {
          console.error(
            "Error: ELEVENLABS_API_KEY environment variable is required for ElevenLabs TTS"
          );
          return null;
        }
        client = new ElevenLabsTTSClient({
          apiKey: process.env.ELEVENLABS_API_KEY,
        });
        break;

      case "google":
        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_SA_PATH) {
          console.error(
            "Error: GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SA_PATH environment variable is required for Google TTS"
          );
          return null;
        }
        client = new GoogleTTSClient({
          keyFilename: process.env.GOOGLE_SA_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });
        break;

      case "polly":
        if (
          !process.env.POLLY_AWS_KEY_ID ||
          !process.env.POLLY_AWS_ACCESS_KEY ||
          !process.env.POLLY_REGION
        ) {
          console.error(
            "Error: POLLY_AWS_KEY_ID, POLLY_AWS_ACCESS_KEY, and POLLY_REGION environment variables are required for AWS Polly TTS"
          );
          return null;
        }
        client = new PollyTTSClient({
          region: process.env.POLLY_REGION,
          accessKeyId: process.env.POLLY_AWS_KEY_ID,
          secretAccessKey: process.env.POLLY_AWS_ACCESS_KEY,
        });
        break;

      case "openai":
        if (!process.env.OPENAI_API_KEY) {
          console.error(
            "Error: OPENAI_API_KEY environment variable is required for OpenAI TTS"
          );
          return null;
        }
        client = new OpenAITTSClient({
          apiKey: process.env.OPENAI_API_KEY,
        });
        break;

      case "playht":
        if (!process.env.PLAYHT_API_KEY || !process.env.PLAYHT_USER_ID) {
          console.error(
            "Error: PLAYHT_API_KEY and PLAYHT_USER_ID environment variables are required for PlayHT TTS"
          );
          return null;
        }
        client = new PlayHTTTSClient({
          apiKey: process.env.PLAYHT_API_KEY,
          userId: process.env.PLAYHT_USER_ID,
        });
        break;

      case "sherpaonnx":
        // SherpaOnnx doesn't require credentials, but it will download models automatically
        client = new SherpaOnnxTTSClient({});
        break;

      case "watson":
        if (!process.env.WATSON_API_KEY || !process.env.WATSON_REGION || !process.env.WATSON_INSTANCE_ID) {
          console.error(
            "Error: WATSON_API_KEY, WATSON_REGION, and WATSON_INSTANCE_ID environment variables are required for IBM Watson TTS"
          );
          return null;
        }
        client = new WatsonTTSClient({
          apiKey: process.env.WATSON_API_KEY,
          region: process.env.WATSON_REGION,
          instanceId: process.env.WATSON_INSTANCE_ID,
        });
        break;

      case "witai":
        if (!process.env.WITAI_TOKEN) {
          console.error(
            "Error: WITAI_TOKEN environment variable is required for WitAI TTS"
          );
          return null;
        }
        client = new WitAITTSClient({
          token: process.env.WITAI_TOKEN,
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
    console.log("Fetching available voices...");
    const voices = await client.getVoices();
    console.log(`Found ${voices.length} voices`);

    // Print the first few voices
    for (const voice of voices.slice(0, 3)) {
      console.log(`- ${voice.name} (${voice.id}): ${voice.languageCodes[0].display}`);
    }

    // Get English voices
    const enVoices = await client.getVoicesByLanguage("en-US");
    console.log(`\nFound ${enVoices.length} English (US) voices`);

    // Select a voice
    if (enVoices.length > 0) {
      const voiceId = enVoices[0].id;
      console.log(`\nUsing voice: ${enVoices[0].name}`);

      // Set the voice
      client.setVoice(voiceId);
    } else {
      console.log("\nNo English voices found, using default voice");
    }

    // Special settings for OpenAI
    if (engine === "openai") {
      console.log("\nSetting OpenAI-specific properties...");
      // Set the model (defaults to gpt-4o-mini-tts)
      client.setProperty("model", "gpt-4o-mini-tts");
      console.log("Model set to: gpt-4o-mini-tts");

      // Set instructions for the TTS engine
      client.setProperty("instructions", "Speak in a friendly and clear tone.");
      console.log("Instructions set for natural speech");

      // Set the response format
      client.setProperty("responseFormat", "mp3");
      console.log("Response format set to: mp3");
    }

    // Special settings for PlayHT
    if (engine === "playht") {
      console.log("\nSetting PlayHT-specific properties...");
      // Set the voice engine (defaults to PlayHT1.0)
      client.setProperty("voiceEngine", "PlayHT1.0");
      console.log("Voice engine set to: PlayHT1.0");

      // Set the output format
      client.setProperty("outputFormat", "wav");
      console.log("Output format set to: wav");
    }

    // Special settings for Google TTS
    if (engine === "google") {
      console.log("\nSetting Google-specific properties...");

      // Find a voice that supports SSML (Standard or Wavenet voices)
      const ssmlVoices = enVoices.filter(voice => voice.id.includes("Standard") || voice.id.includes("Wavenet"));
      if (ssmlVoices.length > 0) {
        const ssmlVoice = ssmlVoices[0];
        console.log(`Switching to voice that supports SSML: ${ssmlVoice.name}`);
        client.setVoice(ssmlVoice.id);
      }
    }

    // Special settings for Azure TTS
    if (engine === "azure") {
      console.log("\nSetting Azure-specific properties...");

      // Find a multilingual neural voice for better quality and word boundary support
      const multilingualVoices = enVoices.filter(voice => voice.id.includes("MultilingualNeural"));
      if (multilingualVoices.length > 0) {
        const multilingualVoice = multilingualVoices[0];
        console.log(`Switching to multilingual voice with word boundary support: ${multilingualVoice.name}`);
        client.setVoice(multilingualVoice.id);
      } else {
        // Fall back to any neural voice
        const neuralVoices = enVoices.filter(voice => voice.id.includes("Neural"));
        if (neuralVoices.length > 0) {
          const neuralVoice = neuralVoices[0];
          console.log(`Switching to neural voice: ${neuralVoice.name}`);
          client.setVoice(neuralVoice.id);
        }
      }
    }

    // Convert text to speech
    console.log("\nConverting text to speech...");
    const text = `Hello, this is a test of the ${engine} Text to Speech API. It sounds quite natural, doesn't it?`;
    const outputPath = path.join(__dirname, `${engine}-output.mp3`);

    // Synthesize speech
    const audioBytes = await client.synthToBytes(text, {
      format: "mp3",
    });

    // Save to file
    fs.writeFileSync(outputPath, Buffer.from(audioBytes));
    console.log(`Speech saved to ${outputPath}`);

    // Example with SSML (skip for engines that don't support SSML)
    if (engine !== "elevenlabs" && engine !== "sherpaonnx" && engine !== "openai" && engine !== "playht") {
      console.log("\nConverting SSML to speech...");
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
          format: "mp3",
        });

        // Save to file
        fs.writeFileSync(ssmlOutputPath, Buffer.from(ssmlAudioBytes));
        console.log(`SSML speech saved to ${ssmlOutputPath}`);
      } catch (error) {
        console.error("Error synthesizing SSML:", error.message);
      }
    }

    // Example with streaming
    console.log("\nConverting text to speech using streaming...");
    const streamingText = `This is an example of streaming synthesis with ${engine} TTS.`;
    const streamingOutputPath = path.join(__dirname, `${engine}-streaming-output.mp3`);

    try {
      // Get streaming audio
      const streamResult = await client.synthToBytestream(streamingText, {
        format: "mp3",
        useWordBoundary: true, // Request word boundaries
      });

      // Process the stream
      let stream;
      let wordBoundaries = [];

      if ("audioStream" in streamResult) {
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
        console.log("\nWord boundaries:");
        if (engine === "openai") {
          // OpenAI uses a different word boundary format
          for (const wb of wordBoundaries.slice(0, 5)) {
            console.log(`- "${wb.word}" at ${wb.start}s (duration: ${wb.end - wb.start}s)`);
          }
        } else {
          // Standard format for other engines
          for (const wb of wordBoundaries.slice(0, 5)) {
            console.log(
              `- "${wb.text}" at ${wb.offset / 10000}s (duration: ${wb.duration / 10000}s)`
            );
          }
        }
        if (wordBoundaries.length > 5) {
          console.log(`... and ${wordBoundaries.length - 5} more`);
        }
      }
    } catch (error) {
      console.error("Error with streaming synthesis:", error.message);
    }

    // Example with word boundary events
    console.log("\nTesting word boundary events...");
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
        console.log("First few word boundaries:");
        for (const wb of wordBoundaries.slice(0, 5)) {
          console.log(`- "${wb.word}" at ${wb.start}s (duration: ${wb.end - wb.start}s)`);
        }
        if (wordBoundaries.length > 5) {
          console.log(`... and ${wordBoundaries.length - 5} more`);
        }
      }
    } catch (error) {
      console.error("Error with word boundary events:", error.message);
    }

    console.log(`\n${engine.toUpperCase()} example completed successfully!`);
  } catch (error) {
    console.error(`Error running ${engine} example:`, error);
  }
}

// Main function to run examples
async function runExamples() {
  if (engineName === "all") {
    // Run examples for all engines
    for (const engine of ["azure", "elevenlabs", "google", "polly", "sherpaonnx", "watson", "witai"]) {
      await runEngineExample(engine);
    }
  } else {
    // Run example for specific engine
    await runEngineExample(engineName);
  }
}

// Run the examples
runExamples();
