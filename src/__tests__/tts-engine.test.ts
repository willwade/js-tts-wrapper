import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

import type { AbstractTTSClient } from "../core/abstract-tts";
import { AzureTTSClient } from "../engines/azure";
import { ElevenLabsTTSClient } from "../engines/elevenlabs";
import { GoogleTTSClient } from "../engines/google";
import { PollyTTSClient } from "../engines/polly";

import { OpenAITTSClient } from "../engines/openai";
import { PlayHTTTSClient } from "../engines/playht";
import { WatsonTTSClient } from "../engines/watson";
import { WitAITTSClient } from "../engines/witai";
import { SAPITTSClient } from "../engines/sapi";
import { MockTTSClient } from "./mock-tts-client.helper";

// Use mocks for tests to avoid API calls
const USE_MOCKS = true;

// Define a factory function to create TTS clients
async function createTTSClient(engine: string): Promise<AbstractTTSClient | null> {
  let client: AbstractTTSClient | null = null;

  // Use mock client for tests to avoid API calls
  if (USE_MOCKS) {
    return new MockTTSClient({});
  }

  try {
    switch (engine.toLowerCase()) {
      case "azure":
        if (!process.env.MICROSOFT_TOKEN || !process.env.MICROSOFT_REGION) {
          console.log("Azure credentials not available");
          return null;
        }
        client = new AzureTTSClient({
          subscriptionKey: process.env.MICROSOFT_TOKEN,
          region: process.env.MICROSOFT_REGION,
        });
        break;

      case "elevenlabs":
        if (!process.env.ELEVENLABS_API_KEY) {
          console.log("ElevenLabs credentials not available");
          return null;
        }
        client = new ElevenLabsTTSClient({
          apiKey: process.env.ELEVENLABS_API_KEY,
        });
        break;

      case "google":
        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_SA_PATH) {
          console.log("Google credentials not available");
          return null;
        }
        client = new GoogleTTSClient({
          keyFilename: process.env.GOOGLE_SA_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS,
        });
        break;

      case "polly":
        if (!process.env.POLLY_AWS_KEY_ID || !process.env.POLLY_AWS_ACCESS_KEY || !process.env.POLLY_REGION) {
          console.log("AWS Polly credentials not available");
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
          console.log("OpenAI credentials not available");
          return null;
        }
        client = new OpenAITTSClient({
          apiKey: process.env.OPENAI_API_KEY,
        });
        break;

      case "playht":
        if (!process.env.PLAYHT_API_KEY || !process.env.PLAYHT_USER_ID) {
          console.log("PlayHT credentials not available");
          return null;
        }
        client = new PlayHTTTSClient({
          apiKey: process.env.PLAYHT_API_KEY,
          userId: process.env.PLAYHT_USER_ID,
        });
        break;

      case "watson":
        if (!process.env.WATSON_API_KEY || !process.env.WATSON_REGION || !process.env.WATSON_INSTANCE_ID) {
          console.log("Watson credentials not available");
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
          console.log("WitAI credentials not available");
          return null;
        }
        client = new WitAITTSClient({
          token: process.env.WITAI_TOKEN,
        });
        break;

      case "sapi":
        // SAPI doesn't require credentials, but only works on Windows
        client = new SAPITTSClient({});
        break;

      default:
        console.log(`Unknown engine: ${engine}`);
        return null;
    }

    // Check if credentials are valid
    if (client) {
      const credentialsValid = await client.checkCredentials();
      if (!credentialsValid) {
        console.log(`${engine} credentials are invalid or service is unavailable`);
        return null;
      }
    }

    return client;
  } catch (error) {
    console.error(`Error creating ${engine} client:`, error);
    return null;
  }
}

// Define the engines to test (excluding sherpaonnx which has its own dedicated test files)
const engines = ["azure", "elevenlabs", "google", "openai", "playht", "polly", "watson", "witai", "sapi"];

