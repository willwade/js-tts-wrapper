import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fixImportMetaInCjs } from "../scripts/fix-cjs-imports.js";

describe("fixImportMetaInCjs", () => {
  it("replaces import.meta.url with a safe CJS fallback", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "js-tts-wrapper-"));
    const tempFile = path.join(tempDir, "sample.js");
    const source = `const metaUrl = new Function("return import.meta.url")();`;

    fs.writeFileSync(tempFile, source, "utf8");

    fixImportMetaInCjs(tempFile);

    const output = fs.readFileSync(tempFile, "utf8");
    expect(output).toContain(`new Function("return 'file://' + __filename")()`);
  });
});
