// Jest setup file to load environment variables from .env file
const fs = require("fs");
const path = require("path");

// Read the .env file
const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, "utf8");

  // Parse the environment variables
  const envLines = envContent.split("\n");
  for (const line of envLines) {
    if (line.trim() && !line.startsWith("#")) {
      const match = line.match(/^export\s+([A-Za-z0-9_]+)="(.*)"/);
      if (match) {
        const [, key, value] = match;
        process.env[key] = value;
      }
    }
  }

  console.log("Environment variables loaded from .env file for Jest");
} else {
  console.log("No .env file found for Jest");
}
