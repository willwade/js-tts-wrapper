import { OpenAITTSClient } from "../engines/openai";
import * as fs from "node:fs";
import * as path from "node:path";

// Mock OpenAI client
jest.mock("openai", () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => {
      return {
        models: {
          list: jest.fn().mockResolvedValue({ data: [] }),
        },
        audio: {
          speech: {
            create: jest.fn().mockResolvedValue({
              arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
              body: {
                [Symbol.asyncIterator]: async function* () {
                  yield new Uint8Array(0);
                },
                getReader: jest.fn().mockReturnValue({
                  read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
                  releaseLock: jest.fn(),
                }),
              },
            }),
          },
        },
      };
    }),
  };
});

// Mock fs
jest.mock("node:fs", () => {
  return {
    ...jest.requireActual("node:fs"),
    writeFileSync: jest.fn(),
    createWriteStream: jest.fn().mockImplementation(() => {
      return {
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === "finish") {
            callback();
          }
          return this;
        }),
      };
    }),
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
  };
});

describe("OpenAITTSClient", () => {
  let client: OpenAITTSClient;

  beforeEach(() => {
    client = new OpenAITTSClient({
      apiKey: "test-api-key",
    });
    jest.clearAllMocks();
  });

  test("should initialize with default values", () => {
    expect(client.getProperty("model")).toBe("gpt-4o-mini-tts");
    expect(client.getProperty("voice")).toBe("coral");
    expect(client.getProperty("instructions")).toBe("");
    expect(client.getProperty("responseFormat")).toBe("mp3");
  });

  test("should check credentials", async () => {
    const result = await client.checkCredentials();
    expect(result).toBe(true);
  });

  test("should get voices", async () => {
    const voices = await client.getVoices();
    expect(voices).toHaveLength(10);
    expect(voices[0].id).toBe("alloy");
    expect(voices[0].provider).toBe("openai");
  });

  test("should set voice", () => {
    client.setVoice("alloy");
    expect(client.getProperty("voice")).toBe("alloy");
  });

  test("should set model", () => {
    client.setModel("tts-1");
    expect(client.getProperty("model")).toBe("tts-1");
  });

  test("should set instructions", () => {
    client.setInstructions("Speak slowly");
    expect(client.getProperty("instructions")).toBe("Speak slowly");
  });

  test("should set response format", () => {
    client.setResponseFormat("wav");
    expect(client.getProperty("responseFormat")).toBe("wav");
  });

  test("should convert text to speech", async () => {
    const outputPath = await client.textToSpeech("Hello, world!");
    expect(outputPath).toBe("openai-output.mp3");
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  test("should convert text to speech with streaming", async () => {
    const outputPath = await client.textToSpeechStreaming("Hello, world!");
    expect(outputPath).toBe("openai-streaming-output.mp3");
    expect(fs.createWriteStream).toHaveBeenCalled();
  });

  test("should throw error for SSML", async () => {
    await expect(client.ssmlToSpeech("<speak>Hello</speak>")).rejects.toThrow(
      "SSML is not supported by OpenAI TTS"
    );
  });

  test("should throw error for SSML with streaming", async () => {
    await expect(client.ssmlToSpeechStreaming("<speak>Hello</speak>")).rejects.toThrow(
      "SSML is not supported by OpenAI TTS"
    );
  });

  test("should handle word boundaries", async () => {
    const onWord = jest.fn();
    await client.textToSpeech("Hello, world!", { onWord, returnWordBoundaries: true });
    expect(onWord).toHaveBeenCalled();
    expect(client.getLastWordBoundaries()).toHaveLength(2);
  });

  test("should handle onEnd callback", async () => {
    const onEnd = jest.fn();
    await client.textToSpeech("Hello, world!", { onEnd });
    expect(onEnd).toHaveBeenCalled();
  });
});
