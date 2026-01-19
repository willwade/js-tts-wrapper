#!/usr/bin/env node

/**
 * Script to fix import.meta usage in CJS files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const cjsDir = path.join(rootDir, 'dist', 'cjs');

/**
 * Recursively find all .js files in a directory
 */
function findJsFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Fix import.meta usage in CJS files
 */
export function fixImportMetaInCjs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;

  // Replace the condition checking for import.meta
  const importMetaConditionPattern = /typeof\s+import\.meta\s+!==\s+'undefined'\s+&&\s+import\.meta\.url/g;
  if (importMetaConditionPattern.test(content)) {
    content = content.replace(importMetaConditionPattern, 'false /* import.meta not available in CJS */');
    hasChanges = true;
  }

  // Replace direct import.meta.url usage
  const importMetaUrlPattern = /import\.meta\.url/g;
  if (importMetaUrlPattern.test(content)) {
    content = content.replace(importMetaUrlPattern, "'file://' + __filename");
    hasChanges = true;
  }

  // Fix the specific pattern found in espeak-wasm.js: "file://" + __filename condition
  const importMetaConditionPattern2 = /typeof\s+import\.meta\s+!==\s+'undefined'\s+&&\s+['"]file:\/\/['"]\s+\+\s+__filename/g;
  if (importMetaConditionPattern2.test(content)) {
    content = content.replace(importMetaConditionPattern2, 'false /* import.meta not available in CJS */');
    hasChanges = true;
  }

  // Fix any remaining import.meta references
  const importMetaPattern = /import\.meta/g;
  if (importMetaPattern.test(content)) {
    content = content.replace(importMetaPattern, '({ url: "file://" + __filename }) /* import.meta polyfill for CJS */');
    hasChanges = true;
  }

  if (hasChanges) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed import.meta usage in ${filePath}`);
  }
}

const isCli = process.argv[1] === fileURLToPath(import.meta.url);
if (isCli) {
  // Find all JS files in the CJS directory
  const jsFiles = findJsFiles(cjsDir);

  // Fix import.meta usage in each file
  for (const file of jsFiles) {
    fixImportMetaInCjs(file);
  }

  console.log(`Fixed import.meta usage in ${jsFiles.length} files`);
}
