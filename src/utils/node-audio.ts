/**
 * Utility functions for playing audio in Node.js
 */

import { isNode } from "./environment";

// Dynamic import for CommonJS modules
async function dynamicRequire(moduleName: string): Promise<any> {
  // In Node.js, we can use a dynamic import
  if (isNode) {
    try {
      // For Node.js built-in modules
      if (moduleName.startsWith("node:")) {
        return await import(moduleName);
      }

      // For third-party modules
      return await import(moduleName);
    } catch (_importError) {
      // Fallback to global require if available
      try {
        // @ts-ignore
        return require(moduleName);
      } catch (_requireError) {
        // Ignore errors
      }
    }
  }

  throw new Error(`Failed to load module: ${moduleName}`);
}

/**
 * Check if Node.js audio playback is available
 * @returns True if Node.js audio playback is available
 */
export async function isNodeAudioAvailable(): Promise<boolean> {
  if (!isNode) return false;

  try {
    const soundPlay = await dynamicRequire("sound-play");
    // Check if it's a valid module with a play function
    // It could be either soundPlay.play or soundPlay.default.play
    return !!(
      soundPlay &&
      (typeof soundPlay.play === "function" ||
        (soundPlay.default && typeof soundPlay.default.play === "function"))
    );
  } catch (_e) {
    return false;
  }
}

/**
 * Play audio in Node.js
 * @param audioBytes Audio data as Uint8Array
 * @returns Promise that resolves when audio playback is complete
 */
