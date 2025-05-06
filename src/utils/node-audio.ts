/**
 * Utility functions for playing audio in Node.js
 */

import { isNode } from "./environment";

// Define module types
type FS = {
  writeFileSync: (path: string, data: Buffer) => void;
  unlinkSync: (path: string) => void;
  existsSync: (path: string) => boolean;
};

type OS = {
  tmpdir: () => string;
  platform: () => string;
};

type Path = {
  join: (...paths: string[]) => string;
};

type ChildProcess = {
  spawn: (command: string, args: string[]) => any;
};

// Cache the modules
let fs: FS | null = null;
let os: OS | null = null;
let path: Path | null = null;
let childProcess: ChildProcess | null = null;

// Try to load the modules
try {
  // @ts-ignore
  fs = require("node:fs");
  // @ts-ignore
  os = require("node:os");
  // @ts-ignore
  path = require("node:path");
  // @ts-ignore
  childProcess = require("node:child_process");
} catch (_e) {
  // Modules not available
}

/**
 * Play audio in Node.js
 * @param audioBytes Audio data as Uint8Array
 * @returns Promise that resolves when audio playback is complete
 */
export async function playAudioInNode(audioBytes: Uint8Array): Promise<void> {
  if (!isNode) {
    throw new Error("This function can only be used in Node.js");
  }

  // Check if required modules are available
  if (!fs || !os || !path || !childProcess) {
    throw new Error("Failed to load required Node.js modules");
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
      // Write audio bytes to temp file as is
      fs.writeFileSync(tempFile, Buffer.from(audioBytes));
    } else {
      // Create a valid WAV file with the audio bytes as PCM data
      // This is a minimal WAV file header for the audio data
      const sampleRate = 44100;
      const numChannels = 1;
      const bitsPerSample = 8;

      // Calculate sizes
      const dataSize = audioBytes.length;
      const blockAlign = numChannels * (bitsPerSample / 8);
      const byteRate = sampleRate * blockAlign;

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
      wavFile[24] = sampleRate & 0xff;
      wavFile[25] = (sampleRate >> 8) & 0xff;
      wavFile[26] = (sampleRate >> 16) & 0xff;
      wavFile[27] = (sampleRate >> 24) & 0xff;
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

    // Detect platform and play audio using appropriate command
    const platform = os.platform();

    return new Promise<void>((resolve, reject) => {
      let command: string;
      let args: string[];

      if (platform === "darwin") {
        // macOS
        command = "afplay";
        args = [tempFile];
      } else if (platform === "win32") {
        // Windows
        command = "powershell";
        args = ["-c", `(New-Object System.Media.SoundPlayer "${tempFile}").PlaySync()`];
      } else if (platform === "linux") {
        // Linux - try aplay
        command = "aplay";
        args = [tempFile];
      } else {
        // Unsupported platform
        fs.unlinkSync(tempFile);
        reject(new Error(`Unsupported platform: ${platform}`));
        return;
      }

      // Play the audio
      const process = childProcess.spawn(command, args);

      process.on("error", (error: Error) => {
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile);
        } catch (_cleanupError) {
          // Ignore cleanup errors
        }

        reject(error);
      });

      process.on("close", (code: number) => {
        // Clean up temp file
        try {
          fs.unlinkSync(tempFile);
        } catch (_cleanupError) {
          // Ignore cleanup errors
        }

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Audio playback process exited with code ${code}`));
        }
      });
    });
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
