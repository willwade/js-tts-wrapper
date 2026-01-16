import { AbstractTTSClient } from "../src/core/abstract-tts";
import type { SpeakOptions, UnifiedVoice } from "../src/types";

class CaptureOptionsTTSClient extends AbstractTTSClient {
  public lastOptions: SpeakOptions | undefined;

  protected async _getVoices(): Promise<UnifiedVoice[]> {
    return [
      {
        id: "mock-voice",
        name: "Mock Voice",
        languageCodes: [
          {
            bcp47: "en-US",
            iso639_3: "eng",
            display: "English (United States)",
          },
        ],
        gender: "Female",
        provider: "azure",
      },
    ];
  }

  async synthToBytes(_text: string, options?: SpeakOptions): Promise<Uint8Array> {
    this.lastOptions = options;
    return new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
      0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
      0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00, 0x02, 0x00, 0x10, 0x00,
      0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00,
    ]);
  }

  async synthToBytestream(): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    throw new Error("Not used in these tests");
  }
}

describe("SpeechMarkdown auto-detection", () => {
  test("auto-enables useSpeechMarkdown when syntax is detected", async () => {
    const tts = new CaptureOptionsTTSClient({});
    const text = "Hello ++important++ world";

    await tts.synthToBytesWithConversion(text);

    expect(tts.lastOptions?.useSpeechMarkdown).toBe(true);
  });

  test("respects explicit useSpeechMarkdown=false", async () => {
    const tts = new CaptureOptionsTTSClient({});
    const text = "Hello ++important++ world";

    await tts.synthToBytesWithConversion(text, { useSpeechMarkdown: false });

    expect(tts.lastOptions?.useSpeechMarkdown).toBe(false);
  });

  test("does not auto-enable for raw SSML", async () => {
    const tts = new CaptureOptionsTTSClient({});
    const text = "<speak>Hello [500ms] world</speak>";

    await tts.synthToBytesWithConversion(text, { rawSSML: true });

    expect(tts.lastOptions?.useSpeechMarkdown).toBeUndefined();
  });

  test("does not auto-enable for already-SSML text", async () => {
    const tts = new CaptureOptionsTTSClient({});
    const text = "<speak>Hello [500ms] world</speak>";

    await tts.synthToBytesWithConversion(text);

    expect(tts.lastOptions?.useSpeechMarkdown).toBeUndefined();
  });
});
