/**
 * SSML Compatibility Layer
 * 
 * This module provides cross-engine SSML compatibility by:
 * 1. Validating SSML structure
 * 2. Converting SSML to engine-specific formats
 * 3. Providing fallbacks for unsupported features
 * 4. Ensuring proper SSML nesting and structure
 */

export interface SSMLCapabilities {
  supportsSSML: boolean;
  supportLevel: 'full' | 'limited' | 'none';
  supportedTags: string[];
  unsupportedTags: string[];
  requiresNamespace: boolean;
  requiresVersion: boolean;
  maxNestingDepth?: number;
}

export interface SSMLValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  processedSSML?: string;
}

/**
 * SSML capabilities for different TTS engines
 */
export const ENGINE_SSML_CAPABILITIES: Record<string, SSMLCapabilities> = {
  // Full SSML Support
  sapi: {
    supportsSSML: true,
    supportLevel: 'full',
    supportedTags: ['speak', 'prosody', 'break', 'emphasis', 'voice', 'phoneme', 'say-as', 'sub', 'p', 's'],
    unsupportedTags: [],
    requiresNamespace: false,
    requiresVersion: true,
  },
  witai: {
    supportsSSML: true,
    supportLevel: 'full',
    supportedTags: ['speak', 'prosody', 'break', 'emphasis', 'voice', 'phoneme', 'say-as', 'sub', 'p', 's'],
    unsupportedTags: [],
    requiresNamespace: false,
    requiresVersion: false,
  },
  watson: {
    supportsSSML: true,
    supportLevel: 'full',
    supportedTags: ['speak', 'prosody', 'break', 'emphasis', 'voice', 'phoneme', 'say-as', 'sub', 'p', 's'],
    unsupportedTags: [],
    requiresNamespace: false,
    requiresVersion: false,
  },
  
  // Partial SSML Support
  azure: {
    supportsSSML: true,
    supportLevel: 'full',
    supportedTags: ['speak', 'prosody', 'break', 'emphasis', 'voice', 'phoneme', 'say-as', 'sub', 'p', 's', 'mstts:express-as'],
    unsupportedTags: [],
    requiresNamespace: true,
    requiresVersion: true,
  },
  polly: {
    supportsSSML: true,
    supportLevel: 'limited', // Depends on voice engine type
    supportedTags: ['speak', 'prosody', 'break', 'voice', 'phoneme', 'say-as', 'sub', 'p', 's', 'mark', 'lang'],
    unsupportedTags: [], // Depends on voice engine type
    requiresNamespace: true,
    requiresVersion: false,
  },
  google: {
    supportsSSML: true,
    supportLevel: 'limited', // Depends on voice type
    supportedTags: ['speak', 'prosody', 'break', 'emphasis', 'voice', 'phoneme', 'say-as', 'sub', 'p', 's', 'mark', 'lang', 'audio'],
    unsupportedTags: [], // Depends on voice type
    requiresNamespace: false,
    requiresVersion: false,
  },
  
  // No SSML Support
  elevenlabs: {
    supportsSSML: false,
    supportLevel: 'none',
    supportedTags: [],
    unsupportedTags: ['*'],
    requiresNamespace: false,
    requiresVersion: false,
  },
  openai: {
    supportsSSML: false,
    supportLevel: 'none',
    supportedTags: [],
    unsupportedTags: ['*'],
    requiresNamespace: false,
    requiresVersion: false,
  },
  playht: {
    supportsSSML: false,
    supportLevel: 'none',
    supportedTags: [],
    unsupportedTags: ['*'],
    requiresNamespace: false,
    requiresVersion: false,
  },
  sherpaonnx: {
    supportsSSML: false,
    supportLevel: 'none',
    supportedTags: [],
    unsupportedTags: ['*'],
    requiresNamespace: false,
    requiresVersion: false,
  },
  'sherpaonnx-wasm': {
    supportsSSML: false,
    supportLevel: 'none',
    supportedTags: [],
    unsupportedTags: ['*'],
    requiresNamespace: false,
    requiresVersion: false,
  },
  espeak: {
    supportsSSML: true,
    supportLevel: 'limited',
    supportedTags: ['speak', 'prosody', 'break', 'emphasis', 'p', 's'],
    unsupportedTags: ['voice', 'phoneme', 'say-as', 'sub'],
    requiresNamespace: false,
    requiresVersion: false,
  },
  'espeak-wasm': {
    supportsSSML: true,
    supportLevel: 'limited',
    supportedTags: ['speak', 'prosody', 'break', 'emphasis', 'p', 's'],
    unsupportedTags: ['voice', 'phoneme', 'say-as', 'sub'],
    requiresNamespace: false,
    requiresVersion: false,
  },
};

/**
 * Voice-specific SSML capabilities for engines with dynamic support
 */
