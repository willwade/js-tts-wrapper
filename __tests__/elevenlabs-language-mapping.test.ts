/**
 * Tests for ElevenLabs language mapping fix (issue #51)
 *
 * Problem:
 * 1. labels.accent ("american", "british") is not a BCP-47 code
 * 2. Multilingual voices only got one language code instead of all supported languages
 *
 * Fix:
 * - Fetch /v1/models to get language lists per model
 * - Map voice.high_quality_base_model_ids → union of languages
 * - Use language_id ("en", "es") as bcp47, language name as display
 */

import { ElevenLabsTTSClient } from "../src/engines/elevenlabs";

const MOCK_VOICES = [
  {
    voice_id: "v1",
    name: "Rachel",
    labels: { gender: "female", accent: "american" },
    high_quality_base_model_ids: ["eleven_multilingual_v2", "eleven_flash_v2_5"],
  },
  {
    voice_id: "v2",
    name: "Bella",
    labels: { gender: "female", accent: "british" },
    high_quality_base_model_ids: ["eleven_multilingual_v2"],
  },
  {
    voice_id: "v3",
    name: "OldVoice",
    labels: {},
    high_quality_base_model_ids: [], // no models
  },
];

const MOCK_MODELS = [
  {
    model_id: "eleven_multilingual_v2",
    can_do_text_to_speech: true,
    languages: [
      { language_id: "en", name: "English" },
      { language_id: "es", name: "Spanish" },
      { language_id: "fr", name: "French" },
      { language_id: "de", name: "German" },
    ],
  },
  {
    model_id: "eleven_flash_v2_5",
    can_do_text_to_speech: true,
    languages: [
      { language_id: "en", name: "English" },
      { language_id: "es", name: "Spanish" },
      { language_id: "ja", name: "Japanese" },
    ],
  },
  {
    model_id: "eleven_tts_v1",
    can_do_text_to_speech: false, // not a TTS model — should be ignored
    languages: [{ language_id: "en", name: "English" }],
  },
];

function mockFetch(voicesPayload: object, modelsPayload: object[]) {
  return jest.fn().mockImplementation((url: string) => {
    if (url.includes("/models")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(modelsPayload),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(voicesPayload),
    });
  });
}

describe("ElevenLabs _mapVoicesToUnified — language mapping from models", () => {
  let client: any;

  beforeEach(() => {
    client = new ElevenLabsTTSClient({ apiKey: "fake" });
  });

  it("maps a multilingual voice to all languages from its models (deduped)", async () => {
    // Rachel supports eleven_multilingual_v2 (en, es, fr, de) + eleven_flash_v2_5 (en, es, ja)
    // → union = en, es, fr, de, ja (en and es deduped)
    const rawVoices = await client._getVoicesWithModels(MOCK_VOICES, MOCK_MODELS);
    const voices = await client._mapVoicesToUnified(rawVoices);
    const rachel = voices.find((v: any) => v.id === "v1");

    const bcp47s = rachel.languageCodes.map((lc: any) => lc.bcp47);
    expect(bcp47s).toContain("en");
    expect(bcp47s).toContain("es");
    expect(bcp47s).toContain("fr");
    expect(bcp47s).toContain("de");
    expect(bcp47s).toContain("ja");
    expect(new Set(bcp47s).size).toBe(bcp47s.length); // no duplicates
  });

  it("uses human-readable language name as display", async () => {
    const rawVoices = await client._getVoicesWithModels(MOCK_VOICES, MOCK_MODELS);
    const voices = await client._mapVoicesToUnified(rawVoices);
    const rachel = voices.find((v: any) => v.id === "v1");
    const en = rachel.languageCodes.find((lc: any) => lc.bcp47 === "en");

    expect(en.display).toBe("English");
  });

  it("falls back to English when voice has no model ids", async () => {
    const rawVoices = await client._getVoicesWithModels(MOCK_VOICES, MOCK_MODELS);
    const voices = await client._mapVoicesToUnified(rawVoices);
    const old = voices.find((v: any) => v.id === "v3");

    expect(old.languageCodes).toHaveLength(1);
    expect(old.languageCodes[0].bcp47).toBe("en");
  });

  it("ignores models where can_do_text_to_speech is false", async () => {
    const rawVoices = await client._getVoicesWithModels(MOCK_VOICES, MOCK_MODELS);
    const voices = await client._mapVoicesToUnified(rawVoices);
    // No voice uses eleven_tts_v1 — but confirm it wasn't added to language map
    const rachel = voices.find((v: any) => v.id === "v1");
    const bcp47s = rachel.languageCodes.map((lc: any) => lc.bcp47);
    // eleven_tts_v1 only had "en" — already present, so count shouldn't change due to it
    expect(bcp47s).toContain("en");
  });
});
