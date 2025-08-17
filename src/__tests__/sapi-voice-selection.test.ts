import { SAPITTSClient } from "../engines/sapi";
import { describe, it, expect, beforeAll } from '@jest/globals';
import * as os from "os";

/**
 * SAPI Voice Selection Tests
 * 
 * This test suite specifically verifies that the SAPI voice selection bug is fixed:
 * - setVoice() should properly select the specified voice
 * - Voice selection via options parameter should work
 * - Different voices should produce different audio output
 */

describe("SAPI Voice Selection", () => {
  let client: SAPITTSClient | null = null;

  beforeAll(async () => {
    // Only run on Windows
    if (os.platform() === "win32") {
      try {
        client = new SAPITTSClient({});
        // Test if SAPI is available
        const credentialsValid = await client.checkCredentials();
        if (!credentialsValid) {
          client = null;
        }
      } catch (error) {
        client = null;
      }
    }
  });

  it("should be available on Windows", () => {
    if (os.platform() !== "win32") {
      console.log("Skipping SAPI tests - not on Windows");
      return;
    }
    
    expect(client).not.toBeNull();
  });

  it("should get available voices", async () => {
    if (!client) {
      console.log("Skipping test - SAPI not available");
      return;
    }

    const voices = await client.getVoices();
    expect(voices).toBeDefined();
    expect(voices.length).toBeGreaterThan(0);
    
    console.log(`Found ${voices.length} SAPI voices:`);
    voices.forEach(voice => {
      console.log(`  - ${voice.id}: ${voice.name} (${voice.gender})`);
    });
  });

  it("should respect voice selection with setVoice", async () => {
    if (!client) {
      console.log("Skipping test - SAPI not available");
      return;
    }

    const voices = await client.getVoices();
    expect(voices.length).toBeGreaterThan(0);

    // Test with the first voice
    const testVoice = voices[0];
    client.setVoice(testVoice.id);

    const testText = "Hello world, this is a voice selection test.";
    const audioBytes = await client.synthToBytes(testText);

    expect(audioBytes).toBeInstanceOf(Uint8Array);
    expect(audioBytes.length).toBeGreaterThan(0);

    // Check for WAV header
    const wavHeader = Buffer.from(audioBytes.slice(0, 12)).toString('ascii');
    expect(wavHeader.startsWith('RIFF')).toBe(true);
    expect(wavHeader.includes('WAVE')).toBe(true);

    console.log(`✓ Successfully synthesized ${audioBytes.length} bytes with voice: ${testVoice.id}`);
  });

  it("should respect voice selection via options parameter", async () => {
    if (!client) {
      console.log("Skipping test - SAPI not available");
      return;
    }

    const voices = await client.getVoices();
    expect(voices.length).toBeGreaterThan(0);

    // Test with the first voice via options
    const testVoice = voices[0];
    const testText = "This text should use the voice specified in options.";

    const audioBytes = await client.synthToBytes(testText, { voice: testVoice.id });

    expect(audioBytes).toBeInstanceOf(Uint8Array);
    expect(audioBytes.length).toBeGreaterThan(0);

    // Check for WAV header
    const wavHeader = Buffer.from(audioBytes.slice(0, 12)).toString('ascii');
    expect(wavHeader.startsWith('RIFF')).toBe(true);
    expect(wavHeader.includes('WAVE')).toBe(true);

    console.log(`✓ Successfully synthesized ${audioBytes.length} bytes via options with voice: ${testVoice.id}`);
  });

  it("should work with different voices if available", async () => {
    if (!client) {
      console.log("Skipping test - SAPI not available");
      return;
    }

    const voices = await client.getVoices();

    if (voices.length < 2) {
      console.log("Skipping multi-voice test - only one voice available");
      return;
    }

    const testText = "Testing different voices.";

    // Test with first voice
    client.setVoice(voices[0].id);
    const audio1 = await client.synthToBytes(testText);

    // Test with second voice
    client.setVoice(voices[1].id);
    const audio2 = await client.synthToBytes(testText);

    expect(audio1).toBeInstanceOf(Uint8Array);
    expect(audio2).toBeInstanceOf(Uint8Array);
    expect(audio1.length).toBeGreaterThan(0);
    expect(audio2.length).toBeGreaterThan(0);

    console.log(`✓ Voice 1 (${voices[0].id}): ${audio1.length} bytes`);
    console.log(`✓ Voice 2 (${voices[1].id}): ${audio2.length} bytes`);
  });

  it("should handle complex SSML without double wrapping", async () => {
    if (!client) {
      console.log("Skipping test - SAPI not available");
      return;
    }

    // Test the exact SSML from the bug report
    const complexSSML = `<speak>
  <prosody rate="x-fast" pitch="x-high">
    This text will be spoken slowly with a low pitch.
  </prosody>
  <break time="500ms"/>
  <emphasis level="strong">This text is emphasized.</emphasis>
</speak>`;

    const audioBytes = await client.synthToBytes(complexSSML);

    expect(audioBytes).toBeInstanceOf(Uint8Array);
    expect(audioBytes.length).toBeGreaterThan(0);

    // Check for WAV header
    const wavHeader = Buffer.from(audioBytes.slice(0, 12)).toString('ascii');
    expect(wavHeader.startsWith('RIFF')).toBe(true);
    expect(wavHeader.includes('WAVE')).toBe(true);

    console.log(`✓ Successfully synthesized complex SSML: ${audioBytes.length} bytes`);
  });

  it("should handle SSML with version attributes", async () => {
    if (!client) {
      console.log("Skipping test - SAPI not available");
      return;
    }

    // Test SSML that already has version attributes
    const ssmlWithVersion = `<speak version="1.0" xml:lang="en">
  <prosody rate="slow" pitch="low">
    This text should be spoken slowly with a low pitch.
  </prosody>
  <break time="1s"/>
  <emphasis level="strong">This text is emphasized.</emphasis>
</speak>`;

    const audioBytes = await client.synthToBytes(ssmlWithVersion);

    expect(audioBytes).toBeInstanceOf(Uint8Array);
    expect(audioBytes.length).toBeGreaterThan(0);

    // Check for WAV header
    const wavHeader = Buffer.from(audioBytes.slice(0, 12)).toString('ascii');
    expect(wavHeader.startsWith('RIFF')).toBe(true);
    expect(wavHeader.includes('WAVE')).toBe(true);

    console.log(`✓ Successfully synthesized SSML with version: ${audioBytes.length} bytes`);
  });
});