export const VOICE_SPECIFIC_CAPABILITIES = {
  // Amazon Polly voice engine types
  polly: {
    standard: {
      supportLevel: 'full' as const,
      unsupportedTags: [],
    },
    'long-form': {
      supportLevel: 'full' as const,
      unsupportedTags: [],
    },
    neural: {
      supportLevel: 'limited' as const,
      unsupportedTags: ['emphasis', 'amazon:auto-breaths', 'amazon:effect'],
    },
    generative: {
      supportLevel: 'limited' as const,
      unsupportedTags: ['emphasis', 'amazon:auto-breaths', 'amazon:effect', 'mark'],
    },
  },
  
  // Google Cloud TTS voice types
  google: {
    standard: {
      supportLevel: 'full' as const,
      unsupportedTags: [],
    },
    wavenet: {
      supportLevel: 'full' as const,
      unsupportedTags: [],
    },
    neural2: {
      supportLevel: 'limited' as const,
      unsupportedTags: ['mark'],
    },
    journey: {
      supportLevel: 'none' as const,
      unsupportedTags: ['*'],
    },
    studio: {
      supportLevel: 'none' as const,
      unsupportedTags: ['*'],
    },
  },
};

/**
 * SSML Compatibility Manager
 */
export class SSMLCompatibilityManager {
  /**
   * Get SSML capabilities for a specific engine and voice
   */
  static getCapabilities(engine: string, voiceId?: string): SSMLCapabilities {
    const baseCapabilities = ENGINE_SSML_CAPABILITIES[engine];
    if (!baseCapabilities) {
      // Default to no SSML support for unknown engines
      return {
        supportsSSML: false,
        supportLevel: 'none',
        supportedTags: [],
        unsupportedTags: ['*'],
        requiresNamespace: false,
        requiresVersion: false,
      };
    }

    // For engines with voice-specific capabilities, adjust based on voice
    if (voiceId && VOICE_SPECIFIC_CAPABILITIES[engine as keyof typeof VOICE_SPECIFIC_CAPABILITIES]) {
      const voiceCapabilities = this.getVoiceSpecificCapabilities(engine, voiceId);
      if (voiceCapabilities) {
        return {
          ...baseCapabilities,
          supportLevel: voiceCapabilities.supportLevel,
          unsupportedTags: voiceCapabilities.unsupportedTags,
        };
      }
    }

    return baseCapabilities;
  }

  /**
   * Get voice-specific SSML capabilities
   */
  private static getVoiceSpecificCapabilities(engine: string, voiceId: string) {
    const engineCapabilities = VOICE_SPECIFIC_CAPABILITIES[engine as keyof typeof VOICE_SPECIFIC_CAPABILITIES];
    if (!engineCapabilities) return null;

    // Determine voice type based on voice ID patterns
    const voiceType = this.detectVoiceType(engine, voiceId);
    return engineCapabilities[voiceType as keyof typeof engineCapabilities] || null;
  }

  /**
   * Detect voice type from voice ID
   */
  private static detectVoiceType(engine: string, voiceId: string): string {
    const lowerVoiceId = voiceId.toLowerCase();
    
    switch (engine) {
      case 'polly':
        // Amazon Polly voice engine detection
        if (lowerVoiceId.includes('neural')) return 'neural';
        if (lowerVoiceId.includes('generative')) return 'generative';
        if (lowerVoiceId.includes('long-form')) return 'long-form';
        return 'standard';
        
      case 'google':
        // Google Cloud TTS voice type detection
        if (lowerVoiceId.includes('neural2')) return 'neural2';
        if (lowerVoiceId.includes('journey')) return 'journey';
        if (lowerVoiceId.includes('studio')) return 'studio';
        if (lowerVoiceId.includes('wavenet')) return 'wavenet';
        if (lowerVoiceId.includes('standard')) return 'standard';
        // Default to standard for older voice naming
        return 'standard';
        
      default:
        return 'default';
    }
  }

