/**
 * Utility functions for handling different audio input sources
 */

import type { SpeakInput } from "../types";
import { isNode } from "./environment";
import { streamToBuffer } from "./stream-utils";

/**
 * Validates that only one input source is provided
 */
export function validateSpeakInput(input: SpeakInput): void {
  const inputCount = [input.text, input.filename, input.audioBytes, input.audioStream].filter(
    Boolean
  ).length;

  if (inputCount === 0) {
    throw new Error(
      "No input provided. Please provide text, filename, audioBytes, or audioStream."
    );
  }

  if (inputCount > 1) {
    throw new Error(
      "Multiple input sources provided. Please provide only one of: text, filename, audioBytes, or audioStream."
    );
  }
}

/**
 * Determines the audio format from a filename extension
 */
export function getAudioFormatFromFilename(filename: string): string {
  const extension = filename.toLowerCase().split(".").pop();

  switch (extension) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "opus":
      return "audio/opus";
    case "aac":
      return "audio/aac";
    case "flac":
      return "audio/flac";
    default:
      return "audio/wav"; // Default fallback
  }
}

/**
 * Attempts to detect audio format from byte signature
 */
export function detectAudioFormat(audioBytes: Uint8Array): string {
  if (audioBytes.length < 4) {
    return "audio/wav"; // Default fallback
  }

  // Check for common audio file signatures
  const header = Array.from(audioBytes.slice(0, 12));

  // MP3 - ID3 tag or MPEG frame sync
  if (
    (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) || // ID3
    (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)
  ) {
    // MPEG frame sync
    return "audio/mpeg";
  }

  // WAV - RIFF header
  if (
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    header[8] === 0x57 &&
    header[9] === 0x41 &&
    header[10] === 0x56 &&
    header[11] === 0x45
  ) {
    return "audio/wav";
  }

  // OGG
  if (header[0] === 0x4f && header[1] === 0x67 && header[2] === 0x67 && header[3] === 0x53) {
    return "audio/ogg";
  }

  // FLAC
  if (header[0] === 0x66 && header[1] === 0x4c && header[2] === 0x61 && header[3] === 0x43) {
    return "audio/flac";
  }

  return "audio/wav"; // Default fallback
}

/**
 * Reads an audio file and returns its contents as Uint8Array
 * Only works in Node.js environment
 */
export async function readAudioFile(filename: string): Promise<Uint8Array> {
  if (!isNode) {
    throw new Error("File reading is only supported in Node.js environment");
  }

  try {
    const fs = await (new Function('m','return import(m)'))('node:fs/promises');
    const buffer = await fs.readFile(filename);
    return new Uint8Array(buffer);
  } catch (error) {
    throw new Error(
      `Failed to read audio file "${filename}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Converts an audio stream to bytes
 */
export async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const result = await streamToBuffer(stream);

  // Convert Buffer to Uint8Array if needed (Node.js)
  if (result instanceof Buffer) {
    return new Uint8Array(result);
  }

  return result;
}

/**
 * Processes the input and returns audio bytes with format information
 */
export async function processAudioInput(input: SpeakInput): Promise<{
  audioBytes: Uint8Array;
  mimeType: string;
}> {
  validateSpeakInput(input);

  if (input.audioBytes) {
    return {
      audioBytes: input.audioBytes,
      mimeType: detectAudioFormat(input.audioBytes),
    };
  }

  if (input.audioStream) {
    const audioBytes = await streamToBytes(input.audioStream);
    return {
      audioBytes,
      mimeType: detectAudioFormat(audioBytes),
    };
  }

  if (input.filename) {
    const audioBytes = await readAudioFile(input.filename);
    return {
      audioBytes,
      mimeType: getAudioFormatFromFilename(input.filename),
    };
  }

  throw new Error("No valid audio input provided");
}
