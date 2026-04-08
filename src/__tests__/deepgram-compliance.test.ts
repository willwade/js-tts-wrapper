import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { DeepgramTTSClient } from "../engines/deepgram";
import { createTTSClient } from "../factory";

describe("DeepgramTTSClient — Unified API compliance", () => {
  let client: DeepgramTTSClient;

  beforeEach(() => {
    client = new DeepgramTTSClient({ apiKey: "test-api-key" });
  });

  describe("voiceId integration with base class", () => {
    it("should set voiceId via setVoice (base class)", () => {
      client.setVoice("aura-2-stella-en");
      expect(client.getProperty("voice")).toBe("aura-2-stella-en");
    });

    it("should set voice via setProperty", () => {
      client.setProperty("voice", "aura-2-apollo-en");
      expect(client.getProperty("voice")).toBe("aura-2-apollo-en");
    });
  });

  describe("factory integration", () => {
    it("should create client via factory", () => {
      const c = createTTSClient("deepgram", { apiKey: "test" });
      expect(c).toBeDefined();
      expect(c).toBeInstanceOf(DeepgramTTSClient);
    });

    it("should apply properties via factory", () => {
      const c = createTTSClient("deepgram", {
        apiKey: "test",
        properties: { model: "aura" },
      });
      expect(c.getProperty("model")).toBe("aura");
    });
  });

  describe("SSML handling", () => {
    it("should strip SSML before synthesis", async () => {
      const result = await (client as any).prepareText(
        "<speak>Hello <break time='500ms'/> world</speak>"
      );
      expect(result).not.toContain("<speak>");
      expect(result).not.toContain("<break");
      expect(result).toContain("Hello");
      expect(result).toContain("world");
    });

    it("should handle plain text without SSML", async () => {
      const result = await (client as any).prepareText("Hello world");
      expect(result).toBe("Hello world");
    });
  });

  describe("SpeechMarkdown handling", () => {
    it("should handle text without speech markdown unchanged", async () => {
      const result = await (client as any).prepareText("Hello world");
      expect(result).toBe("Hello world");
    });
  });

  describe("credentials", () => {
    it("should require apiKey credential", () => {
      expect((client as any).getRequiredCredentials()).toEqual(["apiKey"]);
    });

    it("should return false for checkCredentials without key", async () => {
      const c = new DeepgramTTSClient({});
      expect(await c.checkCredentials()).toBe(false);
    });

    it("should provide detailed credential status", async () => {
      const status = await client.getCredentialStatus();
      expect(status).toHaveProperty("valid");
      expect(status).toHaveProperty("engine");
      expect(status.engine).toBe("deepgram");
      expect(status).toHaveProperty("requiresCredentials", true);
    });
  });

  describe("unified voices", () => {
    it("should return voices with UnifiedVoice shape", async () => {
      const voices = await client.getVoices();
      expect(voices.length).toBeGreaterThan(0);
      for (const v of voices) {
        expect(v).toHaveProperty("id");
        expect(v).toHaveProperty("name");
        expect(v).toHaveProperty("gender");
        expect(v).toHaveProperty("languageCodes");
        expect(v).toHaveProperty("provider");
        expect(v.provider).toBe("deepgram");
        expect(v.languageCodes.length).toBeGreaterThan(0);
        expect(v.languageCodes[0]).toHaveProperty("bcp47");
        expect(v.languageCodes[0]).toHaveProperty("iso639_3");
        expect(v.languageCodes[0]).toHaveProperty("display");
      }
    });

    it("should filter voices by language", async () => {
      const voices = await client.getVoicesByLanguage("en-US");
      expect(voices.length).toBeGreaterThan(0);
      for (const v of voices) {
        expect(v.languageCodes.some((l) => l.bcp47 === "en-US" || l.iso639_3 === "eng")).toBe(true);
      }
    });
  });

  describe("word boundaries", () => {
    it("should create estimated word timings in synthToBytes", () => {
      (client as any)._createEstimatedWordTimings("Hello world test");
      const timings = (client as any).timings;
      expect(timings.length).toBe(3);
      expect(timings[0][2]).toBe("Hello");
      expect(timings[1][2]).toBe("world");
      expect(timings[2][2]).toBe("test");
    });
  });

  describe("event system", () => {
    it("should support on/connect event registration", () => {
      const startFn = jest.fn();
      const endFn = jest.fn();
      client.on("start", startFn);
      client.connect("onEnd", endFn);
      (client as any).emit("start");
      (client as any).emit("end");
      expect(startFn).toHaveBeenCalled();
      expect(endFn).toHaveBeenCalled();
    });
  });
});
