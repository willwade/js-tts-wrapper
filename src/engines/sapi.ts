import { AbstractTTSClient } from "../core/abstract-tts";
import type { SpeakOptions, TTSCredentials, UnifiedVoice } from "../types";
import * as SpeechMarkdown from "../markdown/converter";
import { spawn } from "node:child_process";
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * SAPI TTS Client Credentials
 */
export interface SAPITTSCredentials extends TTSCredentials {
  // SAPI doesn't require credentials, but we keep the interface for consistency
}

/**
 * Voice information from SAPI (matches PowerShell output format)
 */
interface SAPIVoiceInfo {
  Name: string;
  Id: string;
  Gender: "Male" | "Female" | "Unknown";
  Age: "Adult" | "Child" | "Senior" | "Unknown";
  Language: string;
  Culture: string;
  Description: string;
}

/**
 * SAPI TTS Client for Windows environments
 *
 * This client uses Windows Speech API (SAPI) through PowerShell to provide:
 * - High-quality Windows TTS synthesis
 * - SSML support
 * - Rich voice metadata
 * - Word boundary events
 * - Rate, pitch, and volume controls
 */
export class SAPITTSClient extends AbstractTTSClient {
  private static readonly TEMP_PREFIX = "sapi_tts_";

  constructor(credentials: SAPITTSCredentials = {}) {
    super(credentials);

    // Validate Windows environment
    this.validateEnvironment();

    // Set a default voice (will be determined at runtime)
    this.voiceId = null;
  }

  /**
   * Validate that we're running on Windows with PowerShell available
   */
  private validateEnvironment(): void {
    // Check if we're in a Node.js environment
    if (typeof process === "undefined" || !process.versions || !process.versions.node) {
      throw new Error("SAPITTSClient is only supported in Node.js environments");
    }

    // Check if we're on Windows
    if (process.platform !== "win32") {
      throw new Error(
        `SAPITTSClient is only supported on Windows. Current platform: ${process.platform}`
      );
    }
  }

  /**
   * SAPI does not require credentials but we validate the environment
   */
  async checkCredentials(): Promise<boolean> {
    try {
      this.validateEnvironment();
      
      // Test if PowerShell and System.Speech are available
      const testScript = `
        try {
          Add-Type -AssemblyName System.Speech
          $synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
          $voices = $synth.GetInstalledVoices()
          Write-Output "OK"
        } catch {
          Write-Error $_.Exception.Message
          exit 1
        }
      `;

      const result = await this.runPowerShellScript(testScript);
      return result.trim() === "OK";
    } catch (error) {
      console.error("SAPI TTS not available:", error);
      return false;
    }
  }

  /**
   * Get available SAPI voices with rich metadata
   */
  async getVoices(): Promise<UnifiedVoice[]> {
    try {
      const script = `
        Add-Type -AssemblyName System.Speech
        $synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
        $voices = $synth.GetInstalledVoices()
        
        $voiceData = @()
        foreach ($voice in $voices) {
          if ($voice.Enabled) {
            $info = $voice.VoiceInfo
            $voiceObj = @{
              Name = $info.Name
              Id = $info.Id
              Gender = $info.Gender.ToString()
              Age = $info.Age.ToString()
              Culture = $info.Culture.Name
              Language = $info.Culture.DisplayName
              Description = $info.Description
            }
            $voiceData += $voiceObj
          }
        }
        
        $voiceData | ConvertTo-Json -Depth 3
      `;

      const result = await this.runPowerShellScript(script);
      const parsedResult = JSON.parse(result);

      // Ensure we have an array (PowerShell returns single object when there's only one voice)
      const voiceData: SAPIVoiceInfo[] = Array.isArray(parsedResult) ? parsedResult : [parsedResult];

      // Convert to unified voice format
      const unifiedVoices: UnifiedVoice[] = voiceData.map((voice) => ({
        id: voice.Id || voice.Name || "unknown",
        name: voice.Name || "Unknown Voice",
        gender: voice.Gender === "Male" || voice.Gender === "Female" ? voice.Gender : "Unknown",
        provider: "sapi",
        languageCodes: [
          {
            bcp47: voice.Culture || "en-US",
            iso639_3: this.convertCultureToISO639(voice.Culture || "en-US"),
            display: voice.Language || "English (United States)",
          },
        ],
      }));

      return unifiedVoices;
    } catch (error) {
      console.error("Error getting SAPI voices:", error);
      return [];
    }
  }

  /**
   * Get raw voices from SAPI
   */
  protected async _getVoices(): Promise<UnifiedVoice[]> {
    return this.getVoices();
  }

  /**
   * Run a PowerShell script and return the output
   */
  private async runPowerShellScript(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const powershell = spawn("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
      ]);

