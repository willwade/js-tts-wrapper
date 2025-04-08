declare module "decompress-bzip2" {
  import type { Transform } from "node:stream";

  function decompressBzip2(): Transform;

  export default decompressBzip2;
}
