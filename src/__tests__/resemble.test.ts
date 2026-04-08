import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ResembleTTSClient } from "../engines/resemble";
import { createTTSClient } from "../factory";

describe("ResembleTTSClient", () => {
  let client: ResembleTTSClient;
  beforeEach(() => {
    client = new ResembleTTSClient({ apiKey: "test" });
  });

  it("initializes with defaults", () => {
    expect(client).toBeDefined();
  });
  it("sets voice via voiceId", () => {
    client.setVoice("uuid-123");
    expect(client.getProperty("voice")).toBe("uuid-123");
  });
  it("checks credentials without key", async () => {
    expect(await new ResembleTTSClient({}).checkCredentials()).toBe(false);
  });
  it("creates via factory", () => {
    expect(createTTSClient("resemble", { apiKey: "t" })).toBeInstanceOf(ResembleTTSClient);
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
    expect(s.engine).toBe("resemble");
  });
});
