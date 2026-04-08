import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { UnrealSpeechTTSClient } from "../engines/unrealspeech";
import { createTTSClient } from "../factory";

describe("UnrealSpeechTTSClient", () => {
  let client: UnrealSpeechTTSClient;
  beforeEach(() => {
    client = new UnrealSpeechTTSClient({ apiKey: "test" });
  });

  it("initializes with defaults", () => {
    expect(client.getProperty("voice")).toBe("Sierra");
  });
  it("sets voice via voiceId", () => {
    client.setVoice("Dan");
    expect(client.getProperty("voice")).toBe("Dan");
  });
  it("checks credentials without key", async () => {
    expect(await new UnrealSpeechTTSClient({}).checkCredentials()).toBe(false);
  });
  it("creates via factory", () => {
    expect(createTTSClient("unrealspeech", { apiKey: "t" })).toBeInstanceOf(UnrealSpeechTTSClient);
  });
  it("gets voices", async () => {
    const v = await client.getVoices();
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].provider).toBe("unrealspeech");
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
  it("has correct engine name", () => {
    expect((client as any).constructor.name).toBe("UnrealSpeechTTSClient");
  });
});
