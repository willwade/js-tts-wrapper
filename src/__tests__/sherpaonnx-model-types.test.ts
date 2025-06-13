import { describe, it, expect, jest, beforeAll, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// --- Mock Setup for SherpaOnnx Model Types Test ---
const mockGenerate = jest.fn().mockImplementation(() => {
  // Generate a more realistic audio sample (1 second at 22050 Hz)
  const sampleRate = 22050;
  const duration = 1.0; // 1 second
  const samples = new Float32Array(Math.floor(sampleRate * duration));
  
  // Generate a simple sine wave for testing
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5; // 440 Hz tone
  }
  
  return {
    samples,
    sampleRate,
  };
});

const mockOfflineTtsInstance = {
  generate: mockGenerate,
};

const mockOfflineTtsConstructor = jest.fn().mockImplementation(() => {
  return mockOfflineTtsInstance;
});

let SherpaOnnxTTSClient: any;

// Mock the fs module
jest.mock("fs", () => {
  return {
    ...(jest.requireActual("fs") as typeof import('fs')),
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn().mockReturnValue('{}'), // Will be overridden per test
    statSync: jest.fn().mockReturnValue({ size: 1000 }),
    readdirSync: jest.fn().mockReturnValue(["model.onnx", "tokens.txt"]),
    copyFileSync: jest.fn(),
  };
});

// Mock the https module for downloads
jest.mock("https", () => {
  const mockRequest = {
    on: jest.fn().mockReturnThis(),
  };

  return {
    get: jest.fn().mockImplementation((_url: string, callback: any) => {
      const response = {
        statusCode: 200,
        statusMessage: "OK",
        pipe: jest.fn(),
        on: jest.fn(),
      };
      callback(response);
      return mockRequest;
    }),
  };
});

// Mock path module for cross-platform compatibility
jest.mock("path", () => {
  return {
    ...(jest.requireActual("path") as typeof import('path')),
    join: jest.fn().mockImplementation((...args) => args.join('/')),
  };
});

// Mock decompress to prevent actual downloads
jest.mock("decompress", () => {
  return jest.fn().mockResolvedValue([]);
});

// Mock tar-stream to prevent actual extraction
jest.mock("tar-stream", () => {
  return {
    extract: jest.fn().mockReturnValue({
      on: jest.fn(),
      pipe: jest.fn(),
    }),
  };
});

beforeAll(async () => {
  // Mock sherpa-onnx-node
  await jest.unstable_mockModule("sherpa-onnx-node", () => {
    return {
      OfflineTts: mockOfflineTtsConstructor,
      writeWave: jest.fn(),
    };
  });

  // Import the class after mocks are set up
  const module = await import("../engines/sherpaonnx");
  SherpaOnnxTTSClient = module.SherpaOnnxTTSClient;
});

