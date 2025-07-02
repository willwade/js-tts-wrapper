/**
 * Audio format conversion utilities
 * Provides conversion between different audio formats (WAV, MP3, OGG)
 */

import { isNode } from "./environment";
import { detectAudioFormat } from "./audio-input";

/**
 * Supported audio formats for conversion
 */
export type AudioFormat = "wav" | "mp3" | "ogg";

/**
 * Audio conversion options
 */
export interface AudioConversionOptions {
  /** Target sample rate (default: preserve original) */
  sampleRate?: number;
  /** Target bit rate for compressed formats like MP3 (default: 128kbps) */
  bitRate?: number;
  /** Audio quality (0-9 for OGG, 0-320 for MP3) */
  quality?: number;
}

/**
 * Result of audio conversion
 */
export interface AudioConversionResult {
  /** Converted audio data */
  audioBytes: Uint8Array;
  /** Target format */
  format: AudioFormat;
  /** MIME type of the converted audio */
  mimeType: string;
}

/**
 * Check if audio conversion is available in the current environment
 *
 * Audio format conversion is currently only supported in Node.js environments
 * due to the need for external tools like ffmpeg or native Node.js modules.
 *
 * In browser environments:
 * - Engines return their native format without conversion
 * - WebSpeech API engines use browser's native audio capabilities
 * - Format requests are honored only when engines natively support them
 */
export function isAudioConversionAvailable(): boolean {
  return isNode; // Currently only supported in Node.js
}

/**
 * Get MIME type for audio format
 */
export function getMimeTypeForFormat(format: AudioFormat): string {
  switch (format) {
    case "mp3":
      return "audio/mpeg";
    case "ogg":
      return "audio/ogg";
    case "wav":
      return "audio/wav";
    default:
      return "audio/wav";
  }
}

/**
 * Extract WAV audio parameters from WAV file header
 */
export function extractWavParameters(wavBytes: Uint8Array): {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataSize: number;
} | null {
  if (wavBytes.length < 44) {
    return null;
  }

  // Check for RIFF header
  if (
    wavBytes[0] !== 0x52 || // 'R'
    wavBytes[1] !== 0x49 || // 'I'
    wavBytes[2] !== 0x46 || // 'F'
    wavBytes[3] !== 0x46    // 'F'
  ) {
    return null;
  }

  // Check for WAVE format
  if (
    wavBytes[8] !== 0x57 ||  // 'W'
    wavBytes[9] !== 0x41 ||  // 'A'
    wavBytes[10] !== 0x56 || // 'V'
    wavBytes[11] !== 0x45    // 'E'
  ) {
    return null;
  }

  // Extract parameters from WAV header
  const sampleRate = new DataView(wavBytes.buffer).getUint32(24, true);
  const channels = new DataView(wavBytes.buffer).getUint16(22, true);
  const bitsPerSample = new DataView(wavBytes.buffer).getUint16(34, true);
  
  // Find data chunk
  let dataOffset = 44;
  let dataSize = 0;
  
  // Look for 'data' chunk
  for (let i = 12; i < wavBytes.length - 8; i += 4) {
    if (
      wavBytes[i] === 0x64 &&     // 'd'
      wavBytes[i + 1] === 0x61 && // 'a'
      wavBytes[i + 2] === 0x74 && // 't'
      wavBytes[i + 3] === 0x61    // 'a'
    ) {
      dataSize = new DataView(wavBytes.buffer).getUint32(i + 4, true);
      dataOffset = i + 8;
      break;
    }
  }

  return {
    sampleRate,
    channels,
    bitsPerSample,
    dataOffset,
    dataSize
  };
}

/**
 * Convert audio between formats using available Node.js tools
 */
export async function convertAudioFormat(
  inputBytes: Uint8Array,
  targetFormat: AudioFormat,
  options: AudioConversionOptions = {}
): Promise<AudioConversionResult> {
  if (!isNode) {
    throw new Error("Audio conversion is only available in Node.js environment");
  }

  const inputFormat = detectAudioFormat(inputBytes);
  const inputFormatName = inputFormat === "audio/mpeg" ? "mp3" : 
                         inputFormat === "audio/ogg" ? "ogg" : "wav";

  // If already in target format, return as-is
  if (inputFormatName === targetFormat) {
    return {
      audioBytes: inputBytes,
      format: targetFormat,
      mimeType: getMimeTypeForFormat(targetFormat)
    };
  }

  // For now, we'll implement basic conversions
  // More sophisticated conversion can be added later with external libraries

  if (inputFormatName === "wav" && targetFormat === "mp3") {
    return await convertWavToMp3(inputBytes, options);
  }

  if (inputFormatName === "wav" && targetFormat === "ogg") {
    return await convertWavToOgg(inputBytes, options);
  }

  // For other conversions, we'll use external tools if available
  return await convertUsingExternalTools(inputBytes, inputFormatName, targetFormat, options);
}

/**
 * Convert WAV to MP3 using Node.js tools
 */