      let stdout = "";
      let stderr = "";

      powershell.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      powershell.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      powershell.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`PowerShell script failed with code ${code}: ${stderr}`));
        }
      });

      powershell.on("error", (error) => {
        reject(new Error(`Failed to start PowerShell: ${error.message}`));
      });
    });
  }

  /**
   * Convert culture code to ISO 639-3 language code
   */
  private convertCultureToISO639(culture: string): string {
    const cultureMap: Record<string, string> = {
      "en-US": "eng",
      "en-GB": "eng",
      "en-AU": "eng",
      "en-CA": "eng",
      "es-ES": "spa",
      "es-MX": "spa",
      "fr-FR": "fra",
      "fr-CA": "fra",
      "de-DE": "deu",
      "it-IT": "ita",
      "pt-BR": "por",
      "pt-PT": "por",
      "ru-RU": "rus",
      "ja-JP": "jpn",
      "ko-KR": "kor",
      "zh-CN": "cmn",
      "zh-TW": "cmn",
      "ar-SA": "ara",
      "hi-IN": "hin",
      "th-TH": "tha",
      "vi-VN": "vie",
      "nl-NL": "nld",
      "sv-SE": "swe",
      "da-DK": "dan",
      "no-NO": "nor",
      "fi-FI": "fin",
      "pl-PL": "pol",
      "cs-CZ": "ces",
      "hu-HU": "hun",
      "tr-TR": "tur",
      "he-IL": "heb",
    };

    const langCode = culture.split("-")[0];
    return cultureMap[culture] || cultureMap[langCode] || "eng";
  }

  /**
   * Synthesize text to audio bytes using SAPI
   */
  async synthToBytes(text: string, options?: SpeakOptions): Promise<Uint8Array> {
    try {
      // Create a temporary filename for the audio export
      const tempFilename = join(tmpdir(), `${SAPITTSClient.TEMP_PREFIX}${Date.now()}.wav`);

      // Prepare synthesis options
      const voice = options?.voice || this.voiceId || null;
      const rate = this.convertRate(options?.rate);
      const volume = this.convertVolume(options?.volume);

      // Prepare text for synthesis (handle Speech Markdown and SSML)
      let processedText = text;

      // Convert from Speech Markdown if requested
      if (options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(processedText)) {
        const ssmlText = await SpeechMarkdown.toSSML(processedText, "microsoft-azure");
        processedText = ssmlText;
      }

      // Ensure proper SSML format if needed
      processedText = this._isSSML(processedText) ? this.ensureProperSSML(processedText) : processedText;
      const escapedText = this.escapePowerShellString(processedText);
      const isSSMLProcessed = this._isSSML(processedText);

      // Build PowerShell script for synthesis
      const script = `
        Add-Type -AssemblyName System.Speech
        [Console]::InputEncoding = [System.Text.Encoding]::UTF8

        $synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()

        # Set voice if specified
        ${voice ? `
        try {
          $synth.SelectVoice("${this.escapePowerShellString(voice)}")
        } catch {
          # If voice selection fails, continue with default voice
          Write-Warning "Could not select voice '${this.escapePowerShellString(voice)}', using default voice"
        }` : ""}

        # Set speech properties
        $synth.Rate = ${rate}
        $synth.Volume = ${volume}

        # Set output to WAV file
        $synth.SetOutputToWaveFile("${this.escapePowerShellString(tempFilename)}")

        try {
          # Synthesize speech (supports both plain text and SSML)
          ${isSSMLProcessed ? '$synth.SpeakSsml($text)' : '$synth.Speak($text)'}
          Write-Output "SUCCESS"
        } catch {
          Write-Error $_.Exception.Message
          exit 1
        } finally {
          $synth.Dispose()
        }
      `;

      // Execute PowerShell script
      const result = await this.runPowerShellScript(`$text = "${escapedText}"; ${script}`);

      if (!result.includes("SUCCESS")) {
        throw new Error("SAPI synthesis failed");
      }

      // Read the generated WAV file
      if (!existsSync(tempFilename)) {
        throw new Error("SAPI failed to generate audio file");
      }

      const audioBuffer = readFileSync(tempFilename);

      // Clean up the temporary file
      try {
        unlinkSync(tempFilename);
      } catch (cleanupError) {
        console.warn("Could not clean up temporary file:", cleanupError);
      }

      // Create estimated word timings (SAPI doesn't provide real-time events in this mode)
      this._createEstimatedWordTimings(isSSMLProcessed ? this.stripSSML(processedText) : processedText);

      return new Uint8Array(audioBuffer);
    } catch (error) {
      console.error("Error synthesizing speech with SAPI:", error);
      throw error;
    }
  }

  /**
   * Synthesize text to a byte stream with word boundaries
   */
  async synthToBytestream(
    text: string,
    options?: SpeakOptions
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    try {
      // Get the audio bytes first
      const audioBytes = await this.synthToBytes(text, options);

      // For now, use estimated word boundaries
      // TODO: Implement real-time word boundary events using SAPI events
      let processedText = text;

      // Convert from Speech Markdown if requested
      if (options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(processedText)) {
        const ssmlText = await SpeechMarkdown.toSSML(processedText, "microsoft-azure");
        processedText = ssmlText;
      }

      // Ensure proper SSML format if needed
      processedText = this._isSSML(processedText) ? this.ensureProperSSML(processedText) : processedText;
      const plainText = this._isSSML(processedText) ? this.stripSSML(processedText) : processedText;
      const words = plainText.split(/\s+/).filter((word) => word.length > 0);
      const estimatedDuration = 0.3; // Estimated duration per word in seconds
      const wordBoundaries: Array<{ text: string; offset: number; duration: number }> = [];

      let currentTime = 0;
      for (const word of words) {
        if (word.trim()) {
          wordBoundaries.push({
            text: word,
            offset: currentTime * 1000, // Convert to milliseconds
            duration: estimatedDuration * 1000, // Convert to milliseconds
          });
          currentTime += estimatedDuration;
        }
      }

      // Create a readable stream from the audio bytes
      const audioStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(audioBytes);
          controller.close();
        },
      });

      return {
        audioStream,
        wordBoundaries,
      };
    } catch (error) {
      console.error("Error synthesizing speech to stream with SAPI:", error);
      throw error;
    }
  }

  /**
   * Convert rate option to SAPI rate format
   * @param rate Rate option (string or number)
   * @returns Rate value for SAPI (-10 to 10)
   */
  private convertRate(rate?: string | number): number {
    if (!rate) return 0; // Default rate

    if (typeof rate === "string") {
      switch (rate.toLowerCase()) {
        case "x-slow":
          return -8;
        case "slow":
          return -4;
        case "medium":
        case "normal":
          return 0;
        case "fast":
          return 4;
        case "x-fast":
          return 8;
        default:
          // Try to parse as number
          const parsed = Number.parseFloat(rate);
          return Number.isNaN(parsed) ? 0 : Math.max(-10, Math.min(10, parsed));
      }
    }

    if (typeof rate === "number") {
      // Clamp between -10 and 10
      return Math.max(-10, Math.min(10, rate));
    }

    return 0;
  }

  /**
   * Convert volume option to SAPI volume format
   * @param volume Volume option (string or number)
   * @returns Volume value for SAPI (0 to 100)
   */
  private convertVolume(volume?: string | number): number {
    if (!volume) return 100; // Default volume

    if (typeof volume === "string") {
      switch (volume.toLowerCase()) {
        case "silent":
          return 0;
        case "x-soft":
          return 20;
        case "soft":
          return 40;
        case "medium":
        case "normal":
          return 60;
        case "loud":
          return 80;
        case "x-loud":
          return 100;
        default:
          // Try to parse as number
          const parsed = Number.parseFloat(volume);
          return Number.isNaN(parsed) ? 100 : Math.max(0, Math.min(100, parsed));
      }
    }

    if (typeof volume === "number") {
      // Clamp between 0 and 100
      return Math.max(0, Math.min(100, volume));
    }

    return 100;
  }

  /**
   * Escape a string for use in PowerShell
   * @param str String to escape
   * @returns Escaped string
   */
  private escapePowerShellString(str: string): string {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '""')
      .replace(/`/g, "``")
      .replace(/\$/g, "`$");
  }

  /**
   * Strip SSML tags from text (fallback for plain text processing)
   * @param text Text with SSML tags
   * @returns Plain text without SSML tags
   */
  private stripSSML(text: string): string {
    // Simple SSML tag removal - SAPI handles SSML natively, but this is for word timing estimation
    return text.replace(/<[^>]*>/g, "").trim();
  }

  /**
   * Ensure SSML has proper format for SAPI
   * @param text SSML text
   * @returns Properly formatted SSML
   */
  private ensureProperSSML(text: string): string {
    // Check if the SSML already has version attribute
    if (text.includes('version=')) {
      return text;
    }

    // If it's a simple <speak> tag, add the version attribute
    if (text.startsWith('<speak>')) {
      return text.replace('<speak>', '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">');
    }

    // If it doesn't start with <speak>, wrap it properly
    if (!text.startsWith('<speak')) {
      return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">${text}</speak>`;
    }

    return text;
  }
}