describe("SherpaOnnx Model Types Test", () => {
  let client: any;
  let mockReadFileSync: jest.Mock;

  // Test models representing each type
  const testModels = {
    kokoro: {
      id: "kokoro-en-en-19",
      name: "Kokoro English",
      modelType: "kokoro",
      config: {
        "kokoro-en-en-19": {
          id: "kokoro-en-en-19",
          model_type: "kokoro",
          developer: "kokoro",
          name: "en",
          language: [{ lang_code: "en", language_name: "English", country: "US" }],
          url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-en-v0_19.tar.bz2",
          compression: true,
        }
      }
    },
    matcha: {
      id: "icefall-fs-ljspeech",
      name: "Matcha LJSpeech",
      modelType: "matcha", 
      config: {
        "icefall-fs-ljspeech": {
          id: "icefall-fs-ljspeech",
          model_type: "matcha",
          developer: "icefall",
          name: "ljspeech",
          language: [{ lang_code: "fs", language_name: "Unknown language [fs]", country: "US" }],
          url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/matcha-icefall-en_US-ljspeech.tar.bz2",
          compression: true,
        }
      }
    },
    coqui: {
      id: "coqui-en-ljspeech",
      name: "Coqui LJSpeech",
      modelType: "vits",
      config: {
        "coqui-en-ljspeech": {
          id: "coqui-en-ljspeech",
          model_type: "vits",
          developer: "coqui",
          name: "ljspeech",
          language: [{ lang_code: "en", language_name: "English", country: "US" }],
          url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-coqui-en-ljspeech.tar.bz2",
          compression: true,
        }
      }
    },
    piper: {
      id: "piper-en-amy-medium",
      name: "Piper Amy",
      modelType: "vits",
      config: {
        "piper-en-amy-medium": {
          id: "piper-en-amy-medium",
          model_type: "vits",
          developer: "piper",
          name: "amy",
          language: [{ lang_code: "en", language_name: "English", country: "US" }],
          url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-amy-medium.tar.bz2",
          compression: true,
        }
      }
    },
    ljspeech: {
      id: "ljs-fs-unknown",
      name: "LJSpeech",
      modelType: "vits",
      config: {
        "ljs-fs-unknown": {
          id: "ljs-fs-unknown",
          model_type: "vits",
          developer: "ljs",
          name: "unknown",
          language: [{ lang_code: "fs", language_name: "Unknown language [fs]", country: "US" }],
          url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-ljs.tar.bz2",
          compression: true,
        }
      }
    }
  };

  beforeEach(() => {
    // Get the mock function
    mockReadFileSync = jest.mocked(fs.readFileSync);
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  /**
   * Helper function to validate WAV file structure
   */
  function validateWavFile(wavBytes: Uint8Array): boolean {
    if (wavBytes.length < 44) return false; // WAV header is 44 bytes minimum
    
    // Check RIFF header
    const riffHeader = String.fromCharCode(...wavBytes.slice(0, 4));
    if (riffHeader !== 'RIFF') return false;
    
    // Check WAVE format
    const waveFormat = String.fromCharCode(...wavBytes.slice(8, 12));
    if (waveFormat !== 'WAVE') return false;
    
    // Check fmt chunk
    const fmtChunk = String.fromCharCode(...wavBytes.slice(12, 16));
    if (fmtChunk !== 'fmt ') return false;
    
    // Check data chunk exists
    let dataChunkFound = false;
    for (let i = 36; i < wavBytes.length - 4; i++) {
      const chunk = String.fromCharCode(...wavBytes.slice(i, i + 4));
      if (chunk === 'data') {
        dataChunkFound = true;
        break;
      }
    }
    
    return dataChunkFound;
  }

  /**
   * Helper function to test a specific model type
   */
  async function testModelType(modelInfo: any, testText: string = "Hello, this is a test of the SherpaOnnx TTS engine.") {
    // Mock the models configuration for this specific model
    mockReadFileSync.mockReturnValue(JSON.stringify(modelInfo.config));
    
    // Create client instance
    client = new SherpaOnnxTTSClient({ 
      noDefaultDownload: true,
      modelId: modelInfo.id 
    });

    // Set the voice
    await client.setVoice(modelInfo.id);
    expect(client.getProperty("voice")).toBe(modelInfo.id);

    // Test synthesis to bytes
    const audioBytes = await client.synthToBytes(testText);
    
    // Validate the output
    expect(audioBytes).toBeDefined();
    expect(audioBytes).toBeInstanceOf(Uint8Array);
    expect(audioBytes.length).toBeGreaterThan(44); // Should be larger than WAV header
    
    // Validate WAV file structure
    const isValidWav = validateWavFile(audioBytes);
    expect(isValidWav).toBe(true);
    
    // Test synthesis to bytestream
    const streamResult = await client.synthToBytestream(testText);
    expect(streamResult).toBeDefined();
    expect(streamResult.audioStream).toBeDefined();
    
    return audioBytes;
  }

  // Test each model type
  it("should synthesize speech with Kokoro model and generate valid WAV", async () => {
    const audioBytes = await testModelType(testModels.kokoro);
    
    // Kokoro models typically have higher sample rates
    expect(audioBytes.length).toBeGreaterThan(1000);
    
    console.log(`✓ Kokoro model (${testModels.kokoro.id}) generated ${audioBytes.length} bytes of audio`);
  }, 15000);

  it("should synthesize speech with Matcha model and generate valid WAV", async () => {
    const audioBytes = await testModelType(testModels.matcha);
    
    // Matcha models use vocoder, should produce quality audio
    expect(audioBytes.length).toBeGreaterThan(1000);
    
    console.log(`✓ Matcha model (${testModels.matcha.id}) generated ${audioBytes.length} bytes of audio`);
  }, 15000);

  it("should synthesize speech with Coqui model and generate valid WAV", async () => {
    const audioBytes = await testModelType(testModels.coqui);
    
    expect(audioBytes.length).toBeGreaterThan(1000);
    
    console.log(`✓ Coqui model (${testModels.coqui.id}) generated ${audioBytes.length} bytes of audio`);
  }, 15000);

  it("should synthesize speech with Piper model and generate valid WAV", async () => {
    const audioBytes = await testModelType(testModels.piper);
    
    expect(audioBytes.length).toBeGreaterThan(1000);
    
    console.log(`✓ Piper model (${testModels.piper.id}) generated ${audioBytes.length} bytes of audio`);
  }, 15000);

  it("should synthesize speech with LJSpeech model and generate valid WAV", async () => {
    const audioBytes = await testModelType(testModels.ljspeech);

    expect(audioBytes.length).toBeGreaterThan(1000);

    console.log(`✓ LJSpeech model (${testModels.ljspeech.id}) generated ${audioBytes.length} bytes of audio`);
  }, 15000);

  // Comprehensive test that validates all model types in sequence
  it("should validate all model types can synthesize speech successfully", async () => {
    const results: { [key: string]: number } = {};

    for (const [modelType, modelInfo] of Object.entries(testModels)) {
      console.log(`\n🧪 Testing ${modelType} model: ${modelInfo.name}`);

      try {
        const audioBytes = await testModelType(modelInfo, `Testing ${modelType} model synthesis.`);
        results[modelType] = audioBytes.length;

        // Additional validation for specific model types
        if (modelType === 'kokoro') {
          // Kokoro models should produce high-quality audio
          expect(audioBytes.length).toBeGreaterThan(2000);
        } else if (modelType === 'matcha') {
          // Matcha models use vocoder architecture
          expect(audioBytes.length).toBeGreaterThan(1500);
        }

        console.log(`✅ ${modelType} model test passed - ${audioBytes.length} bytes generated`);
      } catch (error) {
        console.error(`❌ ${modelType} model test failed:`, error);
        throw error;
      }
    }

    // Verify all models produced audio
    expect(Object.keys(results)).toHaveLength(5);

    // Log summary
    console.log('\n📊 Model Type Test Summary:');
    for (const [modelType, size] of Object.entries(results)) {
      console.log(`  ${modelType}: ${size} bytes`);
    }
  }, 30000);

  // Test model type detection
  it("should correctly identify model types", async () => {
    for (const [expectedType, modelInfo] of Object.entries(testModels)) {
      mockReadFileSync.mockReturnValue(JSON.stringify(modelInfo.config));

      client = new SherpaOnnxTTSClient({
        noDefaultDownload: true,
        modelId: modelInfo.id
      });

      // The model type should be correctly identified from the configuration
      const voices = await client.getVoices();
      expect(voices).toBeDefined();
      expect(voices.length).toBeGreaterThan(0);

      // Find our test model in the voices list
      const testVoice = voices.find((voice: any) => voice.id === modelInfo.id);
      expect(testVoice).toBeDefined();

      console.log(`✓ Model type detection for ${expectedType}: ${testVoice?.name || 'Unknown'}`);
    }
  }, 10000);

  // Test error handling for invalid model configurations
  it("should handle invalid model configurations gracefully", async () => {
    // Test with empty configuration
    mockReadFileSync.mockReturnValue('{}');

    client = new SherpaOnnxTTSClient({
      noDefaultDownload: true,
      modelId: "invalid-model"
    });

    // Should not throw an error during initialization
    expect(client).toBeDefined();

    // Should handle missing model gracefully
    const voices = await client.getVoices();
    expect(voices).toBeDefined();
    expect(Array.isArray(voices)).toBe(true);
  }, 5000);

  // Test WAV file format validation in detail
  it("should generate properly formatted WAV files", async () => {
    const modelInfo = testModels.piper; // Use Piper as representative model
    mockReadFileSync.mockReturnValue(JSON.stringify(modelInfo.config));

    client = new SherpaOnnxTTSClient({
      noDefaultDownload: true,
      modelId: modelInfo.id
    });

    await client.setVoice(modelInfo.id);
    const audioBytes = await client.synthToBytes("WAV format validation test.");

    // Detailed WAV format validation
    expect(audioBytes.length).toBeGreaterThan(44);

    // Check RIFF header
    expect(String.fromCharCode(...audioBytes.slice(0, 4))).toBe('RIFF');

    // Check file size in header (should be total file size - 8)
    const fileSizeFromHeader = new DataView(audioBytes.buffer).getUint32(4, true);
    expect(fileSizeFromHeader).toBe(audioBytes.length - 8);

    // Check WAVE format identifier
    expect(String.fromCharCode(...audioBytes.slice(8, 12))).toBe('WAVE');

    // Check fmt chunk
    expect(String.fromCharCode(...audioBytes.slice(12, 16))).toBe('fmt ');

    // Check fmt chunk size (should be 16 for PCM)
    const fmtChunkSize = new DataView(audioBytes.buffer).getUint32(16, true);
    expect(fmtChunkSize).toBe(16);

    // Check audio format (should be 1 for PCM)
    const audioFormat = new DataView(audioBytes.buffer).getUint16(20, true);
    expect(audioFormat).toBe(1);

    // Check number of channels (should be 1 for mono)
    const numChannels = new DataView(audioBytes.buffer).getUint16(22, true);
    expect(numChannels).toBe(1);

    // Check sample rate (should be reasonable)
    const sampleRate = new DataView(audioBytes.buffer).getUint32(24, true);
    expect(sampleRate).toBeGreaterThan(8000);
    expect(sampleRate).toBeLessThanOrEqual(48000);

    console.log(`✓ WAV validation passed - Sample rate: ${sampleRate}Hz, Channels: ${numChannels}, Size: ${audioBytes.length} bytes`);
  }, 10000);

  // Test different text inputs
  it("should handle various text inputs across model types", async () => {
    const testTexts = [
      "Hello world!",
      "This is a longer sentence with multiple words and punctuation.",
      "Numbers: 123, 456, 789.",
      "Special characters: @#$%^&*()",
      "Mixed case: Hello World 123 Test!"
    ];

    const modelInfo = testModels.coqui; // Use Coqui as representative
    mockReadFileSync.mockReturnValue(JSON.stringify(modelInfo.config));

    client = new SherpaOnnxTTSClient({
      noDefaultDownload: true,
      modelId: modelInfo.id
    });

    await client.setVoice(modelInfo.id);

    for (const text of testTexts) {
      const audioBytes = await client.synthToBytes(text);

      expect(audioBytes).toBeDefined();
      expect(audioBytes.length).toBeGreaterThan(44);
      expect(validateWavFile(audioBytes)).toBe(true);

      console.log(`✓ Text "${text.substring(0, 30)}..." -> ${audioBytes.length} bytes`);
    }
  }, 20000);

  // Performance test
  it("should synthesize speech within reasonable time limits", async () => {
    const modelInfo = testModels.piper;
    mockReadFileSync.mockReturnValue(JSON.stringify(modelInfo.config));

    client = new SherpaOnnxTTSClient({
      noDefaultDownload: true,
      modelId: modelInfo.id
    });

    await client.setVoice(modelInfo.id);

    const startTime = Date.now();
    const audioBytes = await client.synthToBytes("Performance test text.");
    const endTime = Date.now();

    const synthesisTime = endTime - startTime;

    expect(audioBytes.length).toBeGreaterThan(44);
    expect(synthesisTime).toBeLessThan(5000); // Should complete within 5 seconds

    console.log(`✓ Synthesis completed in ${synthesisTime}ms`);
  }, 10000);
});
