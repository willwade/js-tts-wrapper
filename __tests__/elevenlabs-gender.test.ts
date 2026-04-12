/**
 * Tests for ElevenLabs engine gender mapping in _mapVoicesToUnified (issue #44)
 * The bulk voice list response includes labels.gender as "female" / "male"
 */

import { ElevenLabsTTSClient } from "../src/engines/elevenlabs";

describe("ElevenLabs _mapVoicesToUnified — gender mapping", () => {
  let client: any;

  beforeEach(() => {
    client = new ElevenLabsTTSClient({ apiKey: "fake" });
  });

  it("maps labels.gender=female to Female", async () => {
    const voices = await client._mapVoicesToUnified([
      { voice_id: "v1", name: "Rachel", labels: { gender: "female", accent: "en-US" } },
    ]);
    expect(voices[0].gender).toBe("Female");
  });

  it("maps labels.gender=male to Male", async () => {
    const voices = await client._mapVoicesToUnified([
      { voice_id: "v2", name: "Adam", labels: { gender: "male", accent: "en-US" } },
    ]);
    expect(voices[0].gender).toBe("Male");
  });

  it("leaves gender undefined when labels.gender is absent", async () => {
    const voices = await client._mapVoicesToUnified([
      { voice_id: "v3", name: "Unnamed", labels: {} },
    ]);
    expect(voices[0].gender).toBeUndefined();
  });

  it("leaves gender undefined when labels is absent", async () => {
    const voices = await client._mapVoicesToUnified([
      { voice_id: "v4", name: "NoLabels" },
    ]);
    expect(voices[0].gender).toBeUndefined();
  });
});
