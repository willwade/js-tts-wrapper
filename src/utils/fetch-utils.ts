/**
 * Utility functions for handling fetch in different environments
 */

// Define the types we need
export interface FetchResponse {
  json(): Promise<any>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  body: ReadableStream<Uint8Array>;
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
}

export interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | ArrayBuffer | Uint8Array;
}

export type FetchFunction = (url: string, options?: FetchOptions) => Promise<FetchResponse>;

/**
 * Get a fetch implementation that works in both Node.js and browser environments
 *
 * This function tries to use:
 * 1. The global fetch if available (browsers and Node.js >= 18)
 * 2. node-fetch if installed (for older Node.js versions)
 * 3. Falls back to a mock implementation that throws an error
 *
 * @returns A fetch function that works in the current environment
 */
export function getFetch(): FetchFunction {
  // Check if global fetch is available (browsers and Node.js >= 18)
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch as FetchFunction;
  }

  // Try to use node-fetch if available
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeFetch = require("node-fetch");
    return nodeFetch as FetchFunction;
  } catch (_error) {
    // Return a mock implementation that throws an error
    return async () => {
      throw new Error(
        "Fetch API is not available. Please install node-fetch package or use a newer version of Node.js."
      );
    };
  }
}

/**
 * Check if fetch is available in the current environment
 *
 * @returns True if fetch is available, false otherwise
 */
export function isFetchAvailable(): boolean {
  try {
    const fetch = getFetch();
    return typeof fetch === "function";
  } catch (_error) {
    return false;
  }
}
