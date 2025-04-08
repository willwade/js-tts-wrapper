import type { SpeakOptions, UnifiedVoice } from "../types";

export abstract class AbstractTTSClient {
  protected voiceId: string | null = null;
  protected callbacks: Record<string, ((...args: any[]) => void)[]> = {};

  constructor(protected credentials: any) {}

  // --- Required abstract methods ---
  abstract getVoices(): Promise<UnifiedVoice[]>;
  abstract synthToBytes(text: string, options?: SpeakOptions): Promise<Uint8Array>;
  abstract synthToBytestream(
    text: string,
    options?: SpeakOptions
  ): Promise<ReadableStream<Uint8Array>>;

  // --- Optional overrides ---
  async speak(text: string, options?: SpeakOptions): Promise<void> {
    const audioBytes = await this.synthToBytes(text, options);
    const blob = new Blob([audioBytes], { type: "audio/wav" }); // default to WAV
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    this.emit("start");

    audio.onended = () => this.emit("end");
    audio.play();
  }

  async speakStreamed(text: string, options?: SpeakOptions): Promise<void> {
    const stream = await this.synthToBytestream(text, options);
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    let result = await reader.read();
    while (!result.done) {
      chunks.push(result.value);
      result = await reader.read();
    }

    const audioBytes = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      audioBytes.set(chunk, offset);
      offset += chunk.length;
    }

    return this.speak(audioBytes as any, options);
  }

  // --- Voice ---
  setVoice(voiceId: string): void {
    this.voiceId = voiceId;
  }

  // --- Playback (can be overridden or integrated with custom Audio control) ---
  pause(): void {
    // override in concrete class if you track audio objects
  }

  resume(): void {
    // override in concrete class if you track audio objects
  }

  stop(): void {
    // override in concrete class if you track audio objects
  }

  // --- Event System ---
  on(event: "start" | "end" | "boundary", fn: (...args: any[]) => void): void {
    this.callbacks[event] = this.callbacks[event] || [];
    this.callbacks[event].push(fn);
  }

  protected emit(event: string, ...args: any[]) {
    for (const fn of this.callbacks[event] || []) {
      fn(...args);
    }
  }
}
