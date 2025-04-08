import type { UnifiedVoice } from "../types";

/**
 * Filter voices by language code
 * @param voices Array of voices to filter
 * @param languageCode BCP-47 language code to filter by
 * @returns Filtered array of voices
 */
export function filterByLanguage(voices: UnifiedVoice[], languageCode: string): UnifiedVoice[] {
  return voices.filter((voice) =>
    voice.languageCodes.some((lang) => lang.bcp47.toLowerCase() === languageCode.toLowerCase())
  );
}

/**
 * Filter voices by gender
 * @param voices Array of voices to filter
 * @param gender Gender to filter by
 * @returns Filtered array of voices
 */
export function filterByGender(
  voices: UnifiedVoice[],
  gender: "Male" | "Female" | "Unknown"
): UnifiedVoice[] {
  return voices.filter((voice) => voice.gender === gender);
}

/**
 * Filter voices by provider
 * @param voices Array of voices to filter
 * @param provider Provider to filter by
 * @returns Filtered array of voices
 */
export function filterByProvider(
  voices: UnifiedVoice[],
  provider:
    | "azure"
    | "google"
    | "ibm"
    | "elevenlabs"
    | "polly"
    | "witai"
    | "playht"
    | "openai"
    | "sherpa"
): UnifiedVoice[] {
  return voices.filter((voice) => voice.provider === provider);
}

/**
 * Find a voice by ID
 * @param voices Array of voices to search
 * @param id Voice ID to find
 * @returns The found voice or undefined
 */
export function findById(voices: UnifiedVoice[], id: string): UnifiedVoice | undefined {
  return voices.find((voice) => voice.id === id);
}

/**
 * Get all available languages from a list of voices
 * @param voices Array of voices
 * @returns Array of unique language codes
 */
export function getAvailableLanguages(voices: UnifiedVoice[]): string[] {
  // Use a Set to collect unique language codes
  const languages = new Set<string>();

  // Iterate through all voices and their language codes
  for (const voice of voices) {
    for (const lang of voice.languageCodes) {
      languages.add(lang.bcp47);
    }
  }

  // Convert Set to Array and return
  return Array.from(languages);
}