  /**
   * Validate SSML for a specific engine
   */
  static validateSSML(ssml: string, engine: string, voiceId?: string): SSMLValidationResult {
    const capabilities = this.getCapabilities(engine, voiceId);
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic SSML structure validation
    if (!ssml.trim().startsWith('<speak') || !ssml.trim().endsWith('</speak>')) {
      errors.push('SSML must be wrapped in <speak> tags');
    }

    // Check if engine supports SSML at all
    if (!capabilities.supportsSSML) {
      warnings.push(`Engine '${engine}' does not support SSML. Tags will be stripped.`);
      return {
        isValid: true, // Valid for processing (will be stripped)
        errors,
        warnings,
      };
    }

    // Validate unsupported tags
    if (capabilities.unsupportedTags.includes('*')) {
      warnings.push(`Engine '${engine}' does not support any SSML tags. All tags will be stripped.`);
    } else {
      for (const unsupportedTag of capabilities.unsupportedTags) {
        const tagRegex = new RegExp(`<${unsupportedTag}[^>]*>`, 'gi');
        if (tagRegex.test(ssml)) {
          warnings.push(`Tag '<${unsupportedTag}>' is not supported by engine '${engine}' and will be removed.`);
        }
      }
    }

    // Check for required attributes
    if (capabilities.requiresNamespace && !ssml.includes('xmlns=')) {
      warnings.push(`Engine '${engine}' requires xmlns attribute in <speak> tag.`);
    }

    if (capabilities.requiresVersion && !ssml.includes('version=')) {
      warnings.push(`Engine '${engine}' requires version attribute in <speak> tag.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Process SSML for engine compatibility
   */
  static processSSMLForEngine(ssml: string, engine: string, voiceId?: string): string {
    const capabilities = this.getCapabilities(engine, voiceId);
    
    // If engine doesn't support SSML, strip all tags
    if (!capabilities.supportsSSML) {
      return this.stripAllSSMLTags(ssml);
    }

    let processedSSML = ssml;

    // Remove unsupported tags
    if (capabilities.unsupportedTags.includes('*')) {
      return this.stripAllSSMLTags(ssml);
    } else {
      for (const unsupportedTag of capabilities.unsupportedTags) {
        processedSSML = this.removeSSMLTag(processedSSML, unsupportedTag);
      }
    }

    // Add required attributes
    processedSSML = this.addRequiredAttributes(processedSSML, capabilities);

    return processedSSML;
  }

  /**
   * Strip all SSML tags from text
   */
  private static stripAllSSMLTags(ssml: string): string {
    let result = ssml;

    // Remove all SSML tags while preserving content
    // Use a more comprehensive approach to handle nested tags
    result = result.replace(/<speak[^>]*>/gi, '');
    result = result.replace(/<\/speak>/gi, '');
    result = result.replace(/<break[^>]*\/?>/gi, ' ');

    // Handle nested tags by repeatedly removing them
    let previousResult = '';
    while (result !== previousResult) {
      previousResult = result;
      result = result.replace(/<emphasis[^>]*>(.*?)<\/emphasis>/gis, '$1');
      result = result.replace(/<prosody[^>]*>(.*?)<\/prosody>/gis, '$1');
      result = result.replace(/<voice[^>]*>(.*?)<\/voice>/gis, '$1');
      result = result.replace(/<say-as[^>]*>(.*?)<\/say-as>/gis, '$1');
      result = result.replace(/<phoneme[^>]*>(.*?)<\/phoneme>/gis, '$1');
      result = result.replace(/<sub[^>]*>(.*?)<\/sub>/gis, '$1');
      result = result.replace(/<p[^>]*>(.*?)<\/p>/gis, '$1 ');
      result = result.replace(/<s[^>]*>(.*?)<\/s>/gis, '$1 ');
      result = result.replace(/<lang[^>]*>(.*?)<\/lang>/gis, '$1');
      result = result.replace(/<audio[^>]*>(.*?)<\/audio>/gis, '$1');
      result = result.replace(/<mark[^>]*\/?>/gi, '');

      // Remove any remaining XML-like tags
      result = result.replace(/<[^>]+>/g, '');
    }

    // Clean up whitespace
    result = result.replace(/\s+/g, ' ').trim();

    return result;
  }

  /**
   * Remove specific SSML tag
   */
  private static removeSSMLTag(ssml: string, tagName: string): string {
    // Remove self-closing tags
    const selfClosingRegex = new RegExp(`<${tagName}[^>]*\\/>`, 'gi');
    ssml = ssml.replace(selfClosingRegex, '');
    
    // Remove paired tags, keeping content
    const pairedRegex = new RegExp(`<${tagName}[^>]*>(.*?)<\\/${tagName}>`, 'gi');
    ssml = ssml.replace(pairedRegex, '$1');
    
    return ssml;
  }

  /**
   * Add required attributes to SSML
   */
  private static addRequiredAttributes(ssml: string, capabilities: SSMLCapabilities): string {
    let processedSSML = ssml;

    // Add namespace if required
    if (capabilities.requiresNamespace && !ssml.includes('xmlns=')) {
      processedSSML = processedSSML.replace(
        /<speak([^>]*)>/i,
        '<speak$1 xmlns="http://www.w3.org/2001/10/synthesis">'
      );
    }

    // Add version if required
    if (capabilities.requiresVersion && !ssml.includes('version=')) {
      processedSSML = processedSSML.replace(
        /<speak([^>]*)>/i,
        '<speak version="1.0"$1>'
      );
    }

    return processedSSML;
  }
}
