/**
 * Tests for the new audio input functionality
 */

import { validateSpeakInput, getAudioFormatFromFilename, detectAudioFormat, processAudioInput } from '../utils/audio-input';
import type { SpeakInput } from '../types';

describe('Audio Input Utilities', () => {
  describe('validateSpeakInput', () => {
    it('should accept text input', () => {
      const input: SpeakInput = { text: 'Hello world' };
      expect(() => validateSpeakInput(input)).not.toThrow();
    });

    it('should accept filename input', () => {
      const input: SpeakInput = { filename: 'test.mp3' };
      expect(() => validateSpeakInput(input)).not.toThrow();
    });

    it('should accept audioBytes input', () => {
      const input: SpeakInput = { audioBytes: new Uint8Array([1, 2, 3]) };
      expect(() => validateSpeakInput(input)).not.toThrow();
    });

    it('should accept audioStream input', () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        }
      });
      const input: SpeakInput = { audioStream: stream };
      expect(() => validateSpeakInput(input)).not.toThrow();
    });

    it('should throw error when no input provided', () => {
      const input: SpeakInput = {};
      expect(() => validateSpeakInput(input)).toThrow('No input provided');
    });

    it('should throw error when multiple inputs provided', () => {
      const input: SpeakInput = { 
        text: 'Hello', 
        filename: 'test.mp3' 
      };
      expect(() => validateSpeakInput(input)).toThrow('Multiple input sources provided');
    });
  });

  describe('getAudioFormatFromFilename', () => {
    it('should detect MP3 format', () => {
      expect(getAudioFormatFromFilename('test.mp3')).toBe('audio/mpeg');
      expect(getAudioFormatFromFilename('TEST.MP3')).toBe('audio/mpeg');
    });

    it('should detect WAV format', () => {
      expect(getAudioFormatFromFilename('test.wav')).toBe('audio/wav');
    });

    it('should detect OGG format', () => {
      expect(getAudioFormatFromFilename('test.ogg')).toBe('audio/ogg');
    });

    it('should default to WAV for unknown extensions', () => {
      expect(getAudioFormatFromFilename('test.unknown')).toBe('audio/wav');
      expect(getAudioFormatFromFilename('test')).toBe('audio/wav');
    });
  });

  describe('detectAudioFormat', () => {
    it('should detect WAV format from header', () => {
      // WAV header: RIFF....WAVE
      const wavHeader = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // file size
        0x57, 0x41, 0x56, 0x45  // WAVE
      ]);
      expect(detectAudioFormat(wavHeader)).toBe('audio/wav');
    });

    it('should detect MP3 format from ID3 header', () => {
      // ID3 header
      const mp3Header = new Uint8Array([
        0x49, 0x44, 0x33, // ID3
        0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
      expect(detectAudioFormat(mp3Header)).toBe('audio/mpeg');
    });

    it('should detect MP3 format from MPEG frame sync', () => {
      // MPEG frame sync
      const mp3Header = new Uint8Array([
        0xFF, 0xFB, // MPEG frame sync
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
      expect(detectAudioFormat(mp3Header)).toBe('audio/mpeg');
    });

    it('should detect OGG format from header', () => {
      // OGG header: OggS
      const oggHeader = new Uint8Array([
        0x4F, 0x67, 0x67, 0x53, // OggS
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
      expect(detectAudioFormat(oggHeader)).toBe('audio/ogg');
    });

    it('should default to WAV for unknown formats', () => {
      const unknownHeader = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      expect(detectAudioFormat(unknownHeader)).toBe('audio/wav');
    });

    it('should default to WAV for short arrays', () => {
      const shortArray = new Uint8Array([0x00, 0x01]);
      expect(detectAudioFormat(shortArray)).toBe('audio/wav');
    });
  });

  describe('processAudioInput', () => {
    it('should process audioBytes input', async () => {
      const audioBytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // file size
        0x57, 0x41, 0x56, 0x45  // WAVE
      ]);
      const input: SpeakInput = { audioBytes };
      
      const result = await processAudioInput(input);
      expect(result.audioBytes).toBe(audioBytes);
      expect(result.mimeType).toBe('audio/wav');
    });

    it('should process audioStream input', async () => {
      const testData = new Uint8Array([
        0x49, 0x44, 0x33, // ID3
        0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
      
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(testData);
          controller.close();
        }
      });
      
      const input: SpeakInput = { audioStream: stream };
      
      const result = await processAudioInput(input);
      expect(result.audioBytes).toEqual(testData);
      expect(result.mimeType).toBe('audio/mpeg');
    });

    it('should throw error for invalid input', async () => {
      const input: SpeakInput = {};
      await expect(processAudioInput(input)).rejects.toThrow('No input provided');
    });
  });
});
