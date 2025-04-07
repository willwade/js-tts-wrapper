import { UnifiedVoice } from '../types';
/**
 * Utility functions for working with voice data
 */
export declare class VoiceUtils {
    /**
     * Filter voices by language code
     * @param voices Array of voices to filter
     * @param languageCode BCP-47 language code to filter by
     * @returns Filtered array of voices
     */
    static filterByLanguage(voices: UnifiedVoice[], languageCode: string): UnifiedVoice[];
    /**
     * Filter voices by gender
     * @param voices Array of voices to filter
     * @param gender Gender to filter by
     * @returns Filtered array of voices
     */
    static filterByGender(voices: UnifiedVoice[], gender: 'Male' | 'Female' | 'Unknown'): UnifiedVoice[];
    /**
     * Filter voices by provider
     * @param voices Array of voices to filter
     * @param provider Provider to filter by
     * @returns Filtered array of voices
     */
    static filterByProvider(voices: UnifiedVoice[], provider: 'azure' | 'google' | 'ibm' | 'elevenlabs' | 'polly' | 'witai' | 'playht' | 'openai' | 'sherpa'): UnifiedVoice[];
    /**
     * Find a voice by ID
     * @param voices Array of voices to search
     * @param id Voice ID to find
     * @returns The found voice or undefined
     */
    static findById(voices: UnifiedVoice[], id: string): UnifiedVoice | undefined;
    /**
     * Get all available languages from a list of voices
     * @param voices Array of voices
     * @returns Array of unique language codes
     */
    static getAvailableLanguages(voices: UnifiedVoice[]): string[];
}
