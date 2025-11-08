type BufferCtor = typeof import("buffer").Buffer;

let bunzipPromise: Promise<any> | null = null;
let bufferCtor: BufferCtor | null = null;

const loadBunzip = async () => {
  if (!bunzipPromise) {
    bunzipPromise = import("seek-bzip").then((mod) => mod.default || mod);
  }
  return bunzipPromise;
};

const ensureBufferCtor = async (): Promise<BufferCtor> => {
  if (bufferCtor) {
    return bufferCtor;
  }
  const existing = (globalThis as any).Buffer as BufferCtor | undefined;
  if (existing) {
    bufferCtor = existing;
    return bufferCtor;
  }
  const { Buffer } = await import("buffer");
  (globalThis as any).Buffer = Buffer;
  bufferCtor = Buffer;
  return bufferCtor;
};

/**
 * Decompress a bzip2-compressed payload into a Uint8Array.
 * Works in both Node.js and browser environments by lazily loading
 * the seek-bzip implementation and a Buffer polyfill when necessary.
 */
export const decompressBzip2 = async (data: ArrayBuffer | Uint8Array): Promise<Uint8Array> => {
  const input = data instanceof Uint8Array ? data : new Uint8Array(data);
  const [Bunzip, BufferCtor] = await Promise.all([loadBunzip(), ensureBufferCtor()]);

  const inputBuffer = BufferCtor.from(input);
  const decoded = Bunzip.decode(inputBuffer);
  const decodedBuffer = BufferCtor.isBuffer(decoded) ? decoded : BufferCtor.from(decoded);
  const output = new Uint8Array(decodedBuffer.length);
  output.set(decodedBuffer);
  return output;
};
