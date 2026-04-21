import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { GeminiTTSClient } from "../engines/gemini";
import { createBrowserTTSClient } from "../factory-browser";
import { createTTSClient } from "../factory";

const originalFetch = globalThis.fetch;

function response(body: any, init: { ok?: boolean; status?: number; statusText?: string } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    headers: {} as Headers,
    body: null as any,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

function audioResponse(base64Audio: string) {
  return response({
    candidates: [
      {
        content: {
          parts: [
            {
              inlineData: {
                data: base64Audio,
              },
            },
          ],
        },
      },
    ],
  });
}

function b64(bytes: number[]): string {
  return Buffer.from(new Uint8Array(bytes)).toString("base64");
}

describe("GeminiTTSClient", () => {
  let client: GeminiTTSClient;

  beforeEach(() => {
    client = new GeminiTTSClient({ apiKey: "test-api-key" });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("initializes with default values", () => {
    expect(client.getProperty("model")).toBe("gemini-3.1-flash-tts-preview");
    expect(client.getProperty("voice")).toBe("Kore");
  });

  it("initializes with custom model and voice", () => {
    const c = new GeminiTTSClient({
      apiKey: "test",
      model: "gemini-2.5-flash-preview-tts",
      voice: "Puck",
    });

    expect(c.getProperty("model")).toBe("gemini-2.5-flash-preview-tts");
    expect(c.getProperty("voice")).toBe("Puck");
  });

  it("initializes with properties object", () => {
    const c = new GeminiTTSClient({
      apiKey: "test",
      properties: { model: "gemini-2.5-flash-preview-tts", voice: "Zephyr" },
    });

    expect(c.getProperty("model")).toBe("gemini-2.5-flash-preview-tts");
    expect(c.getProperty("voice")).toBe("Zephyr");
  });

  it("initializes with propertiesJson string", () => {
    const c = new GeminiTTSClient({
      apiKey: "test",
      propertiesJson: JSON.stringify({ voice: "Sulafat" }),
    });

    expect(c.getProperty("voice")).toBe("Sulafat");
  });

  it("sets and gets model, voice, and baseURL", () => {
    client.setProperty("model", "gemini-2.5-flash-preview-tts");
    client.setProperty("voice", "Puck");
    client.setProperty("baseURL", "https://example.test/v1beta");

    expect(client.getProperty("model")).toBe("gemini-2.5-flash-preview-tts");
    expect(client.getProperty("voice")).toBe("Puck");
    expect(client.getProperty("baseURL")).toBe("https://example.test/v1beta");
  });

  it("requires apiKey credential", () => {
    expect((client as any).getRequiredCredentials()).toEqual(["apiKey"]);
  });

  it("returns false for checkCredentials without api key", async () => {
    expect(await new GeminiTTSClient({}).checkCredentials()).toBe(false);
  });

  it("checks credentials against model list", async () => {
    globalThis.fetch = jest.fn(async () =>
      response({
        models: [{ name: "models/gemini-3.1-flash-tts-preview" }],
      })
    ) as any;

    expect(await client.checkCredentials()).toBe(true);
  });

  it("gets static voices", async () => {
    const voices = await client.getVoices();

    expect(voices).toHaveLength(30);
    expect(voices[0]).toHaveProperty("id", "Zephyr");
    expect(voices[0]).toHaveProperty("provider", "gemini");
    expect(voices.every((voice) => voice.gender && voice.gender !== "Unknown")).toBe(true);
    expect(voices.every((voice) => typeof voice.metadata?.style === "string")).toBe(true);
    expect(voices[0].metadata?.genderSource).toBe("google-cloud-gemini-tts");
  });

  it("filters voices by supported languages", async () => {
    expect((await client.getVoicesByLanguage("en")).length).toBeGreaterThan(0);
    expect((await client.getVoicesByLanguage("fr")).length).toBeGreaterThan(0);
    expect((await client.getVoicesByLanguage("es")).length).toBeGreaterThan(0);
    expect((await client.getVoicesByLanguage("en-US")).length).toBeGreaterThan(0);
    expect((await client.getVoicesByLanguage("fr-FR")).length).toBeGreaterThan(0);
  });

  it("maps documented Gemini voice genders", async () => {
    const voices = await client.getVoices();
    const byId = new Map(voices.map((voice) => [voice.id, voice]));

    expect(byId.get("Zephyr")?.gender).toBe("Female");
    expect(byId.get("Kore")?.gender).toBe("Female");
    expect(byId.get("Puck")?.gender).toBe("Male");
    expect(byId.get("Charon")?.gender).toBe("Male");
  });

  it("filters voices by documented gender", async () => {
    const femaleVoices = await client.getVoicesByGender("Female");
    const maleVoices = await client.getVoicesByGender("Male");

    expect(femaleVoices.length).toBeGreaterThan(0);
    expect(maleVoices.length).toBeGreaterThan(0);
    expect(femaleVoices.every((voice) => voice.gender === "Female")).toBe(true);
    expect(maleVoices.every((voice) => voice.gender === "Male")).toBe(true);
    expect(femaleVoices.some((voice) => voice.id === "Zephyr")).toBe(true);
    expect(maleVoices.some((voice) => voice.id === "Puck")).toBe(true);
  });

  it("exposes documented Gemini language metadata", async () => {
    const [voice] = await client.getVoices();
    const languageCodes = voice.languageCodes.map((language) => language.bcp47);
    const readiness = voice.metadata?.languageReadiness as Record<string, string>;
    const supportedLanguageCodes = voice.metadata?.supportedLanguageCodes as string[];

    expect(languageCodes).toEqual(
      expect.arrayContaining(["en-US", "fr-FR", "de-DE", "pt-BR", "ja-JP"])
    );
    expect(languageCodes).toEqual(
      expect.arrayContaining(["en-GB", "fr-CA", "cmn-CN", "es-MX", "ur-PK"])
    );
    expect(languageCodes).toContain("cmn-TW");
    expect(supportedLanguageCodes).toEqual(languageCodes);
    expect(readiness["en-US"]).toBe("GA");
    expect(readiness["fr-FR"]).toBe("GA");
    expect(readiness["en-GB"]).toBe("Preview");
    expect(readiness["cmn-CN"]).toBe("Preview");
  });

  it("creates via node and browser factories", () => {
    expect(createTTSClient("gemini", { apiKey: "test" })).toBeInstanceOf(GeminiTTSClient);
    expect(createBrowserTTSClient("gemini", { apiKey: "test" })).toBeInstanceOf(GeminiTTSClient);
  });

  it("strips SSML while preserving Gemini audio tags", async () => {
    const result = await (client as any).prepareText(
      "<speak>Hello <break time=\"500ms\"/> [laughs] world</speak>"
    );

    expect(result).not.toContain("<speak>");
    expect(result).not.toContain("<break");
    expect(result).toContain("[laughs]");
  });

  it("returns WAV bytes by default and sends the Gemini request shape", async () => {
    const pcm = b64([0, 0, 1, 0]);
    globalThis.fetch = jest.fn(async () => audioResponse(pcm)) as any;

    const bytes = await client.synthToBytes("Say cheerfully: Hello", { voice: "Puck" });
    const request = JSON.parse(((globalThis.fetch as any).mock.calls[0][1] as any).body);

    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe("RIFF");
    expect((globalThis.fetch as any).mock.calls[0][0]).toContain(
      "/models/gemini-3.1-flash-tts-preview:generateContent"
    );
    expect(request.generationConfig.responseModalities).toEqual(["AUDIO"]);
    expect(
      request.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName
    ).toBe("Puck");
  });

  it("returns raw PCM when requested", async () => {
    globalThis.fetch = jest.fn(async () => audioResponse(b64([0, 0, 1, 0]))) as any;

    const bytes = await client.synthToBytes("Hello", { format: "pcm" });

    expect(Array.from(bytes)).toEqual([0, 0, 1, 0]);
  });

  it("uses selected model in request URL", async () => {
    globalThis.fetch = jest.fn(async () => audioResponse(b64([0, 0]))) as any;

    await client.synthToBytes("Hello", { model: "gemini-2.5-flash-preview-tts" });

    expect((globalThis.fetch as any).mock.calls[0][0]).toContain(
      "/models/gemini-2.5-flash-preview-tts:generateContent"
    );
  });

  it("throws useful error for HTTP failures", async () => {
    globalThis.fetch = jest.fn(async () =>
      response("bad request", { ok: false, status: 400, statusText: "Bad Request" })
    ) as any;

    await expect(client.synthToBytes("Hello")).rejects.toThrow(
      "Gemini TTS API error: 400 Bad Request"
    );
  });

  it("throws useful error for missing audio data", async () => {
    globalThis.fetch = jest.fn(async () =>
      response({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: "not audio" }] },
          },
        ],
      })
    ) as any;

    await expect(client.synthToBytes("Hello")).rejects.toThrow(
      "Gemini TTS response did not include audio data"
    );
  });

  it("wraps synthesized bytes in a stream and returns estimated word boundaries", async () => {
    globalThis.fetch = jest.fn(async () => audioResponse(b64([0, 0, 1, 0]))) as any;

    const result = await client.synthToBytestream("Hello world", { useWordBoundary: true });
    const reader = result.audioStream.getReader();
    const chunk = await reader.read();

    expect(chunk.done).toBe(false);
    expect(chunk.value?.length).toBeGreaterThan(0);
    expect(result.wordBoundaries).toHaveLength(2);
  });

  it("provides credential status", async () => {
    globalThis.fetch = jest.fn(async () =>
      response({
        models: [{ name: "models/gemini-3.1-flash-tts-preview" }],
      })
    ) as any;

    const status = await client.getCredentialStatus();

    expect(status.engine).toBe("gemini");
    expect(status.requiresCredentials).toBe(true);
  });
});
