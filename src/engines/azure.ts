import { AbstractTTSClient } from "../core/abstract-tts";
import * as SSMLUtils from "../core/ssml-utils";
import * as SpeechMarkdown from "../markdown/converter";
import type { SpeakOptions, TTSCredentials, UnifiedVoice, WordBoundaryCallback } from "../types";

// SDK will be loaded dynamically

/**
 * Azure TTS Client Credentials
 */
export interface AzureTTSCredentials extends TTSCredentials {
  subscriptionKey: string;
  region: string;
}

/**
 * Azure TTS Client
 */
export class AzureTTSClient extends AbstractTTSClient {
  private subscriptionKey: string;
  private region: string;
  private sdk: any = null; // Store loaded SDK instance
  private sdkLoadingPromise: Promise<any> | null = null; // Track loading

  /**
   * Create a new Azure TTS client
   * @param credentials Azure credentials object with subscriptionKey and region
   */
  constructor(credentials: AzureTTSCredentials) {
    super(credentials);
    // Type assertion is safe here due to the AzureTTSCredentials interface
    this.subscriptionKey = credentials.subscriptionKey as string;
    this.region = credentials.region as string;
  }

  /**
   * Get raw voices from Azure
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _getVoices(): Promise<any[]> {
    try {
      const response = await fetch(
        `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
        {
          method: "GET",
          headers: {
            "Ocp-Apim-Subscription-Key": this.subscriptionKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching Azure voices:", error);
      return [];
    }
  }

  /**
   * Map Azure voice objects to unified format
   * @param rawVoices Array of Azure voice objects
   * @returns Promise resolving to an array of unified voice objects
   */
  protected async _mapVoicesToUnified(rawVoices: any[]): Promise<UnifiedVoice[]> {
    // Transform Azure voices to unified format
    return rawVoices.map((voice: any) => ({
      id: voice.ShortName,
      name: voice.DisplayName,
      gender: voice.Gender === "Female" ? "Female" : voice.Gender === "Male" ? "Male" : "Unknown",
      provider: "azure",
      languageCodes: [
        {
          bcp47: voice.Locale,
          iso639_3: voice.Locale.split("-")[0], // Simple extraction of language code
          display: voice.LocaleName,
        },
      ],
    }));
  }

