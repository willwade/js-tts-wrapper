#!/usr/bin/env node

/**
 * Script to fix linting issues in specific files
 */

const { execSync } = require("node:child_process");

console.log("Fixing linting issues in specific files...");

try {
  // Fix the openai.ts file
  execSync("npx biome check --write src/engines/openai.ts", { stdio: "inherit" });
  console.log("Fixed src/engines/openai.ts");
} catch (error) {
  console.error("Error fixing linting issues:", error.message);
}
