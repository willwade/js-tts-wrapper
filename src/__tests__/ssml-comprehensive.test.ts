import { describe, it, expect, beforeAll } from "@jest/globals";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createTTSClient } from "../factory";
import type { AbstractTTSClient } from "../core/abstract-tts";

// Load environment variables from .env file
const envFile = path.join(process.cwd(), '.env');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  const envLines = envContent.split('\n');
  for (const line of envLines) {
    if (line.trim() && !line.startsWith('#')) {
      const match = line.match(/^export\s+([A-Za-z0-9_]+)="(.*)"/);
      if (match) {
        const [, key, value] = match;
        process.env[key] = value;
      }
    }
  }
  console.log('Environment variables loaded from .env file for Jest');
} else {
  console.log('No .env file found for Jest');
}

/**
 * Comprehensive SSML Testing Suite
 * 
 * This test suite verifies SSML support across different TTS engines.
 * It tests various SSML elements including prosody, breaks, emphasis,
 * and ensures proper handling for engines that don't support SSML.
 */

// Define which engines support SSML
const SSML_SUPPORTED_ENGINES = ["google", "azure", "polly", "witai", "sapi", "espeak-wasm"];
const NON_SSML_ENGINES = ["elevenlabs", "openai", "playht", "sherpaonnx", "sherpaonnx-wasm"];

// Engines that don't require credentials
const CREDENTIAL_FREE_ENGINES = ["espeak-wasm", "sherpaonnx", "sherpaonnx-wasm"];

// Test engines to run (can be overridden by environment variable)
const TEST_ENGINES = process.env.TEST_ENGINES?.split(",") || [
  "google", "azure", "polly", "witai", "elevenlabs", "openai", "sapi", "espeak-wasm"
];

/**
 * Get credentials for testing engines (real if available, mock otherwise)
 */
function getMockCredentials(engineName: string): any {
  switch (engineName) {
    case "google":
      // Use real credentials if available, otherwise fake
      if (process.env.GOOGLE_SA_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        const keyFilename = process.env.GOOGLE_SA_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
        return { keyFilename };
      }
      return { keyFilename: "fake-key.json" };
    case "azure":
      // Use real credentials if available, otherwise fake
      if (process.env.MICROSOFT_TOKEN && process.env.MICROSOFT_REGION) {
        return { subscriptionKey: process.env.MICROSOFT_TOKEN, region: process.env.MICROSOFT_REGION };
      }
      return { subscriptionKey: "fake-key", region: "westus" };
    case "polly":
      // Use real credentials if available, otherwise fake
      if (process.env.POLLY_AWS_KEY_ID && process.env.POLLY_AWS_ACCESS_KEY && process.env.POLLY_REGION) {
        return {
          region: process.env.POLLY_REGION,
          accessKeyId: process.env.POLLY_AWS_KEY_ID,
          secretAccessKey: process.env.POLLY_AWS_ACCESS_KEY
        };
      }
      return { region: "us-east-1", accessKeyId: "fake-key", secretAccessKey: "fake-secret" };
    case "witai":
      // Use real credentials if available, otherwise fake
      if (process.env.WITAI_TOKEN) {
        return { token: process.env.WITAI_TOKEN };
      }
      return { token: "fake-token" };
    case "elevenlabs":
      // Use real credentials if available, otherwise fake
      if (process.env.ELEVENLABS_API_KEY) {
        return { apiKey: process.env.ELEVENLABS_API_KEY };
      }
      return { apiKey: "fake-key" };
    case "openai":
      // Use real credentials if available, otherwise fake
      if (process.env.OPENAI_API_KEY) {
        return { apiKey: process.env.OPENAI_API_KEY };
      }
      return { apiKey: "fake-key" };
    case "watson":
      // Use real credentials if available, otherwise fake
      if (process.env.WATSON_API_KEY && process.env.WATSON_REGION && process.env.WATSON_INSTANCE_ID) {
        return {
          apiKey: process.env.WATSON_API_KEY,
          region: process.env.WATSON_REGION,
          instanceId: process.env.WATSON_INSTANCE_ID
        };
      }
      return { apiKey: "fake-key", region: "us-south", instanceId: "fake-instance" };
    case "playht":
      // Use real credentials if available, otherwise fake
      if (process.env.PLAYHT_API_KEY && process.env.PLAYHT_USER_ID) {
        return { apiKey: process.env.PLAYHT_API_KEY, userId: process.env.PLAYHT_USER_ID };
      }
      return { apiKey: "fake-key", userId: "fake-user" };
    default:
      return {};
  }
}

