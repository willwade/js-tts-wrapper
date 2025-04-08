import { SherpaOnnxTTSClient } from "../engines/sherpaonnx";

// Mock the sherpa-onnx-node module
jest.mock("sherpa-onnx-node", () => {
  return {
    OfflineTts: jest.fn().mockImplementation(() => {
      return {
        generate: jest.fn().mockImplementation(() => {
          return {
            samples: new Float32Array(1600),
            sampleRate: 16000,
          };
        }),
      };
    }),
    writeWave: jest.fn(),
  };
});

// Mock the fs module
jest.mock("fs", () => {
  return {
    ...jest.requireActual("fs"),
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
  return {
    get: jest.fn().mockImplementation((url, callback) => {
      const response = {
        statusCode: 200,
        statusMessage: "OK",
        pipe: jest.fn(),
      };
      callback(response);
      return {
        on: jest.fn().mockImplementation((event, callback) => {
          return {
            on: jest.fn(),
          };
        }),
      };
    }),
  };
});

// Mock the node-fetch module
jest.mock("node-fetch", () => {
  return jest.fn().mockImplementation(() => {
    return {
      ok: true,
      text: jest.fn().mockResolvedValue(
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
      statusText: "OK",
    };
  });
});

describe("SherpaOnnxTTSClient", () => {
  let client: SherpaOnnxTTSClient;

  beforeEach(() => {
    client = new SherpaOnnxTTSClient({});
  });

  afterEach(() => {
    jest.clearAllMocks();
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
    expect(client.voiceId).toBe("mms_eng");
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
      fail("Expected result to have audioStream and wordBoundaries");
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
