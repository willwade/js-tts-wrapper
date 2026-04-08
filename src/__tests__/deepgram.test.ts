import { describe, it, expect, beforeEach } from "@jest/globals";
import { DeepgramTTSClient } from "../engines/deepgram";

describe("DeepgramTTSClient", () => {
  let client: DeepgramTTSClient;

  beforeEach(() => {
    client = new DeepgramTTSClient({ apiKey: "test-api-key" });
  });

  it("should initialize with default values", () => {
    expect(client).toBeDefined();
    expect(client.getProperty("model")).toBe("aura-2");
  });

  it("should initialize with custom model via credentials", () => {
    const c = new DeepgramTTSClient({ apiKey: "test", model: "aura" });
    expect(c.getProperty("model")).toBe("aura");
  });

  it("should initialize with custom model via properties", () => {
    const c = new DeepgramTTSClient({
      apiKey: "test",
      properties: { model: "aura" },
    });
    expect(c.getProperty("model")).toBe("aura");
  });

  it("should initialize with custom model via JSON properties", () => {
    const c = new DeepgramTTSClient({
      apiKey: "test",
      propertiesJson: '{"model":"aura"}',
    });
    expect(c.getProperty("model")).toBe("aura");
  });

  it("should set and get model", () => {
    client.setProperty("model", "aura");
    expect(client.getProperty("model")).toBe("aura");
  });

  it("should set and get voice", () => {
    client.setProperty("voice", "aura-2-stella-en");
    expect(client.getProperty("voice")).toBe("aura-2-stella-en");
  });

  it("should return false for checkCredentials without api key", async () => {
    const c = new DeepgramTTSClient({});
    expect(await c.checkCredentials()).toBe(false);
  });

  it("should get static voices", async () => {
    const voices = await client.getVoices();
    expect(voices).toBeDefined();
    expect(voices.length).toBeGreaterThan(0);
    expect(voices[0]).toHaveProperty("id");
    expect(voices[0]).toHaveProperty("name");
    expect(voices[0]).toHaveProperty("provider");
  });

  it("should have correct voice provider", async () => {
    const voices = await client.getVoices();
    expect(voices[0].provider).toBe("deepgram");
  });

  it("should throw on synthToBytes with bad api key", async () => {
    const c = new DeepgramTTSClient({ apiKey: "bad-key" });
    await expect(c.synthToBytes("Hello")).rejects.toThrow();
  });

  it("should throw on synthToBytestream with bad api key", async () => {
    const c = new DeepgramTTSClient({ apiKey: "bad-key" });
    await expect(c.synthToBytestream("Hello")).rejects.toThrow();
  });

  it("should strip SSML before synthesis", async () => {
    const c = new DeepgramTTSClient({ apiKey: "bad-key" });
    await expect(c.synthToBytes("<speak>Hello world</speak>")).rejects.toThrow();
  });

  it("should have required credentials", () => {
    const c = new DeepgramTTSClient({ apiKey: "test" });
    expect((c as any).getRequiredCredentials()).toEqual(["apiKey"]);
  });

  it("should build model param from voice and model", async () => {
    const c = new DeepgramTTSClient({ apiKey: "bad-key" });
    c.setProperty("voice", "aura-2-apollo-en");
    c.setProperty("model", "aura-2");
    await expect(c.synthToBytes("test")).rejects.toThrow("Deepgram API error");
  });
});
