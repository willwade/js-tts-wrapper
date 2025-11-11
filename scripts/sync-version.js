#!/usr/bin/env node

/**
 * Script to sync package.json version with the latest GitHub release
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function compareVersions(a, b) {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;

    if (aPart > bPart) return 1;
    if (aPart < bPart) return -1;
  }
  return 0;
}

async function getLatestReleaseVersion() {
  try {
    // Get all releases from GitHub API to find the actual latest by version
    const response = await fetch('https://api.github.com/repos/willwade/js-tts-wrapper/releases?per_page=50');
    if (response.ok) {
      const releases = await response.json();
      const versions = releases
        .map(release => release.tag_name.replace(/^v/, ''))
        .filter(version => /^\d+\.\d+\.\d+$/.test(version)); // Only valid semver

      if (versions.length > 0) {
        // Sort versions and get the highest
        versions.sort(compareVersions);
        const latestVersion = versions[versions.length - 1];
        console.log(`Found ${versions.length} valid releases, latest: ${latestVersion}`);
        return latestVersion;
      }
    }
  } catch (error) {
    console.warn('Could not fetch from GitHub API, trying git tags...');
  }

  try {
    // Fallback: get the latest tag from git
    const latestTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
    return latestTag.replace(/^v/, ''); // Remove 'v' prefix
  } catch (error) {
    console.error('Could not determine latest version from git tags');
    throw error;
  }
}

async function syncVersion() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');

  try {
    // Get the latest release version
    const latestVersion = await getLatestReleaseVersion();
    console.log(`Latest release version: ${latestVersion}`);

    // Read current package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;

    console.log(`Current package.json version: ${currentVersion}`);

    const comparison = compareVersions(currentVersion, latestVersion);

    if (comparison === 0) {
      console.log('✅ Package.json version is already up to date!');
      return;
    } else if (comparison > 0) {
      console.log(`⚠️  Current package.json version (${currentVersion}) is newer than latest release (${latestVersion})`);
      console.log('💡 This might indicate you need to create a new release');
      return;
    }

    // Update the version
    packageJson.version = latestVersion;

    // Write back to package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

    console.log(`✅ Updated package.json version from ${currentVersion} to ${latestVersion}`);
    console.log('💡 Don\'t forget to commit this change if you want to keep it');

  } catch (error) {
    console.error('❌ Failed to sync version:', error.message);
    process.exit(1);
  }
}

// Run the script
syncVersion();
