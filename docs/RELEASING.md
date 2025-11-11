# Release Process

This document explains how to release a new version of the TTS wrapper.

## Prerequisites

1. You need to have an npm account and be added as a collaborator to the package.
2. You need to be logged in to npm on your local machine (`npm login`).
3. You need to have write access to the GitHub repository.

## Manual Release Process

1. Update the version in `package.json`:
   ```bash
   npm version patch  # for bug fixes
   npm version minor  # for new features
   npm version major  # for breaking changes
   ```

2. Push the changes to GitHub:
   ```bash
   git push
   git push --tags
   ```

3. Build and prepare the package:
   ```bash
   npm run prepublishOnly
   ```

4. Publish the package:
   ```bash
   cd dist
   npm publish
   ```

## Automated Release Process (Recommended)

The repository is configured with GitHub Actions to automatically test and publish new releases. The version is determined by the GitHub release tag, not the package.json file.

1. Create a new release on GitHub:
   - Go to the repository on GitHub
   - Click on "Releases"
   - Click on "Draft a new release"
   - Create a new tag with the desired version (e.g., `v0.1.48`)
   - Add a title and description
   - Click "Publish release"

2. The GitHub Actions workflow will automatically:
   - Run tests
   - Set the package.json version to match the release tag
   - Build the package
   - Publish to npm
   - Commit the updated package.json version back to the main branch

**Note**: The version in the root `package.json` file is automatically synced after each release, so you don't need to manually update it.

## Syncing Local Package Version

If you need to sync your local `package.json` version with the latest release (useful for development), you can run:

```bash
npm run sync-version
```

This script will automatically fetch the latest release version from GitHub and update your local `package.json` file.

## GitHub Secrets

The following secrets need to be configured in the GitHub repository for the automated release process to work:

- `NPM_TOKEN`: An npm access token with publish permissions
- `MICROSOFT_TOKEN`: Azure TTS subscription key (optional, for testing)
- `MICROSOFT_REGION`: Azure TTS region (optional, for testing)
- `ELEVENLABS_API_KEY`: ElevenLabs API key (optional, for testing)
- `GOOGLE_SA_KEY`: Google Cloud service account key in JSON format (optional, for testing)

## Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** version when you make incompatible API changes
- **MINOR** version when you add functionality in a backwards compatible manner
- **PATCH** version when you make backwards compatible bug fixes
