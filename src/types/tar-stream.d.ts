declare module "tar-stream" {
  import type { Readable, Writable } from "node:stream";

  interface Header {
    name: string;
    mode?: number;
    uid?: number;
    gid?: number;
    size?: number;
    mtime?: Date;
    type?: string;
    linkname?: string;
    uname?: string;
    gname?: string;
    devmajor?: number;
    devminor?: number;
  }

  interface Pack extends Writable {
    entry(header: Header, callback?: (err: Error) => void): Writable;
    entry(header: Header, buffer?: Buffer, callback?: (err: Error) => void): void;
    finalize(): void;
  }

  interface Extract extends Writable {
    on(
      event: "entry",
      listener: (header: Header, stream: Readable, next: (err?: Error) => void) => void
    ): this;
    on(event: "finish", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
  }

  export function pack(): Pack;
  export function extract(): Extract;
}