export async function playAudioInNode(
  audioBytes: Uint8Array,
  sampleRate?: number,
  engineName?: string
): Promise<void> {
  if (!isNode) {
    throw new Error("This function can only be used in Node.js");
  }

  // Try to require the necessary modules
  let fs: any;
  let os: any;
  let path: any;
  let soundPlay: any;
  try {
    fs = await dynamicRequire("node:fs");
    os = await dynamicRequire("node:os");
    path = await dynamicRequire("node:path");
    soundPlay = await dynamicRequire("sound-play");
  } catch (error) {
    throw new Error(
      `Failed to load required Node.js modules: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Create a temporary file to play
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `tts-audio-${Date.now()}.wav`);

  try {
    // Check if audioBytes is a valid WAV file (has RIFF header)
    const hasRiffHeader =
      audioBytes.length >= 4 &&
      audioBytes[0] === 0x52 && // 'R'
      audioBytes[1] === 0x49 && // 'I'
      audioBytes[2] === 0x46 && // 'F'
      audioBytes[3] === 0x46; // 'F'

    if (hasRiffHeader) {
      // If we have a WAV file with a RIFF header, we need to check if the sample rate
      // in the header matches the provided sample rate. If not, we need to update the header.
      if (audioBytes.length >= 44) {
        // Create a copy of the audio bytes
        const updatedAudioBytes = new Uint8Array(audioBytes);

        // Special handling for Polly audio
        if (engineName === "polly") {
          // For Polly, use the exact same sample rate as in the Python implementation (16000 Hz)
          // This should match the Python implementation's wav.setparams((1, 2, 16000, 0, "NONE", "NONE"))
          const pollyPlaybackRate = 16000;

          // Update the sample rate in the WAV header (bytes 24-27)
          updatedAudioBytes[24] = pollyPlaybackRate & 0xff;
          updatedAudioBytes[25] = (pollyPlaybackRate >> 8) & 0xff;
          updatedAudioBytes[26] = (pollyPlaybackRate >> 16) & 0xff;
          updatedAudioBytes[27] = (pollyPlaybackRate >> 24) & 0xff;

          // Update the byte rate in the WAV header (bytes 28-31)
          // Byte rate = Sample rate * Num channels * Bits per sample / 8
          const numChannels = updatedAudioBytes[22] | (updatedAudioBytes[23] << 8);
          const bitsPerSample = updatedAudioBytes[34] | (updatedAudioBytes[35] << 8);
          const byteRate = (pollyPlaybackRate * numChannels * bitsPerSample) / 8;

          updatedAudioBytes[28] = byteRate & 0xff;
          updatedAudioBytes[29] = (byteRate >> 8) & 0xff;
          updatedAudioBytes[30] = (byteRate >> 16) & 0xff;
          updatedAudioBytes[31] = (byteRate >> 24) & 0xff;

          // Write the updated audio bytes to the temp file
          fs.writeFileSync(tempFile, Buffer.from(updatedAudioBytes));
        } else if (sampleRate) {
          // For other engines, use the provided sample rate
          // Update the sample rate in the WAV header (bytes 24-27)
          updatedAudioBytes[24] = sampleRate & 0xff;
          updatedAudioBytes[25] = (sampleRate >> 8) & 0xff;
          updatedAudioBytes[26] = (sampleRate >> 16) & 0xff;
          updatedAudioBytes[27] = (sampleRate >> 24) & 0xff;

          // Update the byte rate in the WAV header (bytes 28-31)
          // Byte rate = Sample rate * Num channels * Bits per sample / 8
          const numChannels = updatedAudioBytes[22] | (updatedAudioBytes[23] << 8);
          const bitsPerSample = updatedAudioBytes[34] | (updatedAudioBytes[35] << 8);
          const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;

          updatedAudioBytes[28] = byteRate & 0xff;
          updatedAudioBytes[29] = (byteRate >> 8) & 0xff;
          updatedAudioBytes[30] = (byteRate >> 16) & 0xff;
          updatedAudioBytes[31] = (byteRate >> 24) & 0xff;

          // Write the updated audio bytes to the temp file
          fs.writeFileSync(tempFile, Buffer.from(updatedAudioBytes));
        } else {
          // Write audio bytes to temp file as is
          fs.writeFileSync(tempFile, Buffer.from(audioBytes));
        }
      } else {
        // Write audio bytes to temp file as is
        fs.writeFileSync(tempFile, Buffer.from(audioBytes));
      }
    } else {
      // Create a valid WAV file with the audio bytes as PCM data
      // This is a minimal WAV file header for the audio data
      // Use the provided sample rate or 24000 Hz as a default
      // Different engines use different sample rates:
      // - WitAI and many others: 24000 Hz
      // - Polly PCM: 16000 Hz
      // - Watson: 22050 Hz
      let actualSampleRate = sampleRate || 24000;

      // Special handling for Polly audio
      if (engineName === "polly") {
        // For Polly, use the exact same sample rate as in the Python implementation (16000 Hz)
        // This should match the Python implementation's wav.setparams((1, 2, 16000, 0, "NONE", "NONE"))
        actualSampleRate = 16000;
      }
      const numChannels = 1;
      const bitsPerSample = 16;

      // Calculate sizes
      const dataSize = audioBytes.length;
      const blockAlign = numChannels * (bitsPerSample / 8);
      const byteRate = actualSampleRate * blockAlign;

      // Create WAV header
      const headerSize = 44; // Standard WAV header size
      const wavFile = new Uint8Array(headerSize + dataSize);

      // RIFF header
      wavFile.set([0x52, 0x49, 0x46, 0x46]); // "RIFF"
      // Chunk size (file size - 8)
      const chunkSize = headerSize + dataSize - 8;
      wavFile[4] = chunkSize & 0xff;
      wavFile[5] = (chunkSize >> 8) & 0xff;
      wavFile[6] = (chunkSize >> 16) & 0xff;
      wavFile[7] = (chunkSize >> 24) & 0xff;
      wavFile.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"

      // Format chunk
      wavFile.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
      wavFile[16] = 16; // Chunk size (16 for PCM)
      wavFile[17] = 0;
      wavFile[18] = 0;
      wavFile[19] = 0;
      wavFile[20] = 1; // Audio format (1 for PCM)
      wavFile[21] = 0;
      wavFile[22] = numChannels; // Number of channels
      wavFile[23] = 0;
      // Sample rate
      wavFile[24] = actualSampleRate & 0xff;
      wavFile[25] = (actualSampleRate >> 8) & 0xff;
      wavFile[26] = (actualSampleRate >> 16) & 0xff;
      wavFile[27] = (actualSampleRate >> 24) & 0xff;
      // Byte rate
      wavFile[28] = byteRate & 0xff;
      wavFile[29] = (byteRate >> 8) & 0xff;
      wavFile[30] = (byteRate >> 16) & 0xff;
      wavFile[31] = (byteRate >> 24) & 0xff;
      // Block align
      wavFile[32] = blockAlign & 0xff;
      wavFile[33] = (blockAlign >> 8) & 0xff;
      // Bits per sample
      wavFile[34] = bitsPerSample & 0xff;
      wavFile[35] = (bitsPerSample >> 8) & 0xff;

      // Data chunk
      wavFile.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
      // Data size
      wavFile[40] = dataSize & 0xff;
      wavFile[41] = (dataSize >> 8) & 0xff;
      wavFile[42] = (dataSize >> 16) & 0xff;
      wavFile[43] = (dataSize >> 24) & 0xff;

      // Add audio data
      wavFile.set(audioBytes, 44);

      // Write WAV file
      fs.writeFileSync(tempFile, Buffer.from(wavFile));
    }

    try {
      // Play the audio using sound-play
      // Handle both CommonJS and ES module formats
      if (typeof soundPlay.play === "function") {
        await soundPlay.play(tempFile);
      } else if (soundPlay.default && typeof soundPlay.default.play === "function") {
        await soundPlay.default.play(tempFile);
      } else {
        throw new Error("sound-play module does not have a play function");
      }
    } finally {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (_cleanupError) {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    // Clean up temp file if it exists
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (_cleanupError) {
      // Ignore cleanup errors
    }

    // Re-throw the original error
    throw error;
  }
}