  /**
   * Synthesize text to audio bytes
   * @param text Text or SSML to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to audio bytes
   */
  async synthToBytes(text: string, options?: AzureTTSOptions): Promise<Uint8Array> {
    const ssml = this.prepareSSML(text, options);

    try {
      const response = await fetch(
        `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": this.subscriptionKey,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat":
              options?.format === "mp3"
                ? "audio-24khz-96kbitrate-mono-mp3"
                : "riff-24khz-16bit-mono-pcm",
            "User-Agent": "js-tts-wrapper",
          },
          body: ssml,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to synthesize speech: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      console.error("Error synthesizing speech:", error);
      throw error;
    }
  }

  /**
   * Synthesize text to a byte stream with word boundary information
   * @param text Text or SSML to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to an object containing the audio stream and word boundary information
   */
  async synthToBytestream(
    text: string,
    options?: AzureTTSOptions
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    const ssml = this.prepareSSML(text, options);
    const useWordBoundary = options?.useWordBoundary !== false; // Default to true

    // Attempt to load SDK if needed for word boundaries in Node.js
    let sdkInstance: any = null;
    if (useWordBoundary && typeof window === "undefined") { 
      sdkInstance = await this.loadSDK();
    }

    // If the SDK is available and word boundary information is requested, use the SDK
    if (sdkInstance && useWordBoundary) {
      return this.synthToBytestreamWithSDK(ssml, options, sdkInstance);
    }

    // Otherwise, fall back to the REST API (which doesn't provide word boundaries)
    return this.synthToBytestreamWithREST(ssml, options);
  }

  /**
   * Load the Microsoft Speech SDK dynamically.
   * @returns A promise resolving to the SDK module, or null if loading fails or not applicable.
   */
  private async loadSDK(): Promise<any> {
    if (this.sdk) {
      return this.sdk;
    }
    if (this.sdkLoadingPromise) {
      return this.sdkLoadingPromise;
    }

    // Only attempt dynamic import in Node.js environment
    if (typeof window !== "undefined") {
      console.warn("Microsoft Speech SDK dynamic import skipped in browser environment.");
      return null;
    }

    // @ts-ignore - Suppress module not found error for SDK types during build
    this.sdkLoadingPromise = import("microsoft-cognitiveservices-speech-sdk")
      .then(sdkModule => {
        this.sdk = sdkModule; 
        this.sdkLoadingPromise = null; // Reset promise after successful load
        console.log("Microsoft Speech SDK loaded successfully.");
        return this.sdk;
      })
      .catch(_error => {
        // Log the actual error for debugging if needed: console.error("SDK Load Error:", _error);
        console.warn("microsoft-cognitiveservices-speech-sdk not found or failed to load, using REST API fallback for word boundaries.");
        this.sdkLoadingPromise = null; // Reset promise on error
        this.sdk = null; // Ensure SDK is null if loading failed
        return null; // Indicate SDK load failed
      });
    return this.sdkLoadingPromise;
  }

  /**
   * Synthesize speech using the Microsoft Cognitive Services Speech SDK
   * @param ssml SSML to synthesize
   * @param options Synthesis options
   * @param sdkInstance The loaded SDK instance.
   * @returns Promise resolving to an object containing the audio stream and word boundary information
   */
  private async synthToBytestreamWithSDK(
    ssml: string,
    options: AzureTTSOptions | undefined,
    sdkInstance: any
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    try {
      if (!sdkInstance) { // Should not happen if called correctly, but good practice
        throw new Error("Attempted to use SDK method, but SDK instance is missing.");
      }
      // Create a speech config
      const speechConfig = sdkInstance.SpeechConfig.fromSubscription(this.subscriptionKey, this.region);

      // Set the output format
      speechConfig.speechSynthesisOutputFormat = options?.format === "mp3"
        ? sdkInstance.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3
        : sdkInstance.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;

      // Set the voice
      if (this.voiceId) {
        speechConfig.speechSynthesisVoiceName = this.voiceId;
      }

      // Create a synthesizer
      const synthesizer = new sdkInstance.SpeechSynthesizer(speechConfig);

      // Create a promise that will resolve with the audio data and word boundaries
      return new Promise((resolve, reject) => {
        const wordBoundaries: Array<{ text: string; offset: number; duration: number }> = [];
        const audioChunks: Uint8Array[] = [];

        // Set up the word boundary event handler
        synthesizer.wordBoundary = (_s: any, e: any) => {
          wordBoundaries.push({
            text: e.text,
            offset: e.audioOffset / 10000, // Convert to milliseconds
            duration: 0, // Duration is not provided by the SDK
          });
        };

        // Set up the synthesizing event handler to collect audio chunks
        synthesizer.synthesizing = (_s: unknown, e: any) => {
          if (e.result.reason === sdkInstance.ResultReason.SynthesizingAudio) {
            audioChunks.push(new Uint8Array(e.result.audioData));
          }
        };

        // Start the synthesis
        synthesizer.speakSsmlAsync(
          ssml,
          (result: any) => {
            // Synthesis completed
            synthesizer.close();

            if (result.reason === sdkInstance.ResultReason.SynthesizingAudioCompleted) {
              // Add the final audio chunk
              audioChunks.push(new Uint8Array(result.audioData));

              // Create a readable stream from the audio chunks
              const stream = new ReadableStream({
                start(controller) {
                  for (const chunk of audioChunks) {
                    controller.enqueue(chunk);
                  }
                  controller.close();
                },
              });

              // Calculate durations for word boundaries
              if (wordBoundaries.length > 1) {
                for (let i = 0; i < wordBoundaries.length - 1; i++) {
                  wordBoundaries[i].duration =
                    wordBoundaries[i + 1].offset - wordBoundaries[i].offset;
                }
                // Estimate duration for the last word
                if (wordBoundaries.length > 0) {
                  const lastWord = wordBoundaries[wordBoundaries.length - 1];
                  lastWord.duration = 500; // Estimate 500ms for the last word
                }
              }

              resolve({
                audioStream: stream,
                wordBoundaries,
              });
            } else {
              reject(new Error(`Synthesis failed: ${result.errorDetails}`));
            }
          },
          (error: any) => {
            // Synthesis error
            synthesizer.close();
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error("Error synthesizing speech with SDK:", error);
      throw error;
    }
  }

  /**
   * Synthesize speech using the REST API (no word boundaries)
   * @param ssml SSML to synthesize
   * @param options Synthesis options
   * @returns Promise resolving to an object containing the audio stream and an empty word boundary array
   */
  private async synthToBytestreamWithREST(
    ssml: string,
    options?: AzureTTSOptions
  ): Promise<{
    audioStream: ReadableStream<Uint8Array>;
    wordBoundaries: Array<{ text: string; offset: number; duration: number }>;
  }> {
    try {
      // Use the standard endpoint
      const endpoint = `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": this.subscriptionKey,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat":
            options?.format === "mp3"
              ? "audio-24khz-96kbitrate-mono-mp3"
              : "riff-24khz-16bit-mono-pcm",
          "User-Agent": "js-tts-wrapper",
        },
        body: ssml,
      });

