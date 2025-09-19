/**
 * Utility functions for playing audio in Node.js
 */

import { detectAudioFormat } from "./audio-input";
import { isNode } from "./environment";

// Global state for audio playback
interface AudioState {
  isPlaying: boolean;
  isPaused: boolean;
  currentProcess: any;
  tempFile: string | null;
  childProcess: any;
  fs: any;
}

const audioState: AudioState = {
  isPlaying: false,
  isPaused: false,
  currentProcess: null,
  tempFile: null,
  childProcess: null,
  fs: null,
};

// Note: Removed an old dynamic-require helper to avoid bundler warnings in browser builds.

/**
 * Check if Node.js audio playback is available
 * @returns True if Node.js audio playback is available
 */
export async function isNodeAudioAvailable(): Promise<boolean> {
  if (!isNode) return false;

  try {
    // Try to load required modules
    const childProcess = await (new Function('m','return import(m)'))('node:child_process');
    const fs = await (new Function('m','return import(m)'))('node:fs');

    // Store for later use
    audioState.childProcess = childProcess;
    audioState.fs = fs;

    // Check if we have a suitable audio player
    const platform = process.platform;

    if (platform === "darwin") {
      // Check if afplay is available on macOS
      try {
        childProcess.execSync("which afplay", { stdio: "ignore" });
        return true;
      } catch (_error) {
        return false;
      }
    } else if (platform === "win32") {
      // Windows should have PowerShell available
      return true;
    } else {
      // Check if aplay is available on Linux
      try {
        childProcess.execSync("which aplay", { stdio: "ignore" });
        return true;
      } catch (_error) {
        return false;
      }
    }
  } catch (_error) {
    return false;
  }
}

// These functions are no longer used, but we keep them for reference
// in case we need to handle WAV files in the future

/**
 * Parse a WAV file header to extract audio format information
 * @param audioBytes Audio data as Uint8Array
 * @returns Object containing audio format information
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// @ts-ignore
function _unusedParseWavHeader(audioBytes: Uint8Array): {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataSize: number;
  isValidWav: boolean;
} {
  const result = {
    sampleRate: 0,
    numChannels: 0,
    bitsPerSample: 0,
    dataOffset: 0,
    dataSize: 0,
    isValidWav: false,
  };

  // Check if it's a valid WAV file (has RIFF header)
  const hasRiffHeader =
    audioBytes.length >= 4 &&
    audioBytes[0] === 0x52 && // 'R'
    audioBytes[1] === 0x49 && // 'I'
    audioBytes[2] === 0x46 && // 'F'
    audioBytes[3] === 0x46; // 'F'

  if (!hasRiffHeader || audioBytes.length < 44) {
    return result;
  }

  result.isValidWav = true;
  result.numChannels = audioBytes[22] | (audioBytes[23] << 8);
  result.sampleRate =
    audioBytes[24] | (audioBytes[25] << 8) | (audioBytes[26] << 16) | (audioBytes[27] << 24);
  result.bitsPerSample = audioBytes[34] | (audioBytes[35] << 8);

  // Find the data chunk
  let offset = 36;
  while (offset < audioBytes.length - 8) {
    if (
      audioBytes[offset] === 0x64 && // 'd'
      audioBytes[offset + 1] === 0x61 && // 'a'
      audioBytes[offset + 2] === 0x74 && // 't'
      audioBytes[offset + 3] === 0x61 // 'a'
    ) {
      // Found the data chunk
      const dataSize =
        audioBytes[offset + 4] |
        (audioBytes[offset + 5] << 8) |
        (audioBytes[offset + 6] << 16) |
        (audioBytes[offset + 7] << 24);
      result.dataOffset = offset + 8;
      result.dataSize = dataSize;
      break;
    }
    offset += 4;
    // Skip the chunk size
    const chunkSize =
      audioBytes[offset] |
      (audioBytes[offset + 1] << 8) |
      (audioBytes[offset + 2] << 16) |
      (audioBytes[offset + 3] << 24);
    offset += 4 + chunkSize;
  }

  return result;
}

/**
 * Create a WAV file with the given audio data
 * @param audioBytes Audio data as Uint8Array
 * @param sampleRate Sample rate in Hz
 * @param numChannels Number of channels
 * @param bitsPerSample Bits per sample
 * @returns Uint8Array containing the WAV file
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// @ts-ignore
function _unusedCreateWavFile(
  audioBytes: Uint8Array,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number
): Uint8Array {
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

  return wavFile;
}

/**
 * Create a WAV header for raw PCM audio data
 * @param audioData Raw PCM audio data
 * @param sampleRate Sample rate in Hz
 * @param numChannels Number of audio channels (default: 1)
 * @param bitsPerSample Bits per sample (default: 16)
 * @returns Uint8Array containing the complete WAV file
 */
