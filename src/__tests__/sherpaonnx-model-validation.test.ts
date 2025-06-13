import { describe, it, expect, jest, beforeAll, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';

/**
 * Comprehensive SherpaOnnx Model Types Validation Test
 * 
 * This test validates that all major SherpaOnnx model types (Kokoro, Matcha, Coqui, Piper, LJSpeech)
 * can successfully synthesize speech and generate valid WAV files.
 */

// Mock audio generation that simulates different model types
const createMockAudio = (modelType: string, sampleRate: number = 22050) => {
  const duration = 1.0; // 1 second
  const samples = new Float32Array(Math.floor(sampleRate * duration));
  
  // Generate different waveforms for different model types to simulate their characteristics
  for (let i = 0; i < samples.length; i++) {
    switch (modelType) {
      case 'kokoro':
        // Kokoro: Higher quality, more complex waveform
        samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.7 + 
                     Math.sin(2 * Math.PI * 880 * i / sampleRate) * 0.3;
        break;
      case 'matcha':
        // Matcha: Vocoder-based, slightly different characteristics
        samples[i] = Math.sin(2 * Math.PI * 523 * i / sampleRate) * 0.6;
        break;
      case 'vits':
      default:
        // VITS (Coqui, Piper, LJSpeech): Standard waveform
        samples[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
        break;
    }
  }
  
  return { samples, sampleRate };
};

// Enhanced mock that responds to model type
const mockGenerate = jest.fn().mockImplementation((config: any) => {
  const text = config?.text || '';
  const modelType = global.currentModelType || 'vits';
  const sampleRate = modelType === 'kokoro' ? 24000 : 22050;
  
  return createMockAudio(modelType, sampleRate);
});

const mockOfflineTtsInstance = {
  generate: mockGenerate,
};

const mockOfflineTtsConstructor = jest.fn().mockImplementation(() => {
  return mockOfflineTtsInstance;
});

let SherpaOnnxTTSClient: any;

// Comprehensive mocking setup
jest.mock("fs", () => ({
  ...(jest.requireActual("fs") as typeof import('fs')),
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue('{}'),
  statSync: jest.fn().mockReturnValue({ size: 1000 }),
  readdirSync: jest.fn().mockReturnValue(["model.onnx", "tokens.txt", "voices.bin", "espeak-ng-data"]),
  copyFileSync: jest.fn(),
}));

jest.mock("https", () => ({
  get: jest.fn().mockImplementation((_url: string, callback: any) => {
    const response = {
      statusCode: 200,
      statusMessage: "OK",
      pipe: jest.fn(),
      on: jest.fn(),
    };
    callback(response);
    return { on: jest.fn().mockReturnThis() };
  }),
}));

jest.mock("path", () => ({
  ...(jest.requireActual("path") as typeof import('path')),
  join: jest.fn().mockImplementation((...args) => args.join('/')),
}));

jest.mock("decompress", () => jest.fn().mockResolvedValue([]));
jest.mock("tar-stream", () => ({
  extract: jest.fn().mockReturnValue({
    on: jest.fn(),
    pipe: jest.fn(),
  }),
}));

beforeAll(async () => {
  await jest.unstable_mockModule("sherpa-onnx-node", () => ({
    OfflineTts: mockOfflineTtsConstructor,
    writeWave: jest.fn(),
  }));

  const module = await import("../engines/sherpaonnx");
  SherpaOnnxTTSClient = module.SherpaOnnxTTSClient;
});

describe("SherpaOnnx Model Types Validation", () => {
  let client: any;
  let mockReadFileSync: jest.Mock;

  // Test model configurations
  const modelConfigs = {
    kokoro: {
      "kokoro-en-en-19": {
        id: "kokoro-en-en-19",
        model_type: "kokoro",
        developer: "kokoro",
        name: "en",
        language: [{ lang_code: "en", language_name: "English", country: "US" }],
        url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-en-v0_19.tar.bz2",
        compression: true,
        sample_rate: 24000,
      }
    },
    matcha: {
      "icefall-fs-ljspeech": {
        id: "icefall-fs-ljspeech",
        model_type: "matcha",
        developer: "icefall",
        name: "ljspeech",
        language: [{ lang_code: "fs", language_name: "Unknown language [fs]", country: "US" }],
        url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/matcha-icefall-en_US-ljspeech.tar.bz2",
        compression: true,
        sample_rate: 16000,
      }
    },
    coqui: {
      "coqui-en-ljspeech": {
        id: "coqui-en-ljspeech",
        model_type: "vits",
        developer: "coqui",
        name: "ljspeech",
        language: [{ lang_code: "en", language_name: "English", country: "US" }],
        url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-coqui-en-ljspeech.tar.bz2",
        compression: true,
        sample_rate: 16000,
      }
    },
    piper: {
      "piper-en-amy-medium": {
        id: "piper-en-amy-medium",
        model_type: "vits",
        developer: "piper",
        name: "amy",
        language: [{ lang_code: "en", language_name: "English", country: "US" }],
        url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-en_US-amy-medium.tar.bz2",
        compression: true,
        sample_rate: 22050,
      }
    },
    ljspeech: {
      "ljs-fs-unknown": {
        id: "ljs-fs-unknown",
        model_type: "vits",
        developer: "ljs",
        name: "unknown",
        language: [{ lang_code: "fs", language_name: "Unknown language [fs]", country: "US" }],
        url: "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-ljs.tar.bz2",
        compression: true,
        sample_rate: 16000,
      }
    }
  };

  beforeEach(() => {
    mockReadFileSync = jest.mocked(fs.readFileSync);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    global.currentModelType = undefined;
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  /**
   * Validates WAV file format
   */
  function validateWavFile(wavBytes: Uint8Array): { valid: boolean; details: any } {
    if (wavBytes.length < 44) {
      return { valid: false, details: { error: "File too small for WAV header" } };
    }
    
    const view = new DataView(wavBytes.buffer);
    
    // Check RIFF header
    const riffHeader = String.fromCharCode(...wavBytes.slice(0, 4));
    if (riffHeader !== 'RIFF') {
      return { valid: false, details: { error: "Invalid RIFF header" } };
    }
    
    // Check WAVE format
    const waveFormat = String.fromCharCode(...wavBytes.slice(8, 12));
    if (waveFormat !== 'WAVE') {
      return { valid: false, details: { error: "Invalid WAVE format" } };
    }
    
    // Extract audio properties
    const numChannels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);
    
    return {
      valid: true,
      details: {
        channels: numChannels,
        sampleRate,
        bitsPerSample,
        fileSize: wavBytes.length
      }
    };
  }

  /**
   * Tests a specific model type
   */
  async function testModelType(modelType: string, config: any, modelId: string) {
    // Set global model type for mock
    global.currentModelType = modelType;
    
    // Mock the configuration
    mockReadFileSync.mockReturnValue(JSON.stringify(config));
    
    // Create client
    client = new SherpaOnnxTTSClient({ 
      noDefaultDownload: true,
      modelId 
    });

    // Set voice
    await client.setVoice(modelId);
    expect(client.getProperty("voice")).toBe(modelId);

    // Test synthesis
    const testText = `Testing ${modelType} model synthesis with various text patterns.`;
    const audioBytes = await client.synthToBytes(testText);
    
    // Validate output
    expect(audioBytes).toBeDefined();
    expect(audioBytes).toBeInstanceOf(Uint8Array);
    expect(audioBytes.length).toBeGreaterThan(44);
    
    // Validate WAV format
    const validation = validateWavFile(audioBytes);
    expect(validation.valid).toBe(true);
    
    // Test bytestream
    const streamResult = await client.synthToBytestream(testText);
    expect(streamResult).toBeDefined();
    expect(streamResult.audioStream).toBeDefined();
    
    return { audioBytes, validation };
  }

  // Individual model type tests
  it("should synthesize speech with Kokoro model", async () => {
    const result = await testModelType('kokoro', modelConfigs.kokoro, 'kokoro-en-en-19');
    
    expect(result.audioBytes.length).toBeGreaterThan(1000);
    expect(result.validation.details.sampleRate).toBeGreaterThan(16000); // Kokoro typically higher quality
    
    console.log(`✓ Kokoro: ${result.audioBytes.length} bytes, ${result.validation.details.sampleRate}Hz`);
  }, 10000);

  it("should synthesize speech with Matcha model", async () => {
    const result = await testModelType('matcha', modelConfigs.matcha, 'icefall-fs-ljspeech');
    
    expect(result.audioBytes.length).toBeGreaterThan(1000);
    expect(result.validation.valid).toBe(true);
    
    console.log(`✓ Matcha: ${result.audioBytes.length} bytes, ${result.validation.details.sampleRate}Hz`);
  }, 10000);

  it("should synthesize speech with Coqui model", async () => {
    const result = await testModelType('vits', modelConfigs.coqui, 'coqui-en-ljspeech');
    
    expect(result.audioBytes.length).toBeGreaterThan(1000);
    expect(result.validation.valid).toBe(true);
    
    console.log(`✓ Coqui: ${result.audioBytes.length} bytes, ${result.validation.details.sampleRate}Hz`);
  }, 10000);

  it("should synthesize speech with Piper model", async () => {
    const result = await testModelType('vits', modelConfigs.piper, 'piper-en-amy-medium');
    
    expect(result.audioBytes.length).toBeGreaterThan(1000);
    expect(result.validation.valid).toBe(true);
    
    console.log(`✓ Piper: ${result.audioBytes.length} bytes, ${result.validation.details.sampleRate}Hz`);
  }, 10000);

  it("should synthesize speech with LJSpeech model", async () => {
    const result = await testModelType('vits', modelConfigs.ljspeech, 'ljs-fs-unknown');

    expect(result.audioBytes.length).toBeGreaterThan(1000);
    expect(result.validation.valid).toBe(true);

    console.log(`✓ LJSpeech: ${result.audioBytes.length} bytes, ${result.validation.details.sampleRate}Hz`);
  }, 10000);

  // Comprehensive validation test
  it("should validate all model types generate valid WAV files", async () => {
    const results: { [key: string]: any } = {};

    console.log('\n🧪 Running comprehensive model type validation...\n');

    for (const [modelType, config] of Object.entries(modelConfigs)) {
      const modelId = Object.keys(config)[0];
      const modelInfo = config[modelId];

      console.log(`Testing ${modelType} model: ${modelInfo.name} (${modelId})`);

      try {
        const result = await testModelType(
          modelInfo.model_type === 'vits' ? 'vits' : modelInfo.model_type,
          config,
          modelId
        );

        results[modelType] = {
          success: true,
          audioSize: result.audioBytes.length,
          sampleRate: result.validation.details.sampleRate,
          channels: result.validation.details.channels,
          modelType: modelInfo.model_type,
          developer: modelInfo.developer
        };

        // Validate model-specific characteristics
        if (modelInfo.model_type === 'kokoro') {
          expect(result.validation.details.sampleRate).toBeGreaterThanOrEqual(22050);
        }

        console.log(`  ✅ Success: ${result.audioBytes.length} bytes, ${result.validation.details.sampleRate}Hz`);

      } catch (error) {
        console.log(`  ❌ Failed: ${error}`);
        results[modelType] = { success: false, error: error.message };
        throw error;
      }
    }

    // Verify all tests passed
    const successCount = Object.values(results).filter((r: any) => r.success).length;
    expect(successCount).toBe(5);

    console.log('\n📊 Model Type Validation Summary:');
    console.log('=====================================');
    for (const [modelType, result] of Object.entries(results)) {
      if (result.success) {
        console.log(`${modelType.padEnd(10)} | ${result.modelType.padEnd(8)} | ${result.developer.padEnd(10)} | ${result.audioSize.toString().padStart(6)} bytes | ${result.sampleRate}Hz`);
      }
    }
    console.log('=====================================');
    console.log(`✅ All ${successCount}/5 model types validated successfully!`);
  }, 30000);

  // Test different text inputs across model types
  it("should handle various text inputs across all model types", async () => {
    const testTexts = [
      "Hello world!",
      "This is a longer sentence with punctuation, numbers like 123, and symbols @#$.",
      "Testing mixed CASE and numbers: 456-789-0123.",
      "Short.",
      "A very long sentence that contains multiple clauses, various punctuation marks, and should test the model's ability to handle extended text input without any issues or failures."
    ];

    // Test with Piper model as representative
    global.currentModelType = 'vits';
    mockReadFileSync.mockReturnValue(JSON.stringify(modelConfigs.piper));

    client = new SherpaOnnxTTSClient({
      noDefaultDownload: true,
      modelId: 'piper-en-amy-medium'
    });

    await client.setVoice('piper-en-amy-medium');

    for (const text of testTexts) {
      const audioBytes = await client.synthToBytes(text);
      const validation = validateWavFile(audioBytes);

      expect(audioBytes.length).toBeGreaterThan(44);
      expect(validation.valid).toBe(true);

      console.log(`✓ "${text.substring(0, 30)}..." -> ${audioBytes.length} bytes`);
    }
  }, 15000);

  // Performance validation
  it("should synthesize speech within reasonable time limits", async () => {
    global.currentModelType = 'vits';
    mockReadFileSync.mockReturnValue(JSON.stringify(modelConfigs.piper));

    client = new SherpaOnnxTTSClient({
      noDefaultDownload: true,
      modelId: 'piper-en-amy-medium'
    });

    await client.setVoice('piper-en-amy-medium');

    const startTime = Date.now();
    const audioBytes = await client.synthToBytes("Performance test for SherpaOnnx TTS synthesis.");
    const endTime = Date.now();

    const synthesisTime = endTime - startTime;

    expect(audioBytes.length).toBeGreaterThan(44);
    expect(synthesisTime).toBeLessThan(2000); // Should complete within 2 seconds

    console.log(`✓ Synthesis completed in ${synthesisTime}ms`);
  }, 5000);

  // Error handling validation
  it("should handle invalid configurations gracefully", async () => {
    mockReadFileSync.mockReturnValue('{}');

    client = new SherpaOnnxTTSClient({
      noDefaultDownload: true,
      modelId: "invalid-model"
    });

    expect(client).toBeDefined();

    const voices = await client.getVoices();
    expect(voices).toBeDefined();
    expect(Array.isArray(voices)).toBe(true);
  }, 5000);
});
