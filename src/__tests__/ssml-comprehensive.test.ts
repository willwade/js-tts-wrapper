import { describe, it, expect, beforeAll } from "@jest/globals";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { TTSClient } from "../index";

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

describe("Comprehensive SSML Testing", () => {
  TEST_ENGINES.forEach((engineName) => {
    describe(`${engineName.toUpperCase()} Engine`, () => {
      let client: TTSClient | null = null;
      let runTests = false;

      beforeAll(async () => {
        try {
          client = new TTSClient(engineName as any);

          // For credential-free engines, skip credential check
          if (CREDENTIAL_FREE_ENGINES.includes(engineName)) {
            runTests = true;
            console.log(`${engineName}: Credential-free engine, running SSML tests`);
          } else {
            // Test if credentials are available by trying to get voices
            await client.getVoices();
            runTests = true;
            console.log(`${engineName}: Credentials available, running SSML tests`);
          }
        } catch (error) {
          console.log(`${engineName}: Credentials not available or invalid, skipping SSML tests`);
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
 * Helper function to check if an error is a service-related issue
 */
function isServiceIssue(error: any): boolean {
  const errorMessage = error?.message?.toLowerCase() || "";
  return errorMessage.includes('credentials') ||
         errorMessage.includes('unauthorized') ||
         errorMessage.includes('insufficient') ||
         errorMessage.includes('quota') ||
         errorMessage.includes('rate limit') ||
         errorMessage.includes('service unavailable') ||
         errorMessage.includes('forbidden');
}
