declare module 'espeak-ng' {
  export interface EspeakNgOptions {
    voice?: string;
    rate?: number;
    pitch?: number;
    [key: string]: any;
  }

  export interface EspeakNgResult {
    buffer: Uint8Array;
    // May contain other fields (e.g., wav, mp3, etc.)
    [key: string]: any;
  }

  export function synthesize(
    text: string,
    options?: EspeakNgOptions
  ): Promise<EspeakNgResult>;

  const espeakng: {
    synthesize: typeof synthesize;
  };

  export default espeakng;
}
