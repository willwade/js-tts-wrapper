import { isNode } from "./environment"; // Assuming this utility exists

// Import Node.js stream type if needed
import type { Readable } from "node:stream";

/**
 * Reads a ReadableStream<Uint8Array> (Web) or NodeJS.ReadableStream completely
 * and returns its contents as a single Buffer (in Node.js) or Uint8Array (in Browser).
 * @param stream The stream to read.
 * @returns A promise that resolves with the stream contents.
 */
export async function streamToBuffer(
  stream: ReadableStream<Uint8Array> | Readable // Use imported Readable type
): Promise<Buffer | Uint8Array> {
  const chunks: (Buffer | Uint8Array)[] = []; // Use a union type for chunks array
  let totalLength = 0;

  // Check if it's a Web ReadableStream (has getReader)
  if ("getReader" in stream && typeof stream.getReader === "function") {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          // value is Uint8Array from Web Stream
          chunks.push(value); // Store as Uint8Array initially
          totalLength += value.length;
        }
      }
    } finally {
      reader.releaseLock();
    }
    // Concatenate AFTER the loop for Web Streams
    if (isNode) {
      // Use isNode constant
      // Convert Uint8Array chunks to Buffer before concatenating in Node
      const bufferChunks = chunks.map((chunk) => Buffer.from(chunk as Uint8Array));
      return Buffer.concat(bufferChunks, totalLength);
    }
    // Browser environment: Concatenate Uint8Array chunks
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks as Uint8Array[]) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }
  if (typeof (stream as Readable).on === "function") {
    // Use type assertion
    // Assume it's a Node.js Readable stream
    return new Promise<Buffer>((resolve, reject) => {
      // Explicitly assert stream type for event listeners
      const nodeStream = stream as Readable;
      nodeStream.on("data", (chunk: Buffer | Uint8Array | string) => {
        const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(bufferChunk);
        totalLength += bufferChunk.length;
      });
      nodeStream.on("end", () => {
        // Concatenate collected Buffer chunks
        resolve(Buffer.concat(chunks as Buffer[], totalLength));
      });
      nodeStream.on("error", (err: Error) => {
        // Type the error parameter
        reject(err);
      });
    });
  }

  // Handle unexpected stream type if it's neither Web nor Node stream
  throw new Error("Unsupported stream type provided to streamToBuffer");
}
