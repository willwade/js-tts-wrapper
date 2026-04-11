import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { CartesiaTTSClient } from "../engines/cartesia";
import { createTTSClient } from "../factory";

describe("CartesiaTTSClient — Unified API compliance", () => {
  let client: CartesiaTTSClient;

  beforeEach(() => {
    client = new CartesiaTTSClient({ apiKey: "test-api-key" });
  });

  describe("voiceId integration with base class", () => {
    it("should set voiceId via setVoice (base class)", () => {
      client.setVoice("new-voice-id");
      expect(client.getProperty("voice")).toBe("new-voice-id");
    });

    it("should use voiceId from base class in synthToBytes", () => {
      client.setVoice("test-voice-123");
      const opts = (client as any).voiceId;
      expect(opts).toBe("test-voice-123");
    });

    it("should fall back to default voice when voiceId is null", () => {
      (client as any).voiceId = null;
      expect((client as any).voiceId).toBeNull();
    });

    it("should set voice via setProperty", () => {
      client.setProperty("voice", "property-voice");
      expect(client.getProperty("voice")).toBe("property-voice");
    });
  });

  describe("factory integration", () => {
    it("should create client via factory", () => {
      const c = createTTSClient("cartesia", { apiKey: "test" });
      expect(c).toBeDefined();
      expect(c).toBeInstanceOf(CartesiaTTSClient);
    });

    it("should apply properties via factory", () => {
      const c = createTTSClient("cartesia", {
        apiKey: "test",
        properties: { model: "sonic-2" },
      });
      expect(c.getProperty("model")).toBe("sonic-2");
    });
  });

  describe("sample rate", () => {
    it("should have correct sample rate for WAV output", () => {
      expect((client as any).sampleRate).toBe(44100);
    });
  });

  describe("SSML handling", () => {
    it("should strip SSML before synthesis", async () => {
      const result = await (client as any).prepareText(
        "<speak>Hello <emphasis>world</emphasis></speak>"
      );
      expect(result).not.toContain("<speak>");
      expect(result).not.toContain("<emphasis>");
      expect(result).toContain("Hello");
      expect(result).toContain("world");
    });

    it("should handle plain text without SSML", async () => {
      const result = await (client as any).prepareText("Hello world");
      expect(result).toBe("Hello world");
    });
  });

  describe("SpeechMarkdown handling", () => {
    it("should convert SpeechMarkdown when option is set", async () => {
      const result = await (client as any).prepareText("Hello (world)[1]", {
        useSpeechMarkdown: true,
      });
      expect(result).not.toContain("[1]");
    });
  });

  describe("audio tag handling", () => {
    it("should convert emotion tags to SSML for sonic-3", () => {
      (client as any).model = "sonic-3";
      const result = (client as any).processAudioTags("Hello [happy] world");
      expect(result).toContain('<emotion value="happy"/>');
    });

    it("should strip all tags for sonic-2", () => {
      (client as any).model = "sonic-2";
      const result = (client as any).processAudioTags("Hello [happy] world");
      expect(result).toBe("Hello world");
    });

    it("should pass through laughter tags for sonic-3", () => {
      (client as any).model = "sonic-3";
      const result = (client as any).processAudioTags("Hello [laughter] world");
      expect(result).toContain("[laughter]");
    });
  });

  describe("credentials", () => {
    it("should require apiKey credential", () => {
      expect((client as any).getRequiredCredentials()).toEqual(["apiKey"]);
    });

    it("should return false for checkCredentials without key", async () => {
      const c = new CartesiaTTSClient({});
      expect(await c.checkCredentials()).toBe(false);
    });

    it("should provide detailed credential status", async () => {
      const status = await client.getCredentialStatus();
      expect(status).toHaveProperty("valid");
      expect(status).toHaveProperty("engine");
      expect(status.engine).toBe("cartesia");
      expect(status).toHaveProperty("requiresCredentials", true);
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
