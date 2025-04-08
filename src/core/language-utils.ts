/**
 * Language utilities for normalizing language codes across different formats
 */

/**
 * Standardized language information across all TTS engines
 */
export interface StandardizedLanguage {
  /**
   * ISO 639-3 language code (3-letter)
   */
  iso639_3: string;

  /**
   * BCP-47 language tag
   */
  bcp47: string;

  /**
   * Human-readable display name
   */
  display: string;

  /**
   * Country/region code (if applicable)
   */
  countryCode?: string;
}

/**
 * Language normalization utilities
 */
export class LanguageNormalizer {
  /**
   * Common language display names
   */
  private static readonly languageNames: Record<string, string> = {
    en: "English",
    fr: "French",
    es: "Spanish",
    de: "German",
    it: "Italian",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ru: "Russian",
    pt: "Portuguese",
    ar: "Arabic",
    hi: "Hindi",
    nl: "Dutch",
    sv: "Swedish",
    fi: "Finnish",
    no: "Norwegian",
    da: "Danish",
    pl: "Polish",
    tr: "Turkish",
    cs: "Czech",
    hu: "Hungarian",
    el: "Greek",
    he: "Hebrew",
    th: "Thai",
    vi: "Vietnamese",
    id: "Indonesian",
    ms: "Malay",
    ro: "Romanian",
    sk: "Slovak",
    uk: "Ukrainian",
    bg: "Bulgarian",
    hr: "Croatian",
    lt: "Lithuanian",
    lv: "Latvian",
    et: "Estonian",
    sl: "Slovenian",
    sr: "Serbian",
  };

  /**
   * Common region display names
   */
  private static readonly regionNames: Record<string, string> = {
    US: "United States",
    GB: "United Kingdom",
    AU: "Australia",
    CA: "Canada",
    IN: "India",
    IE: "Ireland",
    ZA: "South Africa",
    NZ: "New Zealand",
    FR: "France",
    DE: "Germany",
    IT: "Italy",
    ES: "Spain",
    MX: "Mexico",
    JP: "Japan",
    KR: "Korea",
    CN: "China",
    TW: "Taiwan",
    HK: "Hong Kong",
    BR: "Brazil",
    PT: "Portugal",
    RU: "Russia",
  };

  /**
   * ISO 639-1 to ISO 639-3 mapping
   */
  private static readonly iso1To3: Record<string, string> = {
    ar: "ara",
    bg: "bul",
    ca: "cat",
    cs: "ces",
    da: "dan",
    de: "deu",
    el: "ell",
    en: "eng",
    es: "spa",
    et: "est",
    fi: "fin",
    fr: "fra",
    he: "heb",
    hi: "hin",
    hr: "hrv",
    hu: "hun",
    id: "ind",
    it: "ita",
    ja: "jpn",
    ko: "kor",
    lt: "lit",
    lv: "lav",
    ms: "msa",
    nl: "nld",
    no: "nor",
    pl: "pol",
    pt: "por",
    ro: "ron",
    ru: "rus",
    sk: "slk",
    sl: "slv",
    sr: "srp",
    sv: "swe",
    th: "tha",
    tr: "tur",
    uk: "ukr",
    vi: "vie",
    zh: "zho",
  };

  /**
   * Normalize a language code to standard formats
   * @param langCode Input language code (can be ISO639-1/2/3, BCP47, or locale)
   * @param countryCode Optional country code to help with regionalization
   * @returns StandardizedLanguage object containing normalized codes
   */
  static normalize(langCode: string, countryCode?: string): StandardizedLanguage {
    try {
      // Handle MMS prefix if present
      if (langCode.startsWith("mms_")) {
        langCode = langCode.substring(4);
      }

      // Parse the language code
      let language: string;
      let region: string | undefined;

      // Check if it's a BCP-47 code with region (e.g., en-US)
      if (langCode.includes("-")) {
        const parts = langCode.split("-");
        language = parts[0].toLowerCase();
        region = parts[1].toUpperCase();
      } else {
        language = langCode.toLowerCase();
        region = countryCode?.toUpperCase();
      }

      // Convert to ISO 639-3
      const iso639_3 = LanguageNormalizer.iso1To3[language] || language;

      // Create BCP-47 tag
      const bcp47 = region ? `${language}-${region}` : language;

      // Create display name
      let display = LanguageNormalizer.languageNames[language] || language;
      if (region && LanguageNormalizer.regionNames[region]) {
        display += ` (${LanguageNormalizer.regionNames[region]})`;
      } else if (region) {
        display += ` (${region})`;
      }

      return {
        iso639_3,
        bcp47,
        display,
        countryCode: region,
      };
    } catch (_error) {
      // Fallback for unknown codes
      return {
        iso639_3: "und",
        bcp47: "und",
        display: "Unknown",
      };
    }
  }

  /**
   * Get the display name for a language code
   * @param langCode Language code
   * @returns Display name
   */
  static getDisplayName(langCode: string): string {
    return LanguageNormalizer.normalize(langCode).display;
  }

  /**
   * Get the ISO 639-3 code for a language code
   * @param langCode Language code
   * @returns ISO 639-3 code
   */
  static getISO639_3(langCode: string): string {
    return LanguageNormalizer.normalize(langCode).iso639_3;
  }

  /**
   * Get the BCP-47 tag for a language code
   * @param langCode Language code
   * @param countryCode Optional country code
   * @returns BCP-47 tag
   */
  static getBCP47(langCode: string, countryCode?: string): string {
    return LanguageNormalizer.normalize(langCode, countryCode).bcp47;
  }
}
