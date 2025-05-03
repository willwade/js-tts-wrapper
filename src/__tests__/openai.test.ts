import { describe, it, expect, jest, beforeEach, test, afterEach } from '@jest/globals';
import * as fs from "node:fs"; 
import * as path from "node:path";
import mock from 'mock-fs'; 
import type { SpeechCreateParams } from 'openai/resources/audio/speech'; 
import type { Response } from 'openai/core';
import { OpenAITTSClient } from "../engines/openai"; 

const mockListResponse = {
  data: [
    { id: 'tts-1', object: 'model', created: 1, owned_by: 'openai' },
    { id: 'tts-1-hd', object: 'model', created: 1, owned_by: 'openai' },
    { id: 'gpt-4o-mini-tts', object: 'model', created: 1, owned_by: 'openai' },
  ],
};

const mockOpenAIInstance = {
  models: {
    list: jest.fn().mockImplementation(async () => mockListResponse),
  },
  audio: {
    speech: {
      create: jest.fn().mockImplementation((async (params: SpeechCreateParams): Promise<Response> => {
        const mockAudioData = Buffer.from(`mock audio for ${params.input}`);
        const mockAudioBuffer = mockAudioData.buffer.slice(mockAudioData.byteOffset, mockAudioData.byteOffset + mockAudioData.byteLength);
        const headers = new Headers();

        if ((params.response_format as string) === 'json') {
            const boundaries = [
              { word: 'Hello', start: 0.1, end: 0.5 },
              { word: 'world', start: 0.6, end: 1.0 },
            ];
            headers.set('openai-word-boundaries', JSON.stringify(boundaries));
        }

        const mockResponse = {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: headers,
            arrayBuffer: async () => mockAudioBuffer,
            body: new ReadableStream<Uint8Array>({
                async start(controller) {
                    controller.enqueue(Buffer.from("mock stream chunk 1"));
                    controller.enqueue(Buffer.from("mock stream chunk 2"));
                    controller.close();
                }
            }),
            json: async () => ({}), 
        };
        return mockResponse as Response;
      }) as any),
    },
  },
};

describe("OpenAITTSClient", () => {
  let client: OpenAITTSClient;
  let mockStream: any; 

  beforeEach(() => {
    mock({}); 

    mockStream = {
      write: jest.fn(),
      end: jest.fn(((cb?: () => void) => { if (cb) cb(); }) as any),
      on: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
      removeListener: jest.fn(),
      pipe: jest.fn().mockReturnThis(),
    };

    client = new OpenAITTSClient({
      apiKey: "test-api-key",
    });

    (client as any).client = mockOpenAIInstance;

    jest.clearAllMocks(); 
  });

  afterEach(() => {
    mock.restore();
  });

  test("should initialize with default values", () => {
    expect(client).toBeDefined();
    expect(client.getProperty("model")).toBe("tts-1");
    expect(client.getProperty("voice")).toBe("alloy"); 
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
    const outputPath = await client.textToSpeech("Hello world", { outputFile: "openai-output.mp3" });
    expect(outputPath).toBe("openai-output.mp3");
    expect(fs.existsSync(outputPath)).toBe(true); 
  });

  test("should convert text to speech with streaming", async () => {
    const outputPath = await client.textToSpeechStreaming("Hello stream", { outputFile: "openai-streaming-output.mp3" });
    expect(outputPath).toBe("openai-streaming-output.mp3");
    expect(fs.existsSync(outputPath)).toBe(true); 
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
    await client.textToSpeechStreaming("Hello, world!", { onWord, returnWordBoundaries: true });
    expect(onWord).toHaveBeenCalled();
    expect(client.getLastWordBoundaries()).toHaveLength(2);
  });

  test("should handle onEnd callback", async () => {
    const onEndMock = jest.fn();
    const outputPath = "test.mp3";
    await client.textToSpeechStreaming("Test sentence.", { outputFile: outputPath, onEnd: onEndMock }); 
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(onEndMock).toHaveBeenCalled(); 
  });
});
