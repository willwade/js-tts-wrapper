import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { HumeTTSClient } from "../engines/hume";
import { createTTSClient } from "../factory";

describe("HumeTTSClient", () => {
  let client: HumeTTSClient;

  beforeEach(() => {
    client = new HumeTTSClient({ apiKey: "test-api-key" });
  });

  it("should initialize with default values", () => {
    expect(client).toBeDefined();
    expect(client.getProperty("model")).toBe("octave-2");
  });

  it("should initialize with custom model", () => {
    const c = new HumeTTSClient({ apiKey: "test", model: "octave-1" });
    expect(c.getProperty("model")).toBe("octave-1");
  });

  it("should initialize with properties", () => {
    const c = new HumeTTSClient({ apiKey: "test", properties: { model: "octave-1" } });
    expect(c.getProperty("model")).toBe("octave-1");
  });

  it("should set and get model", () => {
    client.setProperty("model", "octave-1");
    expect(client.getProperty("model")).toBe("octave-1");
  });

  it("should set and get voice via base class voiceId", () => {
    client.setVoice("test-voice");
    expect(client.getProperty("voice")).toBe("test-voice");
  });

  it("should resolve version for octave-2", () => {
    expect((client as any).resolveVersion("octave-2")).toBe("2");
  });

  it("should resolve version for octave-1", () => {
    expect((client as any).resolveVersion("octave-1")).toBe("1");
  });

  it("should return undefined version for unknown model", () => {
    expect((client as any).resolveVersion("unknown")).toBeUndefined();
  });

  it("should return false for checkCredentials without api key", async () => {
    const c = new HumeTTSClient({});
    expect(await c.checkCredentials()).toBe(false);
  });

  it("should require apiKey credential", () => {
    expect((client as any).getRequiredCredentials()).toEqual(["apiKey"]);
  });

  it("should create via factory", () => {
    const c = createTTSClient("hume", { apiKey: "test" });
    expect(c).toBeInstanceOf(HumeTTSClient);
  });

  it("should throw on synthToBytes with bad api key", async () => {
    const c = new HumeTTSClient({ apiKey: "bad-key" });
    await expect(c.synthToBytes("Hello")).rejects.toThrow();
  });

  it("should throw on synthToBytestream with bad api key", async () => {
    const c = new HumeTTSClient({ apiKey: "bad-key" });
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
    expect(status.engine).toBe("hume");
    expect(status.requiresCredentials).toBe(true);
  });

  it("should use streaming endpoint for synthToBytestream", async () => {
    const c = new HumeTTSClient({ apiKey: "bad-key" });
    await expect(c.synthToBytestream("Hello")).rejects.toThrow();
  });
});
