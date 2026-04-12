/**
 * Tests for Google engine gender mapping (issue #44)
 * Google API returns ssmlGender as "MALE", "FEMALE", "NEUTRAL", or "SSML_VOICE_GENDER_UNSPECIFIED"
 * These must map to "Male", "Female", "Unknown" in UnifiedVoice
 */

import { GoogleTTSClient } from "../src/engines/google";

describe("Google _mapVoicesToUnified — gender casing", () => {
  let client: any;

  beforeEach(() => {
    client = new GoogleTTSClient({ keyFilename: "fake.json" });
  });

  it("maps FEMALE to Female", async () => {
    const voices = await client._mapVoicesToUnified([
      { name: "en-US-A", ssmlGender: "FEMALE", languageCodes: ["en-US"] },
    ]);
    expect(voices[0].gender).toBe("Female");
  });

  it("maps MALE to Male", async () => {
    const voices = await client._mapVoicesToUnified([
      { name: "en-US-B", ssmlGender: "MALE", languageCodes: ["en-US"] },
    ]);
    expect(voices[0].gender).toBe("Male");
  });

  it("maps NEUTRAL to Unknown", async () => {
    const voices = await client._mapVoicesToUnified([
      { name: "en-US-C", ssmlGender: "NEUTRAL", languageCodes: ["en-US"] },
    ]);
    expect(voices[0].gender).toBe("Unknown");
  });

  it("maps SSML_VOICE_GENDER_UNSPECIFIED to Unknown", async () => {
    const voices = await client._mapVoicesToUnified([
      { name: "en-US-D", ssmlGender: "SSML_VOICE_GENDER_UNSPECIFIED", languageCodes: ["en-US"] },
    ]);
    expect(voices[0].gender).toBe("Unknown");
  });

  it("maps missing ssmlGender to Unknown", async () => {
    const voices = await client._mapVoicesToUnified([
      { name: "en-US-E", languageCodes: ["en-US"] },
    ]);
    expect(voices[0].gender).toBe("Unknown");
  });
});
