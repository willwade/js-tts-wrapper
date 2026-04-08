import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { MistralTTSClient } from "../engines/mistral";
import { createTTSClient } from "../factory";

describe("MistralTTSClient", () => {
  let client: MistralTTSClient;
  beforeEach(() => {
    client = new MistralTTSClient({ apiKey: "test" });
  });

  it("initializes with defaults", () => {
    expect(client.getProperty("model")).toBe("voxtral-mini-tts-2603");
  });
  it("sets model", () => {
    client.setProperty("model", "other");
    expect(client.getProperty("model")).toBe("other");
  });
  it("sets voice via voiceId", () => {
    client.setVoice("v1");
    expect(client.getProperty("voice")).toBe("v1");
  });
  it("checks credentials without key", async () => {
    expect(await new MistralTTSClient({}).checkCredentials()).toBe(false);
  });
  it("creates via factory", () => {
    expect(createTTSClient("mistral", { apiKey: "t" })).toBeInstanceOf(MistralTTSClient);
  });
  it("strips SSML", async () => {
    expect(await (client as any).prepareText("<speak>Hi</speak>")).toBe("Hi");
  });
  it("creates word timings", () => {
    (client as any)._createEstimatedWordTimings("a b c");
    expect((client as any).timings.length).toBe(3);
  });
  it("supports events", () => {
    const fn = jest.fn();
    client.on("end", fn);
    (client as any).emit("end");
    expect(fn).toHaveBeenCalled();
  });
  it("credential status", async () => {
    const s = await client.getCredentialStatus();
    expect(s.engine).toBe("mistral");
  });
});