async function convertWavToMp3(
  wavBytes: Uint8Array,
  options: AudioConversionOptions
): Promise<AudioConversionResult> {
  // For now, we'll use a simple approach with external tools
  // In a production environment, you might want to use libraries like node-lame or ffmpeg
  
  try {
    // Try to use ffmpeg if available
    return await convertUsingFfmpeg(wavBytes, "wav", "mp3", options);
  } catch (error) {
    // Fallback: return WAV with MP3 MIME type and warn
    console.warn("MP3 conversion not available, returning WAV data. Install ffmpeg for proper MP3 conversion.");
    return {
      audioBytes: wavBytes,
      format: "wav", // Actually WAV, but requested MP3
      mimeType: "audio/wav"
    };
  }
}

/**
 * Convert WAV to OGG using Node.js tools
 */
async function convertWavToOgg(
  wavBytes: Uint8Array,
  options: AudioConversionOptions
): Promise<AudioConversionResult> {
  try {
    // Try to use ffmpeg if available
    return await convertUsingFfmpeg(wavBytes, "wav", "ogg", options);
  } catch (error) {
    // Fallback: return WAV with OGG MIME type and warn
    console.warn("OGG conversion not available, returning WAV data. Install ffmpeg for proper OGG conversion.");
    return {
      audioBytes: wavBytes,
      format: "wav", // Actually WAV, but requested OGG
      mimeType: "audio/wav"
    };
  }
}

/**
 * Convert audio using external tools (ffmpeg, etc.)
 */
async function convertUsingExternalTools(
  inputBytes: Uint8Array,
  inputFormat: string,
  targetFormat: AudioFormat,
  options: AudioConversionOptions
): Promise<AudioConversionResult> {
  try {
    return await convertUsingFfmpeg(inputBytes, inputFormat, targetFormat, options);
  } catch (error) {
    // Fallback: return original data with warning
    console.warn(`Audio conversion from ${inputFormat} to ${targetFormat} not available. Returning original format.`);
    return {
      audioBytes: inputBytes,
      format: inputFormat as AudioFormat,
      mimeType: getMimeTypeForFormat(inputFormat as AudioFormat)
    };
  }
}

/**
 * Convert audio using ffmpeg (if available)
 */
async function convertUsingFfmpeg(
  inputBytes: Uint8Array,
  inputFormat: string,
  targetFormat: AudioFormat,
  options: AudioConversionOptions
): Promise<AudioConversionResult> {
  const { spawn } = await import("node:child_process");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { writeFileSync, readFileSync, unlinkSync, existsSync } = await import("node:fs");

  // Create temporary files
  const inputFile = join(tmpdir(), `audio-convert-input-${Date.now()}.${inputFormat}`);
  const outputFile = join(tmpdir(), `audio-convert-output-${Date.now()}.${targetFormat}`);

  try {
    // Write input file
    writeFileSync(inputFile, inputBytes);

    // Build ffmpeg command
    const args = [
      "-i", inputFile,
      "-y", // Overwrite output file
    ];

    // Add format-specific options
    if (targetFormat === "mp3") {
      args.push("-codec:a", "libmp3lame");
      if (options.bitRate) {
        args.push("-b:a", `${options.bitRate}k`);
      }
    } else if (targetFormat === "ogg") {
      args.push("-codec:a", "libvorbis");
      if (options.quality !== undefined) {
        args.push("-q:a", options.quality.toString());
      }
    }

    // Add sample rate if specified
    if (options.sampleRate) {
      args.push("-ar", options.sampleRate.toString());
    }

    args.push(outputFile);

    // Execute ffmpeg
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", args, { stdio: "pipe" });
      
      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });

      ffmpeg.on("error", (error) => {
        reject(new Error(`ffmpeg error: ${error.message}`));
      });
    });

    // Read converted file
    if (!existsSync(outputFile)) {
      throw new Error("ffmpeg did not produce output file");
    }

    const convertedBytes = readFileSync(outputFile);

    return {
      audioBytes: new Uint8Array(convertedBytes),
      format: targetFormat,
      mimeType: getMimeTypeForFormat(targetFormat)
    };

  } finally {
    // Clean up temporary files
    try {
      if (existsSync(inputFile)) unlinkSync(inputFile);
      if (existsSync(outputFile)) unlinkSync(outputFile);
    } catch (cleanupError) {
      console.warn("Could not clean up temporary files:", cleanupError);
    }
  }
}

/**
 * Check if ffmpeg is available
 */
export async function isFFmpegAvailable(): Promise<boolean> {
  if (!isNode) {
    return false;
  }

  try {
    const { spawn } = await import("node:child_process");
    
    return new Promise<boolean>((resolve) => {
      const ffmpeg = spawn("ffmpeg", ["-version"], { stdio: "pipe" });
      
      ffmpeg.on("close", (code) => {
        resolve(code === 0);
      });

      ffmpeg.on("error", () => {
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}
