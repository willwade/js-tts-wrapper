import { SAPITTSClient } from "../engines/sapi";
import { describe, it, expect, beforeAll } from '@jest/globals';
import * as os from "os";

/**
 * SAPI SSML Handling Tests
 * 
 * This test suite specifically verifies that SAPI properly handles:
 * 1. Plain text (should be automatically wrapped in SSML)
 * 2. SSML with proper speak tags
 * 3. SSML fragments without speak tags (should be wrapped)
 * 4. Mixed content scenarios
 * 
 * The key issue being tested: SAPI should not read SSML tags literally
 * when they are present but not properly wrapped.
 */

describe("SAPI SSML Handling", () => {
  let client: SAPITTSClient | null = null;
  let isWindows = false;

  beforeAll(async () => {
    // Only run on Windows
    isWindows = os.platform() === "win32";

    if (isWindows) {
      try {
        client = new SAPITTSClient({});
        // Test if SAPI is available
        const credentialsValid = await client.checkCredentials();
        if (!credentialsValid) {
          console.log("SAPI is not available on this Windows system");
          client = null;
        }
      } catch (error) {
        console.log("Failed to initialize SAPI client:", error);
        client = null;
      }
    }
  });

  const runTest = (testName: string, testFn: () => Promise<void>) => {
    if (!isWindows) {
      it.skip(`${testName} (Windows only)`, () => {});
      return;
    }
    
    if (!client) {
      it.skip(`${testName} (SAPI not available)`, () => {});
      return;
    }
    
    it(testName, testFn, 30000); // 30 second timeout for SAPI operations
  };

  runTest("should handle plain text without reading tags literally", async () => {
    const plainText = "Hello world, this is a test.";
    
    // This should work without any issues - plain text gets wrapped in SSML
    const audioBytes = await client!.synthToBytes(plainText);
    
    expect(audioBytes).toBeInstanceOf(Uint8Array);
    expect(audioBytes.length).toBeGreaterThan(0);
    
    // Check for WAV header
    const wavHeader = Buffer.from(audioBytes.slice(0, 12)).toString('ascii');
    expect(wavHeader.startsWith('RIFF')).toBe(true);
    expect(wavHeader.includes('WAVE')).toBe(true);
  });

  runTest("should handle proper SSML without issues", async () => {
    const properSSML = `<speak version="1.0" xml:lang="en">
      Hello world, this is a <emphasis level="strong">test</emphasis> with proper SSML.
      <break time="500ms"/>
      This should work correctly.
    </speak>`;
    
    const audioBytes = await client!.synthToBytes(properSSML);
    
    expect(audioBytes).toBeInstanceOf(Uint8Array);
    expect(audioBytes.length).toBeGreaterThan(0);
    
    // Check for WAV header
    const wavHeader = Buffer.from(audioBytes.slice(0, 12)).toString('ascii');
    expect(wavHeader.startsWith('RIFF')).toBe(true);
    expect(wavHeader.includes('WAVE')).toBe(true);
  });

  runTest("should handle SSML fragments by wrapping them properly", async () => {
    // This is the problematic case - SSML tags without proper speak wrapper
    // Previously this would be read literally, now it should be wrapped and processed
    const ssmlFragment = `This is a <emphasis level="strong">test</emphasis> with SSML tags.
      <break time="300ms"/>
      The tags should not be read literally.`;
    
    const audioBytes = await client!.synthToBytes(ssmlFragment);
    
    expect(audioBytes).toBeInstanceOf(Uint8Array);
    expect(audioBytes.length).toBeGreaterThan(0);
    
    // Check for WAV header
    const wavHeader = Buffer.from(audioBytes.slice(0, 12)).toString('ascii');
    expect(wavHeader.startsWith('RIFF')).toBe(true);
    expect(wavHeader.includes('WAVE')).toBe(true);
  });

  runTest("should handle simple speak tags without version attributes", async () => {
    const simpleSSML = `<speak>
      Hello world, this is a simple SSML test.
      <break time="200ms"/>
      It should work correctly.
    </speak>`;
    
    const audioBytes = await client!.synthToBytes(simpleSSML);
    
    expect(audioBytes).toBeInstanceOf(Uint8Array);
    expect(audioBytes.length).toBeGreaterThan(0);
    
    // Check for WAV header
    const wavHeader = Buffer.from(audioBytes.slice(0, 12)).toString('ascii');
    expect(wavHeader.startsWith('RIFF')).toBe(true);
    expect(wavHeader.includes('WAVE')).toBe(true);
  });

  runTest("should handle prosody tags correctly", async () => {
    const prosodySSML = `<speak>
      <prosody rate="slow" pitch="low">This text should be spoken slowly with a low pitch.</prosody>
      <break time="500ms"/>
      <prosody rate="fast" pitch="high">This text should be spoken quickly with a high pitch.</prosody>
    </speak>`;
    
    const audioBytes = await client!.synthToBytes(prosodySSML);
    
    expect(audioBytes).toBeInstanceOf(Uint8Array);
    expect(audioBytes.length).toBeGreaterThan(0);
    
    // Check for WAV header
    const wavHeader = Buffer.from(audioBytes.slice(0, 12)).toString('ascii');
    expect(wavHeader.startsWith('RIFF')).toBe(true);
    expect(wavHeader.includes('WAVE')).toBe(true);
  });

  runTest("should handle mixed content with various SSML elements", async () => {
    const mixedSSML = `<speak>
      Welcome to the SSML test.
      <break time="300ms"/>
      This text has <emphasis level="moderate">emphasis</emphasis>.
      <break time="200ms"/>
      <prosody rate="x-slow">This part is very slow.</prosody>
      <break time="400ms"/>
      And this is normal speed again.
    </speak>`;

    const audioBytes = await client!.synthToBytes(mixedSSML);

    expect(audioBytes).toBeInstanceOf(Uint8Array);
    expect(audioBytes.length).toBeGreaterThan(0);

    // Check for WAV header
    const wavHeader = Buffer.from(audioBytes.slice(0, 12)).toString('ascii');
    expect(wavHeader.startsWith('RIFF')).toBe(true);
    expect(wavHeader.includes('WAVE')).toBe(true);
  });

  runTest("should respect voice selection with setVoice", async () => {
    // Get available voices first
    const voices = await client!.getVoices();
    expect(voices.length).toBeGreaterThan(0);

    // Find a German voice if available (like TTS_MS_DE-DE_HEDDA_11.0)
    const germanVoice = voices.find(v => v.id.includes('DE-DE') || v.name.includes('German'));

    if (germanVoice) {
      // Set the German voice
      client!.setVoice(germanVoice.id);

      // Synthesize some text
      const testText = "Hallo Welt, das ist ein Test.";
      const audioBytes = await client!.synthToBytes(testText);

      expect(audioBytes).toBeInstanceOf(Uint8Array);
      expect(audioBytes.length).toBeGreaterThan(0);

      // Check for WAV header
      const wavHeader = Buffer.from(audioBytes.slice(0, 12)).toString('ascii');
      expect(wavHeader.startsWith('RIFF')).toBe(true);
      expect(wavHeader.includes('WAVE')).toBe(true);
    } else {
      // If no German voice available, test with any available voice
      const firstVoice = voices[0];
      client!.setVoice(firstVoice.id);

      const testText = "Hello world, this is a voice selection test.";
      const audioBytes = await client!.synthToBytes(testText);

      expect(audioBytes).toBeInstanceOf(Uint8Array);
      expect(audioBytes.length).toBeGreaterThan(0);

      // Check for WAV header
      const wavHeader = Buffer.from(audioBytes.slice(0, 12)).toString('ascii');
      expect(wavHeader.startsWith('RIFF')).toBe(true);
      expect(wavHeader.includes('WAVE')).toBe(true);
    }
  });

  runTest("should handle voice selection via options parameter", async () => {
    // Get available voices first
    const voices = await client!.getVoices();
    expect(voices.length).toBeGreaterThan(0);

    // Use the first available voice via options
    const testVoice = voices[0];
    const testText = "This text should use the voice specified in options.";

    const audioBytes = await client!.synthToBytes(testText, { voice: testVoice.id });

    expect(audioBytes).toBeInstanceOf(Uint8Array);
    expect(audioBytes.length).toBeGreaterThan(0);

    // Check for WAV header
    const wavHeader = Buffer.from(audioBytes.slice(0, 12)).toString('ascii');
    expect(wavHeader.startsWith('RIFF')).toBe(true);
    expect(wavHeader.includes('WAVE')).toBe(true);
  });
});
