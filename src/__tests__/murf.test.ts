import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { MurfTTSClient } from "../engines/murf";
import { createTTSClient } from "../factory";

describe("MurfTTSClient", () => {
  let client: MurfTTSClient;
  beforeEach(() => {
    client = new MurfTTSClient({ apiKey: "test" });
  });

  it("initializes with defaults", () => {
    expect(client.getProperty("model")).toBe("GEN2");
  });
  it("sets model to FALCON", () => {
    client.setProperty("model", "FALCON");
    expect(client.getProperty("model")).toBe("FALCON");
  });
  it("sets voice via voiceId", () => {
    client.setVoice("en-US-owen");
    expect(client.getProperty("voice")).toBe("en-US-owen");
  });
  it("checks credentials without key", async () => {
    expect(await new MurfTTSClient({}).checkCredentials()).toBe(false);
  });
  it("creates via factory", () => {
    expect(createTTSClient("murf", { apiKey: "t" })).toBeInstanceOf(MurfTTSClient);
  });
  it("gets voices", async () => {
    const v = await client.getVoices();
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].provider).toBe("murf");
  });
  it("filters by language", async () => {
    const v = await client.getVoicesByLanguage("en");
    expect(v.length).toBeGreaterThan(0);
  });
  it("strips SSML", async () => {
    expect(await (client as any).prepareText("<speak>Hi</speak>")).toBe("Hi");
  });
  it("creates word timings", () => {
    (client as any)._createEstimatedWordTimings("a b");
    expect((client as any).timings.length).toBe(2);
  });
  it("supports events", () => {
    const fn = jest.fn();
    client.on("start", fn);
    (client as any).emit("start");
    expect(fn).toHaveBeenCalled();
  });
  it("credential status", async () => {
    const s = await client.getCredentialStatus();
    expect(s.engine).toBe("murf");
  });
});
