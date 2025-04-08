/**
 * Mock implementation of sherpa-onnx-node for testing
 */

export class OfflineTts {
  constructor(_config: any) {
    // Mock constructor
  }

  generate(_options: { text: string; sid: number; speed: number }) {
    // Mock generate method
    return {
      samples: new Float32Array(1600),
      sampleRate: 16000,
    };
  }
}

export function writeWave(_filename: string, _options: { samples: Float32Array; sampleRate: number }) {
  // Mock writeWave function
}