function createWavFile(
  audioData: Uint8Array,
  sampleRate: number,
  numChannels = 1,
  bitsPerSample = 16
): Uint8Array {
  // Calculate sizes
  const dataSize = audioData.length;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;

  // Create WAV header (44 bytes)
  const headerSize = 44;
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
  wavFile.set(audioData, 44);

  return wavFile;
}

/**
 * Check if audio data is raw PCM (no audio format header)
 * @param audioBytes Audio data to check
 * @returns True if the data appears to be raw PCM
 */
function isRawPCM(audioBytes: Uint8Array): boolean {
  // Use the existing audio format detection to check if it's a known format
  const detectedFormat = detectAudioFormat(audioBytes);

  // If it's detected as WAV but we default to WAV for unknown formats,
  // we need to check if it actually has a valid WAV header
  if (detectedFormat === "audio/wav") {
    // Check if it actually has a RIFF header
    const hasRiffHeader =
      audioBytes.length >= 12 &&
      audioBytes[0] === 0x52 && // 'R'
      audioBytes[1] === 0x49 && // 'I'
      audioBytes[2] === 0x46 && // 'F'
      audioBytes[3] === 0x46 && // 'F'
      audioBytes[8] === 0x57 && // 'W'
      audioBytes[9] === 0x41 && // 'A'
      audioBytes[10] === 0x56 && // 'V'
      audioBytes[11] === 0x45; // 'E'

    // If detectAudioFormat returned WAV but there's no valid header, it's raw PCM
    return !hasRiffHeader;
  }

  // If it's detected as MP3, OGG, or other formats, it's not raw PCM
  return false;
}

/**
 * Play audio in Node.js
 * @param audioBytes Audio data as Uint8Array
 * @param sampleRate Sample rate in Hz (default: 24000 for WitAI, 16000 for others)
 * @param engineName Name of the TTS engine (used to determine if raw PCM conversion is needed)
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

  // Stop any currently playing audio
  stopAudioPlayback();

  try {
    // Load required modules if not already loaded
    if (!audioState.childProcess || !audioState.fs) {
      audioState.childProcess = await (new Function('m','return import(m)'))('node:child_process');
      audioState.fs = await (new Function('m','return import(m)'))('node:fs');
    }

    const os = await (new Function('m','return import(m)'))('node:os');
    const path = await (new Function('m','return import(m)'))('node:path');

    // Detect the audio format to determine the correct file extension
    const detectedFormat = detectAudioFormat(audioBytes);
    let fileExtension = "wav"; // Default

    if (detectedFormat === "audio/mpeg") {
      fileExtension = "mp3";
    } else if (detectedFormat === "audio/ogg") {
      fileExtension = "ogg";
    } else if (detectedFormat === "audio/wav") {
      fileExtension = "wav";
    }

    // Create a temporary file to play with the correct extension
    const tempDir = os.tmpdir();
    audioState.tempFile = path.join(tempDir, `tts-audio-${Date.now()}.${fileExtension}`);

    // Determine if we need to add a WAV header
    let finalAudioBytes = audioBytes;

    // Check if this is raw PCM data that needs a WAV header
    if (isRawPCM(audioBytes)) {
      // Determine sample rate based on engine
      let actualSampleRate = sampleRate || 24000; // Default to WitAI's sample rate

      if (engineName === "witai") {
        actualSampleRate = 24000;
      } else if (engineName === "polly") {
        actualSampleRate = 16000;
      }

      finalAudioBytes = createWavFile(audioBytes, actualSampleRate);
      // Update file extension to WAV since we're adding a WAV header
      const tempFileWav = path.join(tempDir, `tts-audio-${Date.now()}.wav`);
      audioState.tempFile = tempFileWav;
    }

    // Write the audio data to the temp file
    audioState.fs.writeFileSync(audioState.tempFile, Buffer.from(finalAudioBytes));
    console.log(`Audio saved to temporary file: ${audioState.tempFile}`);

    // Determine which player to use based on platform
    let command: string;
    let args: string[];

    const platform = process.platform;

    if (!audioState.tempFile) {
      throw new Error("Temporary audio file was not created for playback");
    }
    const tempFile: string = audioState.tempFile;

    if (platform === "darwin") {
      // macOS - afplay supports WAV, MP3, and many other formats
      command = "afplay";
      args = [tempFile];
    } else if (platform === "win32") {
      // Windows - System.Media.SoundPlayer only supports WAV files reliably
      // For non-WAV files, we need to convert them or use alternative playback
      if (fileExtension === "mp3" || fileExtension === "ogg") {
        // For MP3/OGG files, try to use Windows Media Player first
        // If that fails, we'll fall back to converting to WAV
        command = "powershell";
        args = [
          "-c",
          `
          try {
            Add-Type -AssemblyName presentationCore
            $mediaPlayer = New-Object system.windows.media.mediaplayer
            $mediaPlayer.open([uri]"${audioState.tempFile}")
            $mediaPlayer.Play()
            Start-Sleep -Seconds 1
            while($mediaPlayer.NaturalDuration.HasTimeSpan -eq $false) { Start-Sleep -Milliseconds 100 }
            $duration = $mediaPlayer.NaturalDuration.TimeSpan.TotalSeconds
            Start-Sleep -Seconds $duration
            $mediaPlayer.Stop()
            $mediaPlayer.Close()
          } catch {
            Write-Error "Failed to play audio file: $_"
            exit 1
          }
        `,
        ];
      } else {
        // For WAV files, use System.Media.SoundPlayer (most reliable)
        command = "powershell";
        args = ["-c", `(New-Object System.Media.SoundPlayer "${tempFile}").PlaySync()`];
      }
    } else {
      // Linux and others - use different players based on format
      if (fileExtension === "mp3") {
        // Try mpg123 for MP3 files
        command = "mpg123";
        args = ["-q", tempFile];
      } else if (fileExtension === "ogg") {
        // Try ogg123 for OGG files
        command = "ogg123";
        args = ["-q", tempFile];
      } else {
        // Use aplay for WAV files
        command = "aplay";
        args = ["-q", tempFile];
      }
    }

    console.log(`Playing audio with ${command}...`);

    return new Promise((resolve, reject) => {
      try {
        // Spawn the process
        const process = audioState.childProcess.spawn(command, args);
        audioState.currentProcess = process;
        audioState.isPlaying = true;
        audioState.isPaused = false;

        // Handle process events
        process.on("close", (code: number) => {
          console.log(`Audio playback process exited with code ${code}`);
          cleanupTempFile();
          audioState.currentProcess = null;
          audioState.isPlaying = false;
          audioState.isPaused = false;
          resolve();
        });

        process.on("error", (err: Error) => {
          console.error("Audio playback process error:", err);
          cleanupTempFile();
          audioState.currentProcess = null;
          audioState.isPlaying = false;
          audioState.isPaused = false;
          reject(err);
        });
      } catch (error) {
        console.error("Error starting audio playback:", error);
        cleanupTempFile();
        audioState.currentProcess = null;
        audioState.isPlaying = false;
        audioState.isPaused = false;
        reject(error);
      }
    });
  } catch (error) {
    cleanupTempFile();
    throw error;
  }
}

/**
 * Clean up temporary audio file
 */
