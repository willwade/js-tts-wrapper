# Language Normalization

This document explains how language codes are normalized across different TTS engines in the TTS wrapper.

## Overview

Different TTS engines use different formats for language codes. For example:

- Azure TTS uses BCP-47 codes like `en-US`
- Google TTS uses BCP-47 codes like `en-US`
- ElevenLabs uses custom language codes or BCP-47 codes

To provide a consistent interface, the TTS wrapper normalizes language codes across all engines using a centralized language normalization system.

## Language Normalization System

The language normalization system is implemented in `src/core/language-utils.ts`. It provides:

1. **Standardized Language Interface**:
   ```typescript
   interface StandardizedLanguage {
     iso639_3: string;    // ISO 639-3 language code (3-letter)
     bcp47: string;       // BCP-47 language tag
     display: string;     // Human-readable display name
     countryCode?: string; // Country/region code (if applicable)
   }
   ```

2. **Language Normalization Utilities**:
   - `normalize(langCode: string, countryCode?: string)`: Normalizes a language code to standard formats
   - `getDisplayName(langCode: string)`: Gets the display name for a language code
   - `getISO639_3(langCode: string)`: Gets the ISO 639-3 code for a language code
   - `getBCP47(langCode: string, countryCode?: string)`: Gets the BCP-47 tag for a language code

## How It Works

1. **Engine-Specific Voice Retrieval**:
   - Each TTS engine implements a `_getVoices()` method that retrieves voices from the provider
   - The raw voice data is returned in the provider's native format

2. **Voice Mapping**:
   - Each TTS engine implements a `_mapVoicesToUnified()` method that maps the raw voice data to a partially unified format
   - This includes mapping provider-specific language codes to BCP-47 format

3. **Language Normalization**:
   - The `getVoices()` method in the `AbstractTTSClient` class applies language normalization to all voices
   - It uses the `LanguageNormalizer.normalize()` method to normalize language codes
   - This ensures that all language codes are consistent across all engines

4. **Language-Based Voice Filtering**:
   - The `getVoicesByLanguage()` method uses normalized language codes to filter voices
   - It matches voices by both BCP-47 and ISO 639-3 codes
   - This allows users to find voices using either format

## Example

```typescript
// Get all voices
const voices = await tts.getVoices();

// Get English voices (using BCP-47 code)
const enVoices = await tts.getVoicesByLanguage('en-US');

// Get English voices (using ISO 639-3 code)
const engVoices = await tts.getVoicesByLanguage('eng');
```

## Benefits

1. **Consistency**: All TTS engines use the same language code formats
2. **Flexibility**: Users can use different language code formats
3. **Extensibility**: New TTS engines can be added without changing the language normalization system
4. **Maintainability**: Language code mapping is centralized in one place

## Adding a New TTS Engine

When adding a new TTS engine, you need to:

1. Implement the `_getVoices()` method to retrieve voices from the provider
2. Implement the `_mapVoicesToUnified()` method to map the raw voice data to a partially unified format
3. The `AbstractTTSClient` class will handle the rest of the language normalization

The language normalization system will automatically normalize the language codes for the new engine.