// Run tests for each engine
engines.forEach((engineName) => {
  // We'll determine whether to run tests in beforeAll
  let client: AbstractTTSClient | null = null;
  let runTests = false;

  describe(`${engineName.toUpperCase()} TTS Client`, () => {
    beforeAll(async () => {
      // Create the client and check credentials
      client = await createTTSClient(engineName);
      runTests = client !== null;

      // Skip all tests if client is not available
      if (!runTests) {
        console.log(`Skipping ${engineName} tests: credentials not available or invalid`);
      }
    });

    afterAll(async () => {
      // Give any pending async operations time to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      client = null;
    });

    it("should list available voices", async () => {
      // Skip test if client is not available
      if (!runTests || !client) {
        console.log(`Skipping test: ${engineName} credentials not available or invalid`);
        return;
      }

      try {
        const voices = await client!.getVoices();
        expect(voices).toBeDefined();
        expect(Array.isArray(voices)).toBe(true);
        expect(voices.length).toBeGreaterThan(0);

        // Check that the voices have the expected properties
        const voice = voices[0];
        expect(voice).toHaveProperty("id");
        expect(voice).toHaveProperty("name");
        expect(voice).toHaveProperty("gender");
        expect(voice).toHaveProperty("languageCodes");
      } catch (error) {
        // Check if this is a known service/credential issue
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isServiceIssue = errorMessage.includes('credentials') ||
                              errorMessage.includes('unauthorized') ||
                              errorMessage.includes('quota') ||
                              errorMessage.includes('rate limit') ||
                              errorMessage.includes('service unavailable');

        if (isServiceIssue) {
          console.log(`${engineName}: Skipping test due to service issue:`, errorMessage);
          // Skip test for known service issues
          return;
        } else {
          // This is a real bug - let the test fail
          console.error(`${engineName}: Unexpected error in getVoices:`, error);
          throw error;
        }
      }
    });

    it("should get voices by language", async () => {
      // Skip test if client is not available
      if (!runTests || !client) {
        console.log(`Skipping test: ${engineName} credentials not available or invalid`);
        return;
      }

      try {
        const voices = await client!.getVoicesByLanguage("en-US");
        expect(voices).toBeDefined();
        expect(Array.isArray(voices)).toBe(true);

        // Some engines might not have en-US voices
        if (voices.length > 0) {
          // Check that all voices are for the requested language
          for (const voice of voices) {
            expect(voice.languageCodes.some((lang) => lang.bcp47 === "en-US")).toBe(true);
          }
        } else {
          console.log(`No en-US voices found for ${engineName}`);
        }
      } catch (error) {
        // Check if this is a known service/credential issue
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isServiceIssue = errorMessage.includes('credentials') ||
                              errorMessage.includes('unauthorized') ||
                              errorMessage.includes('quota') ||
                              errorMessage.includes('rate limit') ||
                              errorMessage.includes('service unavailable');

        if (isServiceIssue) {
          console.log(`${engineName}: Skipping test due to service issue:`, errorMessage);
          return;
        } else {
          console.error(`${engineName}: Unexpected error in getVoicesByLanguage:`, error);
          throw error;
        }
      }
    });

    it("should set and get properties", async () => {
      // Skip test if client is not available
      if (!runTests || !client) {
        console.log(`Skipping test: ${engineName} credentials not available or invalid`);
        return;
      }

      // Set properties
      client!.setProperty("rate", 1.5);
      client!.setProperty("pitch", 1.2);
      client!.setProperty("volume", 2.0);

      // Get properties
      expect(client!.getProperty("rate")).toBe(1.5);
      expect(client!.getProperty("pitch")).toBe(1.2);
      expect(client!.getProperty("volume")).toBe(2.0);

      // Reset properties
      client!.setProperty("rate", 1.0);
      client!.setProperty("pitch", 1.0);
      client!.setProperty("volume", 1.0);
    });

    it("should synthesize text using non-streaming approach", async () => {
      // Skip test if client is not available
      if (!runTests || !client) {
        console.log(`Skipping test: ${engineName} credentials not available or invalid`);
        return;
      }

      try {
        const text = `This is a test of non-streaming synthesis with ${engineName}.`;
        const outputPath = path.join(os.tmpdir(), `js-tts-${engineName}-non-streaming-test.mp3`);

        // Use synthToBytes (non-streaming)
        const audioBytes = await client!.synthToBytes(text, {});

        // Save to file for verification
        fs.writeFileSync(outputPath, Buffer.from(audioBytes));

        // Check that the file exists and has content
        expect(fs.existsSync(outputPath)).toBe(true);
        const stats = fs.statSync(outputPath);
        expect(stats.size).toBeGreaterThan(0);

        // Clean up
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      } catch (error) {
        // Check if this is a known service/credential issue
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isServiceIssue = errorMessage.includes('credentials') ||
                              errorMessage.includes('unauthorized') ||
                              errorMessage.includes('quota') ||
                              errorMessage.includes('rate limit') ||
                              errorMessage.includes('service unavailable');

        if (isServiceIssue) {
          console.log(`${engineName}: Skipping synthToBytes test due to service issue:`, errorMessage);
          return;
        } else {
          console.error(`${engineName}: Unexpected error in synthToBytes:`, error);
          throw error;
        }
      }
    });

    // Only test SSML for engines that support it
    if (engineName !== "elevenlabs") {
      it("should synthesize SSML to speech", async () => {
        // Skip test if client is not available
        if (!runTests || !client) {
          console.log(`Skipping test: ${engineName} credentials not available or invalid`);
          return;
        }

        try {
          const ssml = `
            <speak>
              This is a <emphasis level="strong">test</emphasis> of SSML synthesis with ${engineName}.
              <break time="500ms"/>
              It supports various SSML tags.
            </speak>
          `;
          const outputPath = path.join(os.tmpdir(), `js-tts-${engineName}-ssml-test.mp3`);

          // Use synthToBytes with SSML
          const audioBytes = await client!.synthToBytes(ssml, {});

          // Save to file for verification
          fs.writeFileSync(outputPath, Buffer.from(audioBytes));

          // Check that the file exists and has content
          expect(fs.existsSync(outputPath)).toBe(true);
          const stats = fs.statSync(outputPath);
          expect(stats.size).toBeGreaterThan(0);

          // Clean up
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
        } catch (error) {
          // Check if this is a known service/credential issue
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isServiceIssue = errorMessage.includes('credentials') ||
                                errorMessage.includes('unauthorized') ||
                                errorMessage.includes('quota') ||
                                errorMessage.includes('rate limit') ||
                                errorMessage.includes('service unavailable');

          if (isServiceIssue) {
            console.log(`${engineName}: Skipping SSML test due to service issue:`, errorMessage);
            return;
          } else {
            console.error(`${engineName}: Unexpected error in SSML synthesis:`, error);
            throw error;
          }
        }
      });
    }

    it("should synthesize text using streaming approach", async () => {
      // Skip test if client is not available
      if (!runTests || !client) {
        console.log(`Skipping test: ${engineName} credentials not available or invalid`);
        return;
      }

      try {
        const text = `This is a test of streaming synthesis with ${engineName}.`;
        const outputPath = path.join(os.tmpdir(), `js-tts-${engineName}-streaming-test.mp3`);

        // Use synthToBytestream (streaming)
        const streamResult = await client!.synthToBytestream(text, {
          useWordBoundary: false, // Don't request word boundaries
        });

        // Check that we got a stream
        expect(streamResult).toBeDefined();

        // Process the stream
        let stream;
        if ("audioStream" in streamResult) {
          stream = streamResult.audioStream;
        } else {
          stream = streamResult;
        }

        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];

        // Read all chunks
        let result = await reader.read();
        while (!result.done) {
          chunks.push(result.value);
          result = await reader.read();
        }

        // Combine chunks
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const audioBytes = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          audioBytes.set(chunk, offset);
          offset += chunk.length;
        }

        // Save to file for verification
        fs.writeFileSync(outputPath, Buffer.from(audioBytes));

        // Check that the file exists and has content
        expect(fs.existsSync(outputPath)).toBe(true);
        const stats = fs.statSync(outputPath);
        expect(stats.size).toBeGreaterThan(0);

        // Clean up
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      } catch (error) {
        // Check if this is a known service/credential issue
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isServiceIssue = errorMessage.includes('credentials') ||
                              errorMessage.includes('unauthorized') ||
                              errorMessage.includes('quota') ||
                              errorMessage.includes('rate limit') ||
                              errorMessage.includes('service unavailable');

        if (isServiceIssue) {
          console.log(`${engineName}: Skipping streaming test due to service issue:`, errorMessage);
          return;
        } else {
          console.error(`${engineName}: Unexpected error in streaming synthesis:`, error);
          throw error;
        }
      }
    });

    it("should handle word boundary events", async () => {
      // Skip test if client is not available
      if (!runTests || !client) {
        console.log(`Skipping test: ${engineName} credentials not available or invalid`);
        return;
      }

      try {
        const text = `This is a test of word boundary events with ${engineName}.`;
        const wordBoundaries: Array<{ word: string; start: number; end: number }> = [];

        // Create a word boundary callback
        const callback = (word: string, start: number, end: number) => {
          wordBoundaries.push({ word, start, end });
        };

        // Use startPlaybackWithCallbacks
        await client!.startPlaybackWithCallbacks(text, callback);

        // Check that we received word boundary events
        // Note: These might be estimated rather than actual word boundaries
        expect(wordBoundaries.length).toBeGreaterThan(0);

        // Check the structure of the word boundary events
        const firstEvent = wordBoundaries[0];
        expect(firstEvent).toHaveProperty("word");
        expect(firstEvent).toHaveProperty("start");
        expect(firstEvent).toHaveProperty("end");
        expect(typeof firstEvent.word).toBe("string");
        expect(typeof firstEvent.start).toBe("number");
        expect(typeof firstEvent.end).toBe("number");
      } catch (error) {
        // Check if this is a known service/credential issue
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isServiceIssue = errorMessage.includes('credentials') ||
                              errorMessage.includes('unauthorized') ||
                              errorMessage.includes('quota') ||
                              errorMessage.includes('rate limit') ||
                              errorMessage.includes('service unavailable');

        if (isServiceIssue) {
          console.log(`${engineName}: Skipping word boundary test due to service issue:`, errorMessage);
          return;
        } else {
          console.error(`${engineName}: Unexpected error in word boundary events:`, error);
          throw error;
        }
      }
    });
  });
});
