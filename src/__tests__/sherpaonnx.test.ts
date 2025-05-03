import { describe, it, expect, jest, beforeAll, beforeEach, afterEach, test } from '@jest/globals';

// --- Refactored Mock Setup ---
const mockGenerate = jest.fn().mockImplementation(() => {
  return {
    samples: new Float32Array(1600),
    sampleRate: 16000,
    wordBoundaries: [
      { word: 'This', start: 0.1, end: 0.3 },
      { word: 'is', start: 0.35, end: 0.45 },
      { word: 'a', start: 0.5, end: 0.55 },
      { word: 'test', start: 0.6, end: 0.9 },
    ],
  };
});

const mockOfflineTtsInstance = {
  generate: mockGenerate,
};

const mockOfflineTtsConstructor = jest.fn().mockImplementation(() => {
  return mockOfflineTtsInstance;
});

// --- End Refactored Mock Setup ---

let SherpaOnnxTTSClient: any; // Declare type loosely for dynamic import

// Mock the fs module
jest.mock("fs", () => {
  return {
    ...(jest.requireActual("fs") as typeof import('fs')),
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn().mockReturnValue(
      JSON.stringify({
        mms_eng: {
          url: "https://huggingface.co/k2-fsa/sherpa-onnx-mms-tts-en/resolve/main",
          name: "MMS English",
          language: "en-US",
          gender: "Female",
          description: "MMS English TTS model",
        },
      })
    ),
    statSync: jest.fn().mockReturnValue({ size: 1000 }),
    readdirSync: jest.fn().mockReturnValue(["test.txt"]),
  };
});

// Mock the https module
jest.mock("https", () => {
  // Define types for clarity, though we'll use 'as any' below
  type MockResponse = {
    statusCode: number;
    statusMessage: string;
    pipe: jest.Mock;
    on: jest.Mock;
  };
  type HttpsGetCallback = (res: MockResponse) => void;

  const mockRequest = {
    on: jest.fn().mockReturnThis(),
  };

  return {
    // Cast the implementation to 'any' to bypass complex type checking
    get: jest.fn().mockImplementation(((_url: string, callback: HttpsGetCallback) => {
      const response: MockResponse = {
        statusCode: 200,
        statusMessage: "OK",
        pipe: jest.fn(),
        on: jest.fn(),
      };
      callback(response);
      return mockRequest;
    }) as any),
  };
});

// --- Asynchronous Mock Setup and Import ---
beforeAll(async () => {
  // Mock sherpa-onnx-node asynchronously
  await jest.unstable_mockModule("sherpa-onnx-node", () => {
    return {
      OfflineTts: mockOfflineTtsConstructor,
      writeWave: jest.fn(),
    };
  });

  // Dynamically import the class *after* the mock is set up
  const module = await import("../engines/sherpaonnx");
  SherpaOnnxTTSClient = module.SherpaOnnxTTSClient;
});
// --- End Asynchronous Mock Setup and Import ---

describe("SherpaOnnxTTSClient", () => {
  let client: any; // Use 'any' because the class is loaded dynamically
  let fetchSpy; 

  beforeEach(() => {
    client = new SherpaOnnxTTSClient({});

    // Define the mock fetch response data
    const mockFetchResponseData = {
        mms_eng: {
          url: "https://huggingface.co/k2-fsa/sherpa-onnx-mms-tts-en/resolve/main",
          name: "MMS English",
          language: "en-US",
          gender: "Female",
          description: "MMS English TTS model",
        },
    };
    
    // Define the structure expected by fetch (Response object)
    const mockFetchResponse = {
        ok: true,
        statusText: "OK",
        // Use mockImplementation for the text method
        text: jest.fn().mockImplementation(async () => JSON.stringify(mockFetchResponseData)), 
        // Add other methods like json() if necessary
        // json: jest.fn().mockResolvedValue(mockFetchResponseData),
    };

    // Spy on global fetch and provide the mock implementation
    fetchSpy = jest.spyOn(global, 'fetch')
                   // Use mockImplementation to return a Promise resolving to the mock response
                   .mockImplementation(async () => mockFetchResponse as any); 
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Restore the original fetch implementation
    jest.restoreAllMocks(); 
  });

  test("should initialize correctly", () => {
    expect(client).toBeDefined();
  });

  test("should get voices", async () => {
    const voices = await client.getVoices();
    expect(voices).toBeDefined();
    expect(voices.length).toBeGreaterThan(0);
  });

  test("should set voice", async () => {
    await client.setVoice("mms_eng");
    expect(client.getProperty("voice")).toBe("mms_eng");
  });

  test("should synthesize text to bytes", async () => {
    await client.setVoice("mms_eng");
    const bytes = await client.synthToBytes("Hello, world!");
    expect(bytes).toBeDefined();
    expect(bytes.length).toBeGreaterThan(0);
  });

  test("should synthesize text to bytestream", async () => {
    await client.setVoice("mms_eng");
    const stream = await client.synthToBytestream("Hello, world!");
    expect(stream).toBeDefined();
  });

  test("should synthesize text to bytestream with word boundaries", async () => {
    await client.setVoice("mms_eng");
    const result = await client.synthToBytestream("Hello, world!", {
      useWordBoundary: true,
    });

    if ("audioStream" in result) {
      expect(result.audioStream).toBeDefined();
      expect(result.wordBoundaries).toBeDefined();
      expect(result.wordBoundaries.length).toBeGreaterThan(0);
    } else {
      throw new Error("Expected result to have audioStream and wordBoundaries");
    }
  });

  test("should strip SSML tags", async () => {
    await client.setVoice("mms_eng");
    const bytes = await client.synthToBytes("<speak>Hello, <break time='1s'/> world!</speak>");
    expect(bytes).toBeDefined();
    expect(bytes.length).toBeGreaterThan(0);
  });

  test("should check credentials", async () => {
    await client.setVoice("mms_eng");
    const valid = await client.checkCredentials();
    expect(valid).toBe(true);
  });
});
