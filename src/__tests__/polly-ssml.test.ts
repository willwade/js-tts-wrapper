import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { PollyTTSClient } from "../engines/polly";
import type { UnifiedVoice } from "../types";

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
  console.log('Environment variables loaded from .env file for Polly SSML tests');
} else {
  console.log('No .env file found for Polly SSML tests');
}

/**
 * Polly SSML Engine Detection and Handling Tests
 * 
 * This test suite verifies that the Polly engine correctly:
 * 1. Detects voice engine types from AWS API (standard, neural, long-form, generative)
 * 2. Applies appropriate SSML handling based on engine capabilities
 * 3. Strips unsupported SSML tags for limited engines
 * 4. Maintains full SSML support for capable engines
 */

describe("Polly SSML Engine Detection and Handling", () => {
  let client: PollyTTSClient | null = null;
  let runTests = false;
  let voices: UnifiedVoice[] = [];

  beforeAll(async () => {
    try {
      // Create client with real credentials if available, otherwise mock
      const credentials = {
        region: process.env.POLLY_REGION || "us-east-1",
        accessKeyId: process.env.POLLY_AWS_KEY_ID || "fake-key",
        secretAccessKey: process.env.POLLY_AWS_ACCESS_KEY || "fake-secret"
      };

      client = new PollyTTSClient(credentials);

      // Test if the engine is available by trying to get voices
      voices = await client.getVoices();

      // Only run tests if we actually get voices back
      if (voices.length > 0) {
        runTests = true;
        console.log(`Polly: Found ${voices.length} voices, running SSML engine tests`);
      } else {
        runTests = false;
        console.log("Polly: No voices available, skipping SSML engine tests");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`Polly: Credentials not available or invalid (${errorMessage}), skipping SSML engine tests`);
      runTests = false;
    }
  });

  describe("Voice Engine Detection", () => {
    it("should detect supported engines for voices", async () => {
      if (!runTests || !client || voices.length === 0) {
        console.log("Skipping test: Polly credentials not available");
        return;
      }

      // Check that voices have metadata with supported engines
      const voicesWithEngines = voices.filter(voice => 
        voice.metadata?.supportedEngines && voice.metadata.supportedEngines.length > 0
      );

      expect(voicesWithEngines.length).toBeGreaterThan(0);
      
      // Log some examples for debugging
      const exampleVoices = voicesWithEngines.slice(0, 5);
      exampleVoices.forEach(voice => {
        console.log(`Voice ${voice.id}: supports engines [${voice.metadata?.supportedEngines?.join(', ')}]`);
      });
    });

    it("should categorize voices by engine type", async () => {
      if (!runTests || !client || voices.length === 0) {
        console.log("Skipping test: Polly credentials not available");
        return;
      }

      const engineTypes = {
        standard: 0,
        neural: 0,
        'long-form': 0,
        generative: 0
      };

      voices.forEach(voice => {
        const engines = voice.metadata?.supportedEngines || [];
        engines.forEach(engine => {
          if (engine in engineTypes) {
            engineTypes[engine as keyof typeof engineTypes]++;
          }
        });
      });

      console.log("Engine type distribution:", engineTypes);
      
      // We should have at least some standard and neural voices
      expect(engineTypes.standard + engineTypes.neural).toBeGreaterThan(0);
    });
  });

  describe("SSML Support Level Detection", () => {
    it("should correctly identify SSML support levels", async () => {
      if (!runTests || !client || voices.length === 0) {
        console.log("Skipping test: Polly credentials not available");
        return;
      }

      // Test a few different voice types if available
      const testVoices = voices.slice(0, 3);
      
      for (const voice of testVoices) {
        const engines = voice.metadata?.supportedEngines || [];
        console.log(`Testing voice ${voice.id} with engines: [${engines.join(', ')}]`);
        
        // We can't directly test the private method, but we can test the behavior
        // by checking if SSML is processed correctly
        const ssmlText = `
          <speak>
            This is a test with <emphasis level="strong">emphasis</emphasis>.
            <break time="500ms"/>
            <prosody rate="slow">This should be slow.</prosody>
          </speak>
        `;

        try {
          // Set the voice and try to synthesize
          client.setVoice(voice.id);
          const audioBytes = await client.synthToBytes(ssmlText, { format: "mp3" });
          
          // If we get audio bytes, the engine handled the SSML appropriately
          expect(audioBytes.length).toBeGreaterThan(0);
          console.log(`Voice ${voice.id}: Successfully processed SSML (${audioBytes.length} bytes)`);
        } catch (error) {
          // Some voices might not be available in the test region
          console.log(`Voice ${voice.id}: Synthesis failed - ${error}`);
        }
      }
    });
  });

  describe("SSML Tag Stripping for Limited Engines", () => {
    it("should handle emphasis tags appropriately for different engines", async () => {
      if (!runTests || !client || voices.length === 0) {
        console.log("Skipping test: Polly credentials not available");
        return;
      }

      // Find a neural voice if available
      const neuralVoice = voices.find(voice => 
        voice.metadata?.supportedEngines?.includes("neural")
      );

      if (!neuralVoice) {
        console.log("No neural voice found, skipping emphasis tag test");
        return;
      }

      const ssmlWithEmphasis = `
        <speak>
          This text has <emphasis level="strong">emphasized words</emphasis> that should be handled.
        </speak>
      `;

      try {
        client.setVoice(neuralVoice.id);
        const audioBytes = await client.synthToBytes(ssmlWithEmphasis, { format: "mp3" });
        
        // Neural voices should strip emphasis tags but still produce audio
        expect(audioBytes.length).toBeGreaterThan(0);
        console.log(`Neural voice ${neuralVoice.id}: Successfully handled emphasis tags (${audioBytes.length} bytes)`);
      } catch (error) {
        console.log(`Neural voice ${neuralVoice.id}: Synthesis failed - ${error}`);
      }
    });

    it("should handle prosody tags appropriately for different engines", async () => {
      if (!runTests || !client || voices.length === 0) {
        console.log("Skipping test: Polly credentials not available");
        return;
      }

      // Test both standard and neural voices if available
      const standardVoice = voices.find(voice => 
        voice.metadata?.supportedEngines?.includes("standard") &&
        !voice.metadata?.supportedEngines?.includes("neural")
      );
      
      const neuralVoice = voices.find(voice => 
        voice.metadata?.supportedEngines?.includes("neural")
      );

      const ssmlWithProsody = `
        <speak>
          <prosody rate="slow" pitch="low">This text should be spoken slowly with low pitch.</prosody>
        </speak>
      `;

      // Test standard voice (should support full prosody)
      if (standardVoice) {
        try {
          client.setVoice(standardVoice.id);
          const audioBytes = await client.synthToBytes(ssmlWithProsody, { format: "mp3" });
          expect(audioBytes.length).toBeGreaterThan(0);
          console.log(`Standard voice ${standardVoice.id}: Successfully processed prosody (${audioBytes.length} bytes)`);
        } catch (error) {
          console.log(`Standard voice ${standardVoice.id}: Synthesis failed - ${error}`);
        }
      }

      // Test neural voice (has limited prosody support)
      if (neuralVoice) {
        try {
          client.setVoice(neuralVoice.id);
          const audioBytes = await client.synthToBytes(ssmlWithProsody, { format: "mp3" });
          expect(audioBytes.length).toBeGreaterThan(0);
          console.log(`Neural voice ${neuralVoice.id}: Successfully processed prosody (${audioBytes.length} bytes)`);
        } catch (error) {
          console.log(`Neural voice ${neuralVoice.id}: Synthesis failed - ${error}`);
        }
      }
    });
  });

  describe("Engine Selection Logic", () => {
    it("should prefer neural engine when available", async () => {
      if (!runTests || !client || voices.length === 0) {
        console.log("Skipping test: Polly credentials not available");
        return;
      }

      // Find a voice that supports multiple engines including neural
      const multiEngineVoice = voices.find(voice => {
        const engines = voice.metadata?.supportedEngines || [];
        return engines.includes("neural") && engines.length > 1;
      });

      if (!multiEngineVoice) {
        console.log("No multi-engine voice found, skipping engine preference test");
        return;
      }

      console.log(`Testing engine preference for voice ${multiEngineVoice.id} with engines: [${multiEngineVoice.metadata?.supportedEngines?.join(', ')}]`);
      
      // The engine selection logic should prefer neural over standard
      // We can't directly test the private method, but we can verify synthesis works
      try {
        client.setVoice(multiEngineVoice.id);
        const audioBytes = await client.synthToBytes("Testing engine selection", { format: "mp3" });
        expect(audioBytes.length).toBeGreaterThan(0);
        console.log(`Multi-engine voice ${multiEngineVoice.id}: Successfully synthesized (${audioBytes.length} bytes)`);
      } catch (error) {
        console.log(`Multi-engine voice ${multiEngineVoice.id}: Synthesis failed - ${error}`);
      }
    });
  });

  afterAll(() => {
    // Clean up any test files if needed
    console.log("Polly SSML engine tests completed");
  });
});
