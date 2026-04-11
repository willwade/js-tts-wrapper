import { describe, it, expect } from "@jest/globals";
import { ElevenLabsTTSClient } from "../engines/elevenlabs";

describe("ElevenLabs v3 prepareText", () => {
  it("strips SSML for eleven_v3 (no translation)", async () => {
    const client = new ElevenLabsTTSClient({ apiKey: "test-key", modelId: "eleven_v3" });
    const ssml = '<speak>Normal <emphasis level="strong">dramatic</emphasis> end</speak>';
    const prepared = await (client as any).prepareText(ssml, {});
    expect(prepared).toBe("Normal dramatic end");
  });

  it("preserves native [audio tags] in plain text", async () => {
    const client = new ElevenLabsTTSClient({ apiKey: "test-key", modelId: "eleven_v3" });
    const text = "Hello [excited] world [whispers]";
    const prepared = await (client as any).prepareText(text, {});
    expect(prepared).toBe(text);
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
