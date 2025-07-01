import { describe, it, expect } from "@jest/globals";
import { createTTSClient } from "../factory";
import { EspeakBrowserTTSClient } from "../engines/espeak-wasm";
import { OpenAITTSClient } from "../engines/openai";
import { AzureTTSClient } from "../engines/azure";

/**
 * Test suite for credential validation functionality
 */
describe("Credential Validation", () => {
  describe("getCredentialStatus method", () => {
    it("should return comprehensive status for credential-free engines", async () => {
      const tts = new EspeakBrowserTTSClient({});
      const status = await tts.getCredentialStatus();

      expect(status).toMatchObject({
        valid: true,
        engine: expect.stringContaining('espeak'),
        environment: expect.stringMatching(/^(browser|node)$/),
        requiresCredentials: false,
        credentialTypes: [],
        message: expect.stringContaining('credentials are valid')
      });
    });

    it("should return proper status structure for engines requiring credentials", async () => {
      const tts = new AzureTTSClient({ subscriptionKey: '', region: '' });
      const status = await tts.getCredentialStatus();

      expect(status).toMatchObject({
        engine: expect.stringContaining('azure'),
        environment: expect.stringMatching(/^(browser|node)$/),
        requiresCredentials: true,
        credentialTypes: ['subscriptionKey', 'region'],
        message: expect.any(String)
      });

      // Should be invalid with empty credentials
      expect(status.valid).toBe(false);
    });
  });

  describe("getRequiredCredentials method", () => {
    it("should return empty array for credential-free engines", async () => {
      const tts = new EspeakBrowserTTSClient({});
      // Access protected method through type assertion for testing
      const requiredCreds = (tts as any).getRequiredCredentials();
      expect(requiredCreds).toEqual([]);
    });

    it("should return correct credential types for cloud engines", async () => {
      const openaiTTS = new OpenAITTSClient({});
      const openaiCreds = (openaiTTS as any).getRequiredCredentials();
      expect(openaiCreds).toEqual(['apiKey']);

      const azureTTS = new AzureTTSClient({ subscriptionKey: '', region: '' });
      const azureCreds = (azureTTS as any).getRequiredCredentials();
      expect(azureCreds).toEqual(['subscriptionKey', 'region']);
    });
  });

  describe("checkCredentials method", () => {
    it("should return true for credential-free engines", async () => {
      const tts = new EspeakBrowserTTSClient({});
      const isValid = await tts.checkCredentials();
      expect(isValid).toBe(true);
    });

    it("should return false for engines with invalid credentials", async () => {
      const tts = new OpenAITTSClient({ apiKey: 'fake-key' });
      const isValid = await tts.checkCredentials();
      expect(isValid).toBe(false);
    });

    it("should return false for engines with missing credentials", async () => {
      const tts = new AzureTTSClient({ subscriptionKey: '', region: '' });
      const isValid = await tts.checkCredentials();
      expect(isValid).toBe(false);
    });
  });

  describe("Factory integration", () => {
    it("should work with factory-created clients", async () => {
      const tts = createTTSClient('espeak-wasm', {});
      const status = await tts.getCredentialStatus();
      
      expect(status.valid).toBe(true);
      expect(status.requiresCredentials).toBe(false);
    });

    it("should handle invalid credentials gracefully", async () => {
      const tts = createTTSClient('openai', { apiKey: 'fake-key' });
      
      // Should not throw, but return false
      const isValid = await tts.checkCredentials();
      expect(isValid).toBe(false);
      
      // Status should provide detailed information
      const status = await tts.getCredentialStatus();
      expect(status.valid).toBe(false);
      expect(status.credentialTypes).toContain('apiKey');
    });
  });

  describe("Environment detection", () => {
    it("should correctly detect environment", async () => {
      const tts = new EspeakBrowserTTSClient({});
      const status = await tts.getCredentialStatus();
      
      // Should detect Node.js environment in test
      expect(status.environment).toBe('node');
    });
  });

  describe("Error handling", () => {
    it("should handle errors gracefully in getCredentialStatus", async () => {
      // Create a client that will have invalid credentials
      const tts = new AzureTTSClient({ subscriptionKey: '', region: '' });

      const status = await tts.getCredentialStatus();

      expect(status.valid).toBe(false);
      expect(status.message).toContain('credentials are invalid');
      expect(status.credentialTypes).toEqual(['subscriptionKey', 'region']);
    });
  });
});
