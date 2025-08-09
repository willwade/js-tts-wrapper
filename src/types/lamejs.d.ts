declare module "lamejs" {
  export class Mp3Encoder {
    constructor(channels: number, sampleRate: number, bitRate: number);
    encodeBuffer(samples: Int16Array): Uint8Array;
    encodeBuffer(leftSamples: Int16Array, rightSamples: Int16Array): Uint8Array;
    flush(): Uint8Array;
  }
}
