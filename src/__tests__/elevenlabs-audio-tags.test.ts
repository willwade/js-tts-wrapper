import { describe, it, expect, beforeEach } from "@jest/globals";
import { ElevenLabsTTSClient } from "../engines/elevenlabs";

describe("ElevenLabs Audio Tag Support", () => {
  let client: ElevenLabsTTSClient;

  beforeEach(() => {
    client = new ElevenLabsTTSClient({ apiKey: "test-api-key" });
  });

  describe("eleven_v3 audio tag passthrough", () => {
    it("should pass audio tags through for eleven_v3 model", () => {
      client.setProperty("model", "eleven_v3");
      const result = (client as any).processAudioTags("Hello [laugh] world");
      expect(result).toBe("Hello [laugh] world");
    });

    it("should pass multiple audio tags through for eleven_v3", () => {
      client.setProperty("model", "eleven_v3");
      const result = (client as any).processAudioTags("[sigh] Hello [laugh] world [cheer]");
      expect(result).toBe("[sigh] Hello [laugh] world [cheer]");
    });

    it("should pass text without tags unchanged for eleven_v3", () => {
      client.setProperty("model", "eleven_v3");
      const result = (client as any).processAudioTags("Hello world");
      expect(result).toBe("Hello world");
    });

    it("should pass per-request model override for v3 audio tags", () => {
      client.setProperty("model", "eleven_multilingual_v2");
      const result = (client as any).processAudioTags("Hello [laugh] world", { model: "eleven_v3" });
      expect(result).toBe("Hello [laugh] world");
    });
  });

  describe("non-v3 models strip audio tags", () => {
    it("should strip audio tags for eleven_multilingual_v2", () => {
      client.setProperty("model", "eleven_multilingual_v2");
      const result = (client as any).processAudioTags("Hello [laugh] world");
      expect(result).not.toContain("[laugh]");
      expect(result).toContain("Hello");
      expect(result).toContain("world");
    });

    it("should strip audio tags for eleven_flash_v2", () => {
      client.setProperty("model", "eleven_flash_v2");
      const result = (client as any).processAudioTags("Hello [sigh] world");
      expect(result).not.toContain("[sigh]");
    });

    it("should strip audio tags for eleven_flash_v2_5", () => {
      client.setProperty("model", "eleven_flash_v2_5");
      const result = (client as any).processAudioTags("[laugh] Hello");
      expect(result).not.toContain("[laugh]");
    });

    it("should clean up whitespace after stripping", () => {
      client.setProperty("model", "eleven_multilingual_v2");
      const result = (client as any).processAudioTags("Hello [laugh] world");
      expect(result).toBe("Hello world");
    });

    it("should handle text without tags unchanged for non-v3", () => {
      client.setProperty("model", "eleven_multilingual_v2");
      const result = (client as any).processAudioTags("Hello world");
      expect(result).toBe("Hello world");
    });
  });

  describe("model configuration", () => {
    it("should default to eleven_multilingual_v2", () => {
      expect(client.getProperty("model")).toBe("eleven_multilingual_v2");
    });

    it("should allow setting model to eleven_v3", () => {
      client.setProperty("model", "eleven_v3");
      expect(client.getProperty("model")).toBe("eleven_v3");
    });

    it("should accept model via constructor credentials", () => {
      const c = new ElevenLabsTTSClient({ apiKey: "test", model: "eleven_v3" });
      expect(c.getProperty("model")).toBe("eleven_v3");
    });

    it("should accept model via properties", () => {
      const c = new ElevenLabsTTSClient({
        apiKey: "test",
        properties: { model: "eleven_v3" },
      });
      expect(c.getProperty("model")).toBe("eleven_v3");
    });
  });
});