      if (!response.ok) {
        throw new Error(`Failed to synthesize speech: ${response.statusText}`);
      }

      // No word boundary information is available with the REST API
      const wordBoundaries: Array<{ text: string; offset: number; duration: number }> = [];

      return {
        audioStream: response.body as ReadableStream<Uint8Array>,
        wordBoundaries,
      };
    } catch (error) {
      console.error("Error synthesizing speech with REST API:", error);
      throw error;
    }
  }

  /**
   * Start playback with word boundary callbacks
   * @param text Text or SSML to speak
   * @param callback Callback function for word boundaries
   * @param options Synthesis options
   */
  async startPlaybackWithCallbacks(
    text: string,
    callback: WordBoundaryCallback,
    options?: AzureTTSOptions
  ): Promise<void> {
    // If the SDK is available, use it for better word boundary support
    if (this.sdk) {
      await this.startPlaybackWithCallbacksSDK(text, callback, options);
    } else {
      // Fall back to the abstract implementation
      // Register the callback
      this.on("boundary", callback);

      // Enable word boundary information
      const enhancedOptions = { ...options, useWordBoundary: true };

      // Start playback with word boundary information
      await this.speakStreamed(text, enhancedOptions);
    }
  }

  /**
   * Start playback with word boundary callbacks using the SDK
   * @param text Text or SSML to speak
   * @param callback Callback function for word boundaries
   * @param options Synthesis options
   */
  private async startPlaybackWithCallbacksSDK(
    text: string,
    callback: WordBoundaryCallback,
    options?: AzureTTSOptions
  ): Promise<void> {
    const ssml = this.prepareSSML(text, options);

    try {
      // Create a speech config
      const speechConfig = this.sdk.SpeechConfig.fromSubscription(this.subscriptionKey, this.region);

      // Set the output format
      speechConfig.speechSynthesisOutputFormat = options?.format === "mp3"
        ? this.sdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3
        : this.sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm;

      // Set the voice
      if (this.voiceId) {
        speechConfig.speechSynthesisVoiceName = this.voiceId;
      }

      // Create an audio config for playback
      const audioConfig = this.sdk.AudioConfig.fromDefaultSpeakerOutput();

      // Create a synthesizer
      const synthesizer = new this.sdk.SpeechSynthesizer(speechConfig, audioConfig);

      // Emit the start event
      this.emit("start");

      // Set up the word boundary event handler
      synthesizer.wordBoundary = (_s: any, e: any) => {
        // Call the callback with the word boundary information
        const offset = e.audioOffset / 10000; // Convert to milliseconds
        const duration = 500; // Estimate 500ms for each word

        // Store the word boundary information for internal use
        this.timings.push([offset, offset + duration, e.text]);

        // Call the callback with the word boundary information
        callback(e.text, offset, offset + duration);
      };

      // Set up the synthesis completed event handler
      synthesizer.synthesisCompleted = (_s: any, _e: any) => {
        // Emit the end event
        this.emit("end");
        // Close the synthesizer
        synthesizer.close();
      };

      // Start the synthesis
      await new Promise<void>((resolve, reject) => {
        synthesizer.speakSsmlAsync(
          ssml,
          () => {
            resolve();
          },
          (error: any) => {
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error("Error starting playback with callbacks:", error);
      throw error;
    }
  }

  /**
   * Prepare SSML for synthesis
   * @param text Text or SSML to prepare
   * @param options Synthesis options
   * @returns SSML ready for synthesis
   */
  private prepareSSML(text: string, options?: AzureTTSOptions): string {
    // Convert from Speech Markdown if requested
    if (options?.useSpeechMarkdown && SpeechMarkdown.isSpeechMarkdown(text)) {
      const ssmlText = SpeechMarkdown.toSSML(text, "microsoft-azure");
      text = ssmlText;
    }

    // Ensure text is wrapped in SSML
    let ssml = SSMLUtils.isSSML(text) ? text : SSMLUtils.wrapWithSpeakTags(text);

    // Use voice from options or the default voice
    const voiceId = options?.voice || this.voiceId;

    // Add voice selection if a voice is set
    if (voiceId) {
      // Insert voice tag after <speak> tag
      ssml = ssml.replace(
        "<speak",
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${this.lang}"`
      );

      // Insert voice tag before the content
      ssml = ssml.replace(">", `><voice name="${voiceId}">`);

      // Close voice tag before </speak>
      ssml = ssml.replace("</speak>", "</voice></speak>");
    }

    // Add prosody if properties are set
    if (this.properties.rate || this.properties.pitch || this.properties.volume) {
      // Extract content between voice tags or speak tags
      let content = "";
      if (ssml.includes("<voice")) {
        const match = ssml.match(/<voice[^>]*>(.*?)<\/voice>/s);
        if (match) {
          content = match[1];
          const prosodyContent = this.constructProsodyTag(content);
          ssml = ssml.replace(content, prosodyContent);
        }
      } else {
        const match = ssml.match(/<speak[^>]*>(.*?)<\/speak>/s);
        if (match) {
          content = match[1];
          const prosodyContent = this.constructProsodyTag(content);
          ssml = ssml.replace(content, prosodyContent);
        }
      }
    }

    // Also add prosody from options if provided
    if (options?.rate || options?.pitch || options?.volume !== undefined) {
      // Create prosody attributes
      const attrs: string[] = [];
      if (options.rate) attrs.push(`rate="${options.rate}"`);
      if (options.pitch) attrs.push(`pitch="${options.pitch}"`);
      if (options.volume !== undefined) attrs.push(`volume="${options.volume}%"`);

      if (attrs.length > 0) {
        // Extract content
        const match = ssml.match(/<speak[^>]*>(.*?)<\/speak>/s);
        if (match) {
          const content = match[1];
          const prosodyContent = `<prosody ${attrs.join(" ")}>${content}</prosody>`;
          ssml = ssml.replace(content, prosodyContent);
        }
      }
    }

    return ssml;
  }
}

/**
 * Extended options for Azure TTS
 */
export interface AzureTTSOptions extends SpeakOptions {
  format?: 'mp3' | 'wav'; // Define formats supported by this client logic
}