function cleanupTempFile(): void {
  if (audioState.tempFile && audioState.fs) {
    try {
      if (audioState.fs.existsSync(audioState.tempFile)) {
        audioState.fs.unlinkSync(audioState.tempFile);
      }
    } catch (error) {
      console.error("Error cleaning up temp file:", error);
    }
    audioState.tempFile = null;
  }
}

/**
 * Pause audio playback by stopping the current process
 * @returns True if playback was paused, false otherwise
 */
export function pauseAudioPlayback(): boolean {
  if (audioState.currentProcess && audioState.isPlaying && !audioState.isPaused) {
    try {
      // We'll implement pause by killing the process
      // This is a simple approach that works across platforms
      console.log("Pausing audio playback...");

      if (audioState.currentProcess.kill) {
        audioState.currentProcess.kill();
        audioState.isPaused = true;
        return true;
      }
    } catch (error) {
      console.error("Error pausing audio playback:", error);
    }
  }
  return false;
}

/**
 * Resume audio playback is not supported in this implementation
 * @returns Always false as resume is not supported
 */
export function resumeAudioPlayback(): boolean {
  console.log("Resume not supported in the current implementation");
  return false;
}

/**
 * Stop audio playback
 * @returns True if playback was stopped, false otherwise
 */
export function stopAudioPlayback(): boolean {
  if (audioState.currentProcess && (audioState.isPlaying || audioState.isPaused)) {
    try {
      // Kill the audio playback process
      if (audioState.currentProcess.kill) {
        audioState.currentProcess.kill();
      }

      console.log("Stopped audio playback");

      // Clean up
      cleanupTempFile();
      audioState.currentProcess = null;
      audioState.isPlaying = false;
      audioState.isPaused = false;
      return true;
    } catch (error) {
      console.error("Error stopping audio playback:", error);
      // Reset state even if there was an error
      audioState.currentProcess = null;
      audioState.isPlaying = false;
      audioState.isPaused = false;
    }
  }
  return false;
}
