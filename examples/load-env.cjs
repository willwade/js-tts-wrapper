// This script loads environment variables from a .env file
const fs = require("fs");
const path = require("path");

// Read the .env file from the project root
const envFile = path.join(__dirname, "..", ".env");
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, "utf8");

  // Parse the environment variables
  const envLines = envContent.split("\n");
  for (const line of envLines) {
    if (line.trim() && !line.startsWith("#")) {
      console.log("Processing line:", line);
      const match = line.match(/^export\s+([A-Za-z0-9_]+)="(.*)"/);
      if (match) {
        const [, key, value] = match;
        process.env[key] = value;
        console.log(`Set environment variable: ${key}`);
      } else {
        console.log("No match for line");
      }
    }
  }

  console.log("Environment variables loaded from .env file");
} else {
  console.log("No .env file found");
}

function loadEnv() {
  // This function can be called to load environment variables
  // The actual loading happens when this module is required
}

module.exports = { loadEnv };
