/**
 * Environment detection and cross-platform utilities
 */

/**
 * Check if code is running in a browser environment
 */
export const isBrowser = typeof window !== "undefined";

/**
 * Check if code is running in a Node.js environment
 */
export const isNode =
  !isBrowser &&
  typeof process !== "undefined" &&
  typeof process.versions !== "undefined" &&
  typeof process.versions.node !== "undefined";

/**
 * File system utilities that work in both environments
 */
export const fileSystem = {
  /**
   * Read a file asynchronously
   * @param path Path to the file
   * @returns Promise resolving to the file contents as a string
   */
  readFile: async (path: string): Promise<string> => {
    if (isNode) {
      // Node.js implementation
      const fs = await new Function("m", "return import(m)")("node:fs/promises");
      return fs.readFile(path, "utf-8");
    }
    // Browser implementation - fetch from URL
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  },

  /**
   * Read a file synchronously
   * @param path Path to the file
   * @returns File contents as a string
   */
  readFileSync: (path: string): string => {
    if (isNode) {
      // Node.js implementation
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = new Function("n", "return require(n)")("node" + ":fs");
      return fs.readFileSync(path, "utf-8");
    }
    throw new Error("Synchronous file reading is not supported in browsers");
  },

  /**
   * Write a file asynchronously
   * @param path Path to the file
   * @param data Data to write
   * @returns Promise resolving when the file is written
   */
  writeFile: async (path: string, data: string | Uint8Array): Promise<void> => {
    if (isNode) {
      // Node.js implementation
      const fs = await new Function("m", "return import(m)")("node:fs/promises");
      return fs.writeFile(path, data);
    }
    // Browser implementation - download file
    const blob = new Blob([data], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = path.split("/").pop() || "download";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document?.body) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 100);
  },

  /**
   * Write a file synchronously
   * @param path Path to the file
   * @param data Data to write
   */
  writeFileSync: (path: string, data: string | Uint8Array): void => {
    if (isNode) {
      // Node.js implementation
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = new Function("n", "return require(n)")("node" + ":fs");
      fs.writeFileSync(path, data);
    } else {
      throw new Error("Synchronous file writing is not supported in browsers");
    }
  },

  /**
   * Check if a file exists asynchronously
   * @param path Path to the file
   * @returns Promise resolving to true if the file exists, false otherwise
   */
  exists: async (path: string): Promise<boolean> => {
    if (isNode) {
      // Node.js implementation
      const fs = await new Function("m", "return import(m)")("node:fs/promises");
      try {
        await fs.access(path);
        return true;
      } catch {
        return false;
      }
    } else {
      // Browser implementation - try to fetch
      try {
        const response = await fetch(path, { method: "HEAD" });
        return response.ok;
      } catch {
        return false;
      }
    }
  },

  /**
   * Check if a file exists synchronously
   * @param path Path to the file
   * @returns True if the file exists, false otherwise
   */
  existsSync: (path: string): boolean => {
    if (isNode) {
      // Node.js implementation
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = new Function("n", "return require(n)")("node" + ":fs");
      return fs.existsSync(path);
    }
    throw new Error("Synchronous file existence check is not supported in browsers");
  },
};

/**
 * Path utilities that work in both environments
 */
export const pathUtils = {
  /**
   * Join path segments
   * @param paths Path segments to join
   * @returns Joined path
   */
  join: (...paths: string[]): string => {
    if (isNode) {
      // Node.js implementation
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = new Function("n", "return require(n)")("node" + ":path");
      return path.join(...paths);
    }
    // Browser implementation
    return paths.join("/").replace(/\/+/g, "/");
  },

  /**
   * Get the directory name of a path
   * @param path Path
   * @returns Directory name
   */
  dirname: (path: string): string => {
    if (isNode) {
      // Node.js implementation
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodePath = new Function("n", "return require(n)")("node" + ":path");
      return nodePath.dirname(path);
    }
    // Browser implementation
    return path.split("/").slice(0, -1).join("/") || ".";
  },

  /**
   * Get the base name of a path
   * @param path Path
   * @returns Base name
   */
  basename: (path: string): string => {
    if (isNode) {
      // Node.js implementation
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodePath = new Function("n", "return require(n)")("node" + ":path");
      return nodePath.basename(path);
    }
    // Browser implementation
    return path.split("/").pop() || "";
  },

  /**
   * Get the extension of a path
   * @param path Path
   * @returns Extension
   */
  extname: (path: string): string => {
    if (isNode) {
      // Node.js implementation
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodePath = new Function("n", "return require(n)")("node" + ":path");
      return nodePath.extname(path);
    }
    // Browser implementation
    const basename = path.split("/").pop() || "";
    const dotIndex = basename.lastIndexOf(".");
    return dotIndex === -1 ? "" : basename.slice(dotIndex);
  },
};
