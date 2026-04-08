import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { XaiTTSClient } from "../engines/xai";
import { createTTSClient } from "../factory";

describe("XaiTTSClient", () => {
  let client: XaiTTSClient;

  beforeEach(() => {
    client = new XaiTTSClient({ apiKey: "test-api-key" });
  });

  it("should initialize with default values", () => {
    expect(client).toBeDefined();
    expect(client.getProperty("model")).toBe("grok-tts");
    expect(client.getProperty("language")).toBe("auto");
  });

  it("should initialize with custom model", () => {
    const c = new XaiTTSClient({ apiKey: "test", model: "grok-tts" });
    expect(c.getProperty("model")).toBe("grok-tts");
  });

  it("should initialize with properties", () => {
    const c = new XaiTTSClient({ apiKey: "test", properties: { language: "en" } });
    expect(c.getProperty("language")).toBe("en");
  });

  it("should set and get model", () => {
    client.setProperty("model", "grok-tts");
    expect(client.getProperty("model")).toBe("grok-tts");
  });

  it("should set and get voice via base class voiceId", () => {
    client.setVoice("orion-56");
    expect(client.getProperty("voice")).toBe("orion-56");
  });

  it("should set and get language", () => {
    client.setProperty("language", "fr");
    expect(client.getProperty("language")).toBe("fr");
  });

  it("should return false for checkCredentials without api key", async () => {
    const c = new XaiTTSClient({});
    expect(await c.checkCredentials()).toBe(false);
  });

  it("should require apiKey credential", () => {
    expect((client as any).getRequiredCredentials()).toEqual(["apiKey"]);
  });

  it("should get static voices", async () => {
    const voices = await client.getVoices();
    expect(voices.length).toBeGreaterThan(0);
    expect(voices[0]).toHaveProperty("id");
    expect(voices[0]).toHaveProperty("provider");
  });

  it("should filter voices by language", async () => {
    const voices = await client.getVoicesByLanguage("en");
    expect(voices.length).toBeGreaterThan(0);
  });

  it("should create via factory", () => {
    const c = createTTSClient("xai", { apiKey: "test" });
    expect(c).toBeInstanceOf(XaiTTSClient);
  });

  it("should throw on synthToBytes with bad api key", async () => {
    const c = new XaiTTSClient({ apiKey: "bad-key" });
    await expect(c.synthToBytes("Hello")).rejects.toThrow();
  });

  it("should throw on synthToBytestream with bad api key", async () => {
    const c = new XaiTTSClient({ apiKey: "bad-key" });
    await expect(c.synthToBytestream("Hello")).rejects.toThrow();
  });

  it("should pass audio tags through (native support)", () => {
    const result = (client as any).processAudioTags("Hello [laugh] world");
    expect(result).toContain("[laugh]");
  });

  it("should strip SSML", async () => {
    const result = await (client as any).prepareText("<speak>Hello world</speak>");
    expect(result).not.toContain("<speak>");
    expect(result).toContain("Hello world");
  });

  it("should handle word timings", () => {
    (client as any)._createEstimatedWordTimings("Hello world");
    expect((client as any).timings.length).toBe(2);
  });

  it("should support events", () => {
    const fn = jest.fn();
    client.on("start", fn);
    (client as any).emit("start");
    expect(fn).toHaveBeenCalled();
  });

  it("should provide credential status", async () => {
    const status = await client.getCredentialStatus();
    expect(status.engine).toBe("xai");
    expect(status.requiresCredentials).toBe(true);
  });
});
