/**
 * Audio format conversion utilities
 * Provides conversion between different audio formats (WAV, MP3, OGG)
 */

import { detectAudioFormat } from "./audio-input";
import { isNode } from "./environment";

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
    wavBytes[3] !== 0x46 // 'F'
  ) {
    return null;
  }

  // Check for WAVE format
  if (
    wavBytes[8] !== 0x57 || // 'W'
    wavBytes[9] !== 0x41 || // 'A'
    wavBytes[10] !== 0x56 || // 'V'
    wavBytes[11] !== 0x45 // 'E'
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
      wavBytes[i] === 0x64 && // 'd'
      wavBytes[i + 1] === 0x61 && // 'a'
      wavBytes[i + 2] === 0x74 && // 't'
      wavBytes[i + 3] === 0x61 // 'a'
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
    dataSize,
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
  const inputFormatName =
    inputFormat === "audio/mpeg" ? "mp3" : inputFormat === "audio/ogg" ? "ogg" : "wav";

  // If already in target format, return as-is
  if (inputFormatName === targetFormat) {
    return {
      audioBytes: inputBytes,
      format: targetFormat,
      mimeType: getMimeTypeForFormat(targetFormat),
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
  // Try pure JavaScript conversion first (using lamejs)
  try {
    return await convertWavToMp3UsingLamejs(wavBytes, options);
  } catch (lamejsError) {
    console.warn(
      "Pure JavaScript MP3 conversion failed:",
      lamejsError instanceof Error ? lamejsError.message : String(lamejsError)
    );

    // Fallback to ffmpeg if available
    try {
      return await convertUsingFfmpeg(wavBytes, "wav", "mp3", options);
    } catch (ffmpegError) {
      // Both methods failed - throw a proper error instead of silently returning WAV
      throw new Error(
        `MP3 conversion failed. Pure JavaScript conversion error: ${lamejsError instanceof Error ? lamejsError.message : String(lamejsError)}. FFmpeg conversion error: ${ffmpegError instanceof Error ? ffmpegError.message : String(ffmpegError)}. Install ffmpeg or ensure WAV data is valid for proper MP3 conversion.`
      );
    }
  }
}

/**
 * Convert WAV to MP3 using pure JavaScript (lamejs)
 */
async function convertWavToMp3UsingLamejs(
  wavBytes: Uint8Array,
  options: AudioConversionOptions
): Promise<AudioConversionResult> {
  try {
    // Load the bundled lamejs version to avoid module dependency issues
    const lamejs = await loadLamejsBundled();

    // Parse WAV header to extract audio data and parameters
    const wavInfo = parseWavHeader(wavBytes);

    // Create MP3 encoder with WAV parameters
    const bitRate = options.bitRate || 128; // Default to 128 kbps
    const mp3encoder = new lamejs.Mp3Encoder(wavInfo.channels, wavInfo.sampleRate, bitRate);

    // Convert audio data to Int16Array format expected by lamejs
    const samples = convertWavDataToInt16Array(wavInfo.audioData, wavInfo.bitsPerSample);

    // Encode to MP3
    const mp3Data: Uint8Array[] = [];
    const sampleBlockSize = 1152; // Optimal block size for lamejs (multiple of 576)

    if (wavInfo.channels === 1) {
      // Mono encoding
      for (let i = 0; i < samples.length; i += sampleBlockSize) {
        const sampleChunk = samples.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
        if (mp3buf.length > 0) {
          mp3Data.push(new Uint8Array(mp3buf));
        }
      }
    } else if (wavInfo.channels === 2) {
      // Stereo encoding - deinterleave samples
      const leftSamples = new Int16Array(samples.length / 2);
      const rightSamples = new Int16Array(samples.length / 2);

      for (let i = 0; i < samples.length; i += 2) {
        leftSamples[i / 2] = samples[i];
        rightSamples[i / 2] = samples[i + 1];
      }

      for (let i = 0; i < leftSamples.length; i += sampleBlockSize) {
        const leftChunk = leftSamples.subarray(i, i + sampleBlockSize);
        const rightChunk = rightSamples.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
        if (mp3buf.length > 0) {
          mp3Data.push(new Uint8Array(mp3buf));
        }
      }
    } else {
      throw new Error(
        `Unsupported channel count: ${wavInfo.channels}. Only mono and stereo are supported.`
      );
    }

    // Flush encoder
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }

    // Combine all MP3 data chunks
    const totalLength = mp3Data.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of mp3Data) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return {
      audioBytes: result,
      format: "mp3",
      mimeType: "audio/mpeg",
    };
  } catch (error) {
    throw new Error(
      `Pure JavaScript MP3 conversion failed: ${error instanceof Error ? error.message : String(error)}`
    );
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
    // Throw proper error instead of silent fallback
    throw new Error(
      `OGG conversion failed: ${error instanceof Error ? error.message : String(error)}. Install ffmpeg for OGG conversion.`
    );
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
    // Throw proper error instead of silent fallback
    throw new Error(
      `Audio conversion from ${inputFormat} to ${targetFormat} failed: ${error instanceof Error ? error.message : String(error)}. Install ffmpeg for audio format conversion.`
    );
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
  const { spawn } = await (new Function('m','return import(m)'))('node:child_process');
  const { tmpdir } = await (new Function('m','return import(m)'))('node:os');
  const { join } = await (new Function('m','return import(m)'))('node:path');
  const { writeFileSync, readFileSync, unlinkSync, existsSync } = await (new Function('m','return import(m)'))('node:fs');

  // Create temporary files
  const inputFile = join(tmpdir(), `audio-convert-input-${Date.now()}.${inputFormat}`);
  const outputFile = join(tmpdir(), `audio-convert-output-${Date.now()}.${targetFormat}`);

  try {
    // Write input file
    writeFileSync(inputFile, inputBytes);

    // Build ffmpeg command
    const args = [
      "-i",
      inputFile,
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

      ffmpeg.on("close", (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });

      ffmpeg.on("error", (error: Error) => {
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
      mimeType: getMimeTypeForFormat(targetFormat),
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
 * Load the bundled lamejs library to avoid module dependency issues
 */
async function loadLamejsBundled(): Promise<any> {
  const { readFileSync } = await (new Function('m','return import(m)'))('node:fs');
  const { join } = await (new Function('m','return import(m)'))('node:path');
  const vm = await (new Function('m','return import(m)'))('node:vm');

  // Find the bundled lamejs file
  const lamejsPath = join(process.cwd(), "node_modules", "lamejs", "lame.all.js");
  const lamejsCode = readFileSync(lamejsPath, "utf8");

  // Create a context and execute the bundled code
  const context: any = {
    console,
    module: { exports: {} },
    exports: {},
  };
  vm.createContext(context);
  vm.runInContext(lamejsCode, context);

  // Return the lamejs object
  return context.lamejs || context;
}

/**
 * Parse WAV file header to extract audio parameters and data
 */
function parseWavHeader(wavBytes: Uint8Array): {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  audioData: Uint8Array;
} {
  // Check for RIFF header
  if (wavBytes.length < 44) {
    throw new Error("Invalid WAV file: too short");
  }

  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);

  // Check RIFF signature
  const riffSignature = String.fromCharCode(wavBytes[0], wavBytes[1], wavBytes[2], wavBytes[3]);
  if (riffSignature !== "RIFF") {
    throw new Error("Invalid WAV file: missing RIFF signature");
  }

  // Check WAVE signature
  const waveSignature = String.fromCharCode(wavBytes[8], wavBytes[9], wavBytes[10], wavBytes[11]);
  if (waveSignature !== "WAVE") {
    throw new Error("Invalid WAV file: missing WAVE signature");
  }

  // Find fmt chunk
  let offset = 12;
  while (offset < wavBytes.length - 8) {
    const chunkId = String.fromCharCode(
      wavBytes[offset],
      wavBytes[offset + 1],
      wavBytes[offset + 2],
      wavBytes[offset + 3]
    );
    const chunkSize = view.getUint32(offset + 4, true); // little-endian

    if (chunkId === "fmt ") {
      // Parse format chunk
      const audioFormat = view.getUint16(offset + 8, true);
      if (audioFormat !== 1) {
        throw new Error(
          `Unsupported WAV format: ${audioFormat}. Only PCM (format 1) is supported.`
        );
      }

      const channels = view.getUint16(offset + 10, true);
      const sampleRate = view.getUint32(offset + 12, true);
      const bitsPerSample = view.getUint16(offset + 22, true);

      // Find data chunk
      let dataOffset = offset + 8 + chunkSize;
      while (dataOffset < wavBytes.length - 8) {
        const dataChunkId = String.fromCharCode(
          wavBytes[dataOffset],
          wavBytes[dataOffset + 1],
          wavBytes[dataOffset + 2],
          wavBytes[dataOffset + 3]
        );
        const dataChunkSize = view.getUint32(dataOffset + 4, true);

        if (dataChunkId === "data") {
          const audioData = wavBytes.slice(dataOffset + 8, dataOffset + 8 + dataChunkSize);
          return {
            channels,
            sampleRate,
            bitsPerSample,
            audioData,
          };
        }

        dataOffset += 8 + dataChunkSize;
      }

      throw new Error("Invalid WAV file: data chunk not found");
    }

    offset += 8 + chunkSize;
  }

  throw new Error("Invalid WAV file: fmt chunk not found");
}

/**
 * Convert WAV audio data to Int16Array format expected by lamejs
 */
function convertWavDataToInt16Array(audioData: Uint8Array, bitsPerSample: number): Int16Array {
  if (bitsPerSample === 16) {
    // Already 16-bit, just create Int16Array view
    return new Int16Array(audioData.buffer, audioData.byteOffset, audioData.length / 2);
  }
  if (bitsPerSample === 8) {
    // Convert 8-bit unsigned to 16-bit signed
    const result = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      // Convert from 0-255 to -32768 to 32767
      result[i] = (audioData[i] - 128) * 256;
    }
    return result;
  }
  if (bitsPerSample === 24) {
    // Convert 24-bit to 16-bit
    const result = new Int16Array(audioData.length / 3);
    for (let i = 0; i < result.length; i++) {
      const sample24 =
        audioData[i * 3] | (audioData[i * 3 + 1] << 8) | (audioData[i * 3 + 2] << 16);
      // Convert from 24-bit signed to 16-bit signed
      const sample24Signed = sample24 > 0x7fffff ? sample24 - 0x1000000 : sample24;
      result[i] = Math.round(sample24Signed / 256); // Scale down from 24-bit to 16-bit
    }
    return result;
  }
  if (bitsPerSample === 32) {
    // Convert 32-bit to 16-bit
    const view = new DataView(audioData.buffer, audioData.byteOffset, audioData.byteLength);
    const result = new Int16Array(audioData.length / 4);
    for (let i = 0; i < result.length; i++) {
      const sample32 = view.getInt32(i * 4, true); // little-endian
      result[i] = Math.round(sample32 / 65536); // Scale down from 32-bit to 16-bit
    }
    return result;
  }
  throw new Error(`Unsupported bits per sample: ${bitsPerSample}. Supported: 8, 16, 24, 32.`);
}

/**
 * Check if ffmpeg is available
 */
export async function isFFmpegAvailable(): Promise<boolean> {
  if (!isNode) {
    return false;
  }

  try {
    const { spawn } = await (new Function('m','return import(m)'))('node:child_process');

    return new Promise<boolean>((resolve) => {
      const ffmpeg = spawn("ffmpeg", ["-version"], { stdio: "pipe" });

      ffmpeg.on("close", (code: number) => {
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
