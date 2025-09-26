declare module "mespeak" {
  interface MeSpeak {
    speak(text: string, options?: Record<string, unknown>): number[] | null;
    loadConfig(config: unknown): void;
    loadVoice(voice: unknown): void;
    isConfigLoaded(): boolean;
    isVoiceLoaded(voiceId: string): boolean;
    setDefaultVoice(voiceId: string): void;
    [key: string]: unknown;
  }

  const meSpeak: MeSpeak;
  export default meSpeak;
}
