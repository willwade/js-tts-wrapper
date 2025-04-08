declare module "decompress" {
  interface DecompressFile {
    data: Buffer;
    mode: number;
    mtime: Date;
    path: string;
    type: string;
  }

  interface DecompressOptions {
    filter?: (file: DecompressFile) => boolean;
    map?: (file: DecompressFile) => DecompressFile;
    plugins?: any[];
    strip?: number;
  }

  function decompress(
    input: string | Buffer,
    output: string,
    options?: DecompressOptions
  ): Promise<DecompressFile[]>;

  export default decompress;
}

declare module "decompress-tarbz2" {
  function decompressTarbz2(): any;
  export default decompressTarbz2;
}

declare module "decompress-targz" {
  function decompressTargz(): any;
  export default decompressTargz;
}
