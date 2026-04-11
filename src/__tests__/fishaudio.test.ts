import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { FishAudioTTSClient } from "../engines/fishaudio";
import { createTTSClient } from "../factory";

describe("FishAudioTTSClient", () => {
  let client: FishAudioTTSClient;

  beforeEach(() => {
    client = new FishAudioTTSClient({ apiKey: "test-api-key" });
  });

  it("should initialize with default values", () => {
    expect(client).toBeDefined();
    expect(client.getProperty("model")).toBe("s2-pro");
  });

  it("should initialize with custom model", () => {
    const c = new FishAudioTTSClient({ apiKey: "test", model: "s2" });
    expect(c.getProperty("model")).toBe("s2");
  });

  it("should initialize with properties", () => {
    const c = new FishAudioTTSClient({ apiKey: "test", properties: { model: "s2" } });
    expect(c.getProperty("model")).toBe("s2");
  });

  it("should set and get model", () => {
    client.setProperty("model", "s2");
    expect(client.getProperty("model")).toBe("s2");
  });

  it("should set and get voice via base class voiceId", () => {
    client.setVoice("test-voice-ref");
    expect(client.getProperty("voice")).toBe("test-voice-ref");
  });

  it("should pass audio tags through for s2-pro", () => {
    (client as any).model = "s2-pro";
    const result = (client as any).processAudioTags("Hello [laugh] world");
    expect(result).toContain("[laugh]");
  });

  it("should strip audio tags for non-s2-pro models", () => {
    (client as any).model = "s2";
    const result = (client as any).processAudioTags("Hello [laugh] world");
    expect(result).not.toContain("[laugh]");
    expect(result).toContain("Hello world");
  });

  it("should return false for checkCredentials without api key", async () => {
    const c = new FishAudioTTSClient({});
    expect(await c.checkCredentials()).toBe(false);
  });

  it("should require apiKey credential", () => {
    expect((client as any).getRequiredCredentials()).toEqual(["apiKey"]);
  });

  it("should create via factory", () => {
    const c = createTTSClient("fishaudio", { apiKey: "test" });
    expect(c).toBeInstanceOf(FishAudioTTSClient);
  });

  it("should throw on synthToBytes with bad api key", async () => {
    const c = new FishAudioTTSClient({ apiKey: "bad-key" });
    await expect(c.synthToBytes("Hello")).rejects.toThrow();
  });

  it("should throw on synthToBytestream with bad api key", async () => {
    const c = new FishAudioTTSClient({ apiKey: "bad-key" });
    await expect(c.synthToBytestream("Hello")).rejects.toThrow();
  });

  it("should strip SSML", async () => {
    const result = await (client as any).prepareText("<speak>Hello world</speak>");
    expect(result).not.toContain("<speak>");
    expect(result).toContain("Hello world");
  });

  it("should handle word timings", () => {
    (client as any)._createEstimatedWordTimings("Hello world test");
    expect((client as any).timings.length).toBe(3);
  });

  it("should support events", () => {
    const fn = jest.fn();
    client.on("start", fn);
    (client as any).emit("start");
    expect(fn).toHaveBeenCalled();
  });

  it("should provide credential status", async () => {
    const status = await client.getCredentialStatus();
    expect(status.engine).toBe("fishaudio");
    expect(status.requiresCredentials).toBe(true);
  });

  it("should have correct sample rate", () => {
    expect((client as any).sampleRate).toBe(44100);
  });

  it("should send model as header", async () => {
    const c = new FishAudioTTSClient({ apiKey: "bad-key" });
    c.setProperty("model", "s2-pro");
    await expect(c.synthToBytes("test")).rejects.toThrow("Fish Audio API error");
  });
});
