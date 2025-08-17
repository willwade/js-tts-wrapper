import { SSMLCompatibilityManager } from "../core/ssml-compatibility";
import * as SSMLUtils from "../core/ssml-utils";
import { describe, it, expect } from '@jest/globals';

/**
 * SSML Compatibility Tests
 * 
 * This test suite verifies that the SSML compatibility layer:
 * 1. Correctly identifies engine capabilities
 * 2. Validates SSML for different engines
 * 3. Processes SSML appropriately for each engine
 * 4. Handles voice-specific capabilities
 */

describe("SSML Compatibility Manager", () => {
  describe("Engine Capabilities", () => {
    it("should return correct capabilities for SAPI", () => {
      const capabilities = SSMLCompatibilityManager.getCapabilities('sapi');
      expect(capabilities.supportsSSML).toBe(true);
      expect(capabilities.supportLevel).toBe('full');
      expect(capabilities.requiresVersion).toBe(true);
      expect(capabilities.requiresNamespace).toBe(false);
    });

    it("should return correct capabilities for Azure", () => {
      const capabilities = SSMLCompatibilityManager.getCapabilities('azure');
      expect(capabilities.supportsSSML).toBe(true);
      expect(capabilities.supportLevel).toBe('full');
      expect(capabilities.requiresVersion).toBe(true);
      expect(capabilities.requiresNamespace).toBe(true);
    });

    it("should return correct capabilities for ElevenLabs", () => {
      const capabilities = SSMLCompatibilityManager.getCapabilities('elevenlabs');
      expect(capabilities.supportsSSML).toBe(false);
      expect(capabilities.supportLevel).toBe('none');
      expect(capabilities.unsupportedTags).toContain('*');
    });

    it("should return no SSML support for unknown engines", () => {
      const capabilities = SSMLCompatibilityManager.getCapabilities('unknown-engine');
      expect(capabilities.supportsSSML).toBe(false);
      expect(capabilities.supportLevel).toBe('none');
    });
  });

  describe("Voice-Specific Capabilities", () => {
    it("should detect Polly neural voice limitations", () => {
      const capabilities = SSMLCompatibilityManager.getCapabilities('polly', 'Joanna-Neural');
      expect(capabilities.supportLevel).toBe('limited');
      expect(capabilities.unsupportedTags).toContain('emphasis');
    });

    it("should detect Polly standard voice full support", () => {
      const capabilities = SSMLCompatibilityManager.getCapabilities('polly', 'Joanna');
      expect(capabilities.supportLevel).toBe('full');
      expect(capabilities.unsupportedTags).toHaveLength(0);
    });

    it("should detect Google Neural2 voice limitations", () => {
      const capabilities = SSMLCompatibilityManager.getCapabilities('google', 'en-US-Neural2-F');
      expect(capabilities.supportLevel).toBe('limited');
      expect(capabilities.unsupportedTags).toContain('mark');
    });

    it("should detect Google Standard voice full support", () => {
      const capabilities = SSMLCompatibilityManager.getCapabilities('google', 'en-US-Standard-A');
      expect(capabilities.supportLevel).toBe('full');
    });
  });

  describe("SSML Validation", () => {
    const validSSML = `<speak>
      <prosody rate="fast" pitch="high">
        This text will be spoken quickly with a high pitch.
      </prosody>
      <break time="500ms"/>
      <emphasis level="strong">This text is emphasized.</emphasis>
    </speak>`;

    it("should validate SSML for full support engines", () => {
      const result = SSMLCompatibilityManager.validateSSML(validSSML, 'sapi');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should warn about unsupported tags for limited engines", () => {
      const result = SSMLCompatibilityManager.validateSSML(validSSML, 'polly', 'Joanna-Neural');
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('emphasis'))).toBe(true);
    });

    it("should warn about no SSML support for non-SSML engines", () => {
      const result = SSMLCompatibilityManager.validateSSML(validSSML, 'elevenlabs');
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('does not support SSML'))).toBe(true);
    });

    it("should detect invalid SSML structure", () => {
      const invalidSSML = "This is not SSML";
      const result = SSMLCompatibilityManager.validateSSML(invalidSSML, 'sapi');
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('wrapped in <speak> tags'))).toBe(true);
    });
  });

  describe("SSML Processing", () => {
    const testSSML = `<speak>
      <prosody rate="fast" pitch="high">Fast speech</prosody>
      <break time="500ms"/>
      <emphasis level="strong">Emphasized text</emphasis>
    </speak>`;

    it("should preserve SSML for full support engines", () => {
      const processed = SSMLCompatibilityManager.processSSMLForEngine(testSSML, 'sapi');
      expect(processed).toContain('<prosody');
      expect(processed).toContain('<emphasis');
      expect(processed).toContain('version="1.0"'); // Should add required version
    });

    it("should remove unsupported tags for limited engines", () => {
      const processed = SSMLCompatibilityManager.processSSMLForEngine(testSSML, 'polly', 'Joanna-Neural');
      expect(processed).toContain('<prosody'); // Should keep supported tags
      expect(processed).not.toContain('<emphasis'); // Should remove unsupported tags
    });

    it("should strip all SSML for non-SSML engines", () => {
      const processed = SSMLCompatibilityManager.processSSMLForEngine(testSSML, 'elevenlabs');
      expect(processed).not.toContain('<speak');
      expect(processed).not.toContain('<prosody');
      expect(processed).not.toContain('<emphasis');
      expect(processed).toContain('Fast speech');
      expect(processed).toContain('Emphasized text');
    });

    it("should add required namespace for Azure", () => {
      const processed = SSMLCompatibilityManager.processSSMLForEngine(testSSML, 'azure');
      expect(processed).toContain('xmlns="http://www.w3.org/2001/10/synthesis"');
      expect(processed).toContain('version="1.0"');
    });
  });

  describe("Integration with SSMLUtils", () => {
    it("should integrate validateSSMLForEngine function", () => {
      const testSSML = '<speak>Hello world</speak>';
      const result = SSMLUtils.validateSSMLForEngine(testSSML, 'sapi');
      expect(result.isValid).toBe(true);
    });

    it("should integrate processSSMLForEngine function", () => {
      const testSSML = '<speak>Hello world</speak>';
      const processed = SSMLUtils.processSSMLForEngine(testSSML, 'sapi');
      expect(processed).toContain('version="1.0"');
    });
  });

  describe("Complex SSML Scenarios", () => {
    const complexSSML = `<speak>
      <prosody rate="x-fast" pitch="x-high">
        This text will be spoken slowly with a low pitch.
      </prosody>
      <break time="500ms"/>
      <emphasis level="strong">This text is emphasized.</emphasis>
      <voice name="en-US-AriaNeural">
        <prosody rate="slow">This is in a different voice.</prosody>
      </voice>
    </speak>`;

    it("should handle complex SSML for Azure", () => {
      const processed = SSMLUtils.processSSMLForEngine(complexSSML, 'azure');
      expect(processed).toContain('xmlns=');
      expect(processed).toContain('version=');
      expect(processed).toContain('<prosody');
      expect(processed).toContain('<emphasis');
    });

    it("should handle complex SSML for Polly neural voices", () => {
      const processed = SSMLUtils.processSSMLForEngine(complexSSML, 'polly', 'Joanna-Neural');
      expect(processed).toContain('<prosody'); // Should keep prosody
      expect(processed).not.toContain('<emphasis'); // Should remove emphasis
    });

    it("should strip complex SSML for non-SSML engines", () => {
      const processed = SSMLUtils.processSSMLForEngine(complexSSML, 'openai');
      expect(processed).not.toContain('<speak');
      expect(processed).not.toContain('<prosody');
      expect(processed).not.toContain('<emphasis');
      expect(processed).not.toContain('<voice');
      expect(processed).toContain('This text will be spoken slowly');
      expect(processed).toContain('This text is emphasized');
      expect(processed).toContain('This is in a different voice');
    });
  });
});
