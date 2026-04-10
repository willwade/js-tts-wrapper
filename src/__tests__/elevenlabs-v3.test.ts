import { describe, it, expect } from "@jest/globals";
import { ElevenLabsTTSClient } from "../engines/elevenlabs";

// Access private method for unit testing
function ssmlToV3AudioTags(client: ElevenLabsTTSClient, ssml: string): string {
  return (client as any)._ssmlToV3AudioTags(ssml);
}

describe("ElevenLabs v3 audio tag translation", () => {
  const client = new ElevenLabsTTSClient({ apiKey: "test-key" });

  it("translates strong emphasis to [excited]", () => {
    const result = ssmlToV3AudioTags(
      client,
      "<speak>Hello <emphasis level=\"strong\">world</emphasis></speak>"
    );
    expect(result).toBe("Hello world [excited]");
  });

  it("translates moderate emphasis to [excited]", () => {
    const result = ssmlToV3AudioTags(
      client,
      "<speak><emphasis level=\"moderate\">hello</emphasis></speak>"
    );
    expect(result).toBe("hello [excited]");
  });

  it("translates reduced emphasis to [whispers]", () => {
    const result = ssmlToV3AudioTags(
      client,
      "<speak><emphasis level=\"reduced\">quiet</emphasis></speak>"
    );
    expect(result).toBe("quiet [whispers]");
  });

  it("translates emphasis without level to [excited]", () => {
    const result = ssmlToV3AudioTags(
      client,
      "<speak><emphasis>hey</emphasis></speak>"
    );
    expect(result).toBe("hey [excited]");
  });

  it("translates <break> to [pause]", () => {
    const result = ssmlToV3AudioTags(
      client,
      "<speak>Hello<break time=\"1s\"/>world</speak>"
    );
    expect(result).toBe("Hello[pause]world");
  });

  it("strips prosody tags but keeps content", () => {
    const result = ssmlToV3AudioTags(
      client,
      "<speak><prosody rate=\"slow\">take it easy</prosody></speak>"
    );
    expect(result).toBe("take it easy");
  });

  it("strips speak wrapper", () => {
    const result = ssmlToV3AudioTags(client, "<speak>plain text</speak>");
    expect(result).toBe("plain text");
  });

  it("preserves existing [audio tags] in plain text through prepareText", async () => {
    const v3Client = new ElevenLabsTTSClient({ apiKey: "test-key", modelId: "eleven_v3" });
    // Plain text with audio tags should pass through unchanged
    const text = "Hello [excited] world [whispers]";
    const prepared = await (v3Client as any).prepareText(text, {});
    expect(prepared).toBe(text);
  });

  it("strips SSML for non-v3 models", async () => {
    const v2Client = new ElevenLabsTTSClient({
      apiKey: "test-key",
      modelId: "eleven_multilingual_v2",
    });
    const ssml = '<speak><emphasis level="strong">hello</emphasis></speak>';
    const prepared = await (v2Client as any).prepareText(ssml, {});
    // Should strip all tags, no [excited] added
    expect(prepared).toBe("hello");
    expect(prepared).not.toContain("[excited]");
  });

  it("translates SSML to audio tags for eleven_v3 model", async () => {
    const v3Client = new ElevenLabsTTSClient({ apiKey: "test-key", modelId: "eleven_v3" });
    const ssml = '<speak>Normal <emphasis level="strong">dramatic</emphasis> end</speak>';
    const prepared = await (v3Client as any).prepareText(ssml, {});
    expect(prepared).toBe("Normal dramatic [excited] end");
  });
});

describe("ElevenLabs v3 request parameters", () => {
  it("includes seed in payload when set", () => {
    const client = new ElevenLabsTTSClient({ apiKey: "test-key" });
    const payload = (client as any).buildRequestPayload("hello", { seed: 42 });
    expect(payload.seed).toBe(42);
  });

  it("includes language_code in payload when set", () => {
    const client = new ElevenLabsTTSClient({ apiKey: "test-key" });
    const payload = (client as any).buildRequestPayload("hello", { languageCode: "en" });
    expect(payload.language_code).toBe("en");
  });

  it("includes previous_text in payload when set", () => {
    const client = new ElevenLabsTTSClient({ apiKey: "test-key" });
    const payload = (client as any).buildRequestPayload("hello", { previousText: "Before this" });
    expect(payload.previous_text).toBe("Before this");
  });

  it("includes next_text in payload when set", () => {
    const client = new ElevenLabsTTSClient({ apiKey: "test-key" });
    const payload = (client as any).buildRequestPayload("hello", { nextText: "After this" });
    expect(payload.next_text).toBe("After this");
  });

  it("includes apply_text_normalization in payload when set", () => {
    const client = new ElevenLabsTTSClient({ apiKey: "test-key" });
    const payload = (client as any).buildRequestPayload("hello", { applyTextNormalization: "off" });
    expect(payload.apply_text_normalization).toBe("off");
  });

  it("omits v3 params from payload when not set", () => {
    const client = new ElevenLabsTTSClient({ apiKey: "test-key" });
    const payload = (client as any).buildRequestPayload("hello", {});
    expect(payload.seed).toBeUndefined();
    expect(payload.language_code).toBeUndefined();
    expect(payload.previous_text).toBeUndefined();
    expect(payload.next_text).toBeUndefined();
    expect(payload.apply_text_normalization).toBeUndefined();
  });
});
