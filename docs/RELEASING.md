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

## Automated Release Process

The repository is configured with GitHub Actions to automatically test and publish new releases.

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

3. Create a new release on GitHub:
   - Go to the repository on GitHub
   - Click on "Releases"
   - Click on "Draft a new release"
   - Select the tag you just pushed
   - Add a title and description
   - Click "Publish release"

4. The GitHub Actions workflow will automatically:
   - Run tests
   - Build the package
   - Publish to npm

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
