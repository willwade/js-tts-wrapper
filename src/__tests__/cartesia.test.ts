import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { CartesiaTTSClient } from "../engines/cartesia";

describe("CartesiaTTSClient", () => {
  let client: CartesiaTTSClient;

  beforeEach(() => {
    client = new CartesiaTTSClient({ apiKey: "test-api-key" });
  });

  it("should initialize with default values", () => {
    expect(client).toBeDefined();
    expect(client.getProperty("model")).toBe("sonic-3");
  });

  it("should initialize with custom model via credentials", () => {
    const c = new CartesiaTTSClient({ apiKey: "test", model: "sonic-2" });
    expect(c.getProperty("model")).toBe("sonic-2");
  });

  it("should initialize with custom model via properties", () => {
    const c = new CartesiaTTSClient({
      apiKey: "test",
      properties: { model: "sonic-2" },
    });
    expect(c.getProperty("model")).toBe("sonic-2");
  });

  it("should initialize with custom model via JSON properties", () => {
    const c = new CartesiaTTSClient({
      apiKey: "test",
      propertiesJson: '{"model":"sonic-2"}',
    });
    expect(c.getProperty("model")).toBe("sonic-2");
  });

  it("should set and get model", () => {
    client.setProperty("model", "sonic-2");
    expect(client.getProperty("model")).toBe("sonic-2");
  });

  it("should set and get voice", () => {
    client.setProperty("voice", "test-voice-id");
    expect(client.getProperty("voice")).toBe("test-voice-id");
  });

  it("should set and get outputFormat", () => {
    const fmt = { container: "mp3", bit_rate: 128000 };
    client.setProperty("outputFormat", fmt);
    expect(client.getProperty("outputFormat")).toEqual(fmt);
  });

  it("should return false for checkCredentials without api key", async () => {
    const c = new CartesiaTTSClient({});
    expect(await c.checkCredentials()).toBe(false);
  });

  it("should get static voices", async () => {
    const voices = await client.getVoices();
    expect(voices).toBeDefined();
    expect(Array.isArray(voices)).toBe(true);
  });

  it("should process audio tags for sonic-3 model without hitting API", () => {
    (client as any).model = "sonic-3";
    const result = (client as any).processAudioTags("Hello [laughter] world");
    expect(result).toContain("[laughter]");
  });

  it("should throw on synthToBytes with bad api key", async () => {
    const c = new CartesiaTTSClient({ apiKey: "bad-key" });
    await expect(c.synthToBytes("Hello")).rejects.toThrow();
  });

  it("should throw on synthToBytestream with bad api key", async () => {
    const c = new CartesiaTTSClient({ apiKey: "bad-key" });
    await expect(c.synthToBytestream("Hello")).rejects.toThrow();
  });

  it("should process emotion tags for sonic-3", () => {
    (client as any).model = "sonic-3";
    const result = (client as any).processAudioTags("Hello [happy] world");
    expect(result).toContain('<emotion value="happy"/>');
  });

  it("should pass through laughter tag for sonic-3", () => {
    (client as any).model = "sonic-3";
    const result = (client as any).processAudioTags("Hello [laughter] world");
    expect(result).toContain("[laughter]");
  });

  it("should strip unsupported tags for sonic-3", () => {
    (client as any).model = "sonic-3";
    const result = (client as any).processAudioTags("Hello [bizarre_tag] world");
    expect(result).not.toContain("[bizarre_tag]");
  });

  it("should strip all tags for non-sonic-3 models", () => {
    (client as any).model = "sonic-2";
    const result = (client as any).processAudioTags("Hello [happy] world");
    expect(result).not.toContain("[happy]");
    expect(result).not.toContain("<emotion");
  });
});