describe("Comprehensive SSML Testing", () => {
  TEST_ENGINES.forEach((engineName) => {
    describe(`${engineName.toUpperCase()} Engine`, () => {
      let client: AbstractTTSClient | null = null;
      let runTests = false;

      beforeAll(async () => {
        try {
          // Create client with appropriate credentials
          const credentials = CREDENTIAL_FREE_ENGINES.includes(engineName)
            ? {}
            : getMockCredentials(engineName);

          client = createTTSClient(engineName as any, credentials);

          // Use the standardized credential validation method
          const credentialsValid = await client.checkCredentials();

          if (credentialsValid) {
            runTests = true;
            console.log(`${engineName}: Credentials valid, running SSML tests`);
          } else {
            runTests = false;
            console.log(`${engineName}: Credentials invalid, skipping SSML tests`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Check if it's a missing package error
          if (errorMessage.includes("Install") || errorMessage.includes("not available")) {
            console.log(`${engineName}: Package not installed, skipping SSML tests`);
          } else {
            console.log(`${engineName}: Error creating client, skipping SSML tests`);
          }
          runTests = false;
        }
      });

      const shouldTestSSML = SSML_SUPPORTED_ENGINES.includes(engineName);

      if (shouldTestSSML) {
        describe("SSML Support Tests", () => {
          it("should synthesize basic SSML with speak tags", async () => {
            if (!runTests || !client) {
              console.log(`Skipping test: ${engineName} credentials not available`);
              return;
            }

            try {
              const ssml = `
                <speak>
                  This is a basic SSML test for ${engineName}.
                  The engine should process this correctly.
                </speak>
              `;
              const outputPath = path.join(os.tmpdir(), `ssml-${engineName}-basic.wav`);

              const audioBytes = await client.synthToBytes(ssml, { format: "wav" });
              fs.writeFileSync(outputPath, Buffer.from(audioBytes));

              expect(fs.existsSync(outputPath)).toBe(true);
              expect(fs.statSync(outputPath).size).toBeGreaterThan(0);

              console.log(`${engineName}: Basic SSML test passed`);
              
              // Clean up
              if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
              }
            } catch (error: any) {
              if (isServiceIssue(error)) {
                console.log(`${engineName}: Skipping basic SSML test due to service issue`);
                return;
              }
              throw error;
            }
          });

          it("should handle SSML prosody elements", async () => {
            if (!runTests || !client) {
              console.log(`Skipping test: ${engineName} credentials not available`);
              return;
            }

            try {
              const ssml = `
                <speak>
                  <prosody rate="slow" pitch="low">This is spoken slowly with low pitch.</prosody>
                  <break time="1s"/>
                  <prosody rate="fast" pitch="high">This is spoken quickly with high pitch.</prosody>
                </speak>
              `;
              const outputPath = path.join(os.tmpdir(), `ssml-${engineName}-prosody.wav`);

              const audioBytes = await client.synthToBytes(ssml, { format: "wav" });
              fs.writeFileSync(outputPath, Buffer.from(audioBytes));

              expect(fs.existsSync(outputPath)).toBe(true);
              expect(fs.statSync(outputPath).size).toBeGreaterThan(0);

              console.log(`${engineName}: Prosody SSML test passed`);
              
              // Clean up
              if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
              }
            } catch (error: any) {
              if (isServiceIssue(error)) {
                console.log(`${engineName}: Skipping prosody SSML test due to service issue`);
                return;
              }
              throw error;
            }
          });

          it("should handle SSML break elements", async () => {
            if (!runTests || !client) {
              console.log(`Skipping test: ${engineName} credentials not available`);
              return;
            }

            try {
              const ssml = `
                <speak>
                  First sentence.
                  <break time="2s"/>
                  Second sentence after a pause.
                  <break strength="strong"/>
                  Third sentence after a strong break.
                </speak>
              `;
              const outputPath = path.join(os.tmpdir(), `ssml-${engineName}-breaks.wav`);

              const audioBytes = await client.synthToBytes(ssml, { format: "wav" });
              fs.writeFileSync(outputPath, Buffer.from(audioBytes));

              expect(fs.existsSync(outputPath)).toBe(true);
              expect(fs.statSync(outputPath).size).toBeGreaterThan(0);

              console.log(`${engineName}: Break SSML test passed`);
              
              // Clean up
              if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
              }
            } catch (error: any) {
              if (isServiceIssue(error)) {
                console.log(`${engineName}: Skipping break SSML test due to service issue`);
                return;
              }
              throw error;
            }
          });

          it("should handle SSML emphasis elements", async () => {
            if (!runTests || !client) {
              console.log(`Skipping test: ${engineName} credentials not available`);
              return;
            }

            try {
              const ssml = `
                <speak>
                  This word is <emphasis level="reduced">reduced</emphasis>.
                  This word is <emphasis level="moderate">moderate</emphasis>.
                  This word is <emphasis level="strong">strong</emphasis>.
                </speak>
              `;
              const outputPath = path.join(os.tmpdir(), `ssml-${engineName}-emphasis.wav`);

              const audioBytes = await client.synthToBytes(ssml, { format: "wav" });
              fs.writeFileSync(outputPath, Buffer.from(audioBytes));

              expect(fs.existsSync(outputPath)).toBe(true);
              expect(fs.statSync(outputPath).size).toBeGreaterThan(0);

              console.log(`${engineName}: Emphasis SSML test passed`);
              
              // Clean up
              if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
              }
            } catch (error: any) {
              if (isServiceIssue(error)) {
                console.log(`${engineName}: Skipping emphasis SSML test due to service issue`);
                return;
              }
              throw error;
            }
          });

          it("should work with both WAV and MP3 formats", async () => {
            if (!runTests || !client) {
              console.log(`Skipping test: ${engineName} credentials not available`);
              return;
            }

            try {
              const ssml = `
                <speak>
                  Testing SSML with <emphasis level="strong">different formats</emphasis> for ${engineName}.
                </speak>
              `;

              // Test WAV format
              const wavBytes = await client.synthToBytes(ssml, { format: "wav" });
              expect(wavBytes.length).toBeGreaterThan(0);

              // Test MP3 format
              const mp3Bytes = await client.synthToBytes(ssml, { format: "mp3" });
              expect(mp3Bytes.length).toBeGreaterThan(0);

              console.log(`${engineName}: Multi-format SSML test passed`);
            } catch (error: any) {
              if (isServiceIssue(error)) {
                console.log(`${engineName}: Skipping multi-format SSML test due to service issue`);
                return;
              }
              throw error;
            }
          });
        });
      } else {
        describe("SSML Stripping Tests", () => {
          it("should strip SSML tags for non-SSML engines", async () => {
            if (!runTests || !client) {
              console.log(`Skipping test: ${engineName} credentials not available`);
              return;
            }

            try {
              const ssml = `
                <speak>
                  This is a <emphasis level="strong">test</emphasis> with SSML tags.
                  <break time="500ms"/>
                  The tags should be stripped for ${engineName}.
                </speak>
              `;
              const outputPath = path.join(os.tmpdir(), `ssml-${engineName}-stripped.wav`);

              const audioBytes = await client.synthToBytes(ssml, { format: "wav" });
              fs.writeFileSync(outputPath, Buffer.from(audioBytes));

              expect(fs.existsSync(outputPath)).toBe(true);
              expect(fs.statSync(outputPath).size).toBeGreaterThan(0);

              console.log(`${engineName}: SSML stripping test passed`);
              
              // Clean up
              if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
              }
            } catch (error: any) {
              if (isServiceIssue(error)) {
                console.log(`${engineName}: Skipping SSML stripping test due to service issue`);
                return;
              }
              throw error;
            }
          });
        });
      }
    });
  });
});

/**
 * Helper function to check if an error is a service-related issue during synthesis
 * Note: Credential validation is now handled by checkCredentials() method in beforeAll
 */
function isServiceIssue(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || "";
  const errorStatus = error?.status || 0;

  // Check for service issues that can occur during synthesis even with valid credentials
  return errorMessage.includes('quota') ||
         errorMessage.includes('rate limit') ||
         errorMessage.includes('ratelimiterror') ||
         errorMessage.includes('exceeded your current quota') ||
         errorMessage.includes('service unavailable') ||
         errorMessage.includes('temporarily unavailable') ||
         errorMessage.includes('server error') ||
         errorStatus === 429 ||  // Rate limit
         errorStatus === 500 ||  // Server error
         errorStatus === 502 ||  // Bad gateway
         errorStatus === 503 ||  // Service unavailable
         errorStatus === 504;    // Gateway timeout
}
