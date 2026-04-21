import { filterByProvider } from "../core/voice-utils";
import { GeminiTTSClient } from "../engines/gemini";

describe("VoiceUtils", () => {
  it("filters Gemini unified voices by provider", async () => {
    const client = new GeminiTTSClient({ apiKey: "test-api-key" });
    const voices = await client.getVoices();

    const geminiVoices = filterByProvider(voices, "gemini");

    expect(geminiVoices).toHaveLength(voices.length);
    expect(geminiVoices.every((voice) => voice.provider === "gemini")).toBe(true);
  });
});
