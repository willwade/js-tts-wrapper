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
function fixImportMetaInCjs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace the condition checking for import.meta
  const importMetaConditionPattern = /typeof\s+import\.meta\s+!==\s+'undefined'\s+&&\s+import\.meta\.url/g;
  content = content.replace(importMetaConditionPattern, 'false /* import.meta not available in CJS */');

  // Replace direct import.meta.url usage
  const importMetaUrlPattern = /import\.meta\.url/g;
  content = content.replace(importMetaUrlPattern, '"file://" + __filename');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Fixed import.meta usage in ${filePath}`);
}

// Find all JS files in the CJS directory
const jsFiles = findJsFiles(cjsDir);

// Fix import.meta usage in each file
for (const file of jsFiles) {
  fixImportMetaInCjs(file);
}

console.log(`Fixed import.meta usage in ${jsFiles.length} files`);
