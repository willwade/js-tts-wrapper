import { SpeechMarkdown } from 'speechmarkdown-js';

/**
 * SSML Builder class for creating SSML markup
 */
class SSMLBuilder {
    constructor() {
        Object.defineProperty(this, "ssml", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ""
        });
    }
    /**
     * Add text or SSML to the builder
     * @param text Text or SSML to add
     * @returns The SSML string
     */
    add(text) {
        // If text doesn't start with <speak>, wrap it
        if (text.trim().startsWith("<speak")) {
            this.ssml = text;
        }
        else {
            this.ssml = `<speak>${text}</speak>`;
        }
        return this.ssml;
    }
    /**
     * Add a break to the SSML
     * @param time Break duration (e.g., '500ms')
     * @returns The SSML builder instance
     */
    addBreak(time = "500ms") {
        this.ssml = this.ssml.replace("</speak>", `<break time="${time}"/></speak>`);
        return this;
    }
    /**
     * Add prosody element to the SSML
     * @param text Text to wrap with prosody
     * @param rate Speech rate
     * @param pitch Speech pitch
     * @param volume Speech volume
     * @returns The SSML builder instance
     */
    addProsody(text, rate, pitch, volume) {
        let prosodyAttrs = "";
        if (rate)
            prosodyAttrs += ` rate="${rate}"`;
        if (pitch)
            prosodyAttrs += ` pitch="${pitch}"`;
        if (volume)
            prosodyAttrs += ` volume="${volume}"`;
        const prosodyElement = `<prosody${prosodyAttrs}>${text}</prosody>`;
        if (this.ssml.includes("<speak>")) {
            this.ssml = this.ssml.replace("<speak>", `<speak>${prosodyElement}`);
        }
        else {
            this.ssml = `<speak>${prosodyElement}</speak>`;
        }
        return this;
    }
    /**
     * Wrap text with speak tags
     * @param text Text to wrap
     * @returns SSML string with speak tags
     */
    wrapWithSpeak(text) {
        if (!text.trim().startsWith("<speak")) {
            return `<speak>${text}</speak>`;
        }
        return text;
    }
    /**
     * Clear the SSML content
     */
    clearSSML() {
        this.ssml = "";
    }
    /**
     * Get the current SSML string
     * @returns The current SSML string
     */
    toString() {
        return this.ssml;
    }
}

/**
 * Check if text is SSML
 * @param text Text to check
 * @returns True if the text is SSML
 */
function isSSML(text) {
    return text.trim().startsWith("<speak") && text.trim().endsWith("</speak>");
}
/**
 * Strip SSML tags from text
 * @param ssml SSML text
 * @returns Plain text without SSML tags
 */
function stripSSML(ssml) {
    // Simple implementation - for production, consider using a proper XML parser
    return ssml
        .replace(/<speak.*?>/g, "")
        .replace(/<\/speak>/g, "")
        .replace(/<break.*?\/>/g, " ")
        .replace(/<emphasis.*?>(.*?)<\/emphasis>/g, "$1")
        .replace(/<prosody.*?>(.*?)<\/prosody>/g, "$1")
        .replace(/<voice.*?>(.*?)<\/voice>/g, "$1")
        .replace(/<say-as.*?>(.*?)<\/say-as>/g, "$1")
        .replace(/<phoneme.*?>(.*?)<\/phoneme>/g, "$1")
        .replace(/<sub.*?>(.*?)<\/sub>/g, "$1")
        .replace(/<p>(.*?)<\/p>/g, "$1 ")
        .replace(/<s>(.*?)<\/s>/g, "$1 ")
        .replace(/\s+/g, " ")
        .trim();
}
/**
 * Create a prosody tag with the given properties
 * @param text Text to wrap with prosody
 * @param options Speak options
 * @returns SSML with prosody tag
 */
function createProsodyTag(text, options) {
    if (!options)
        return text;
    const attrs = [];
    if (options.rate)
        attrs.push(`rate="${options.rate}"`);
    if (options.pitch)
        attrs.push(`pitch="${options.pitch}"`);
    if (options.volume !== undefined)
        attrs.push(`volume="${options.volume}%"`);
    if (attrs.length === 0)
        return text;
    return `<prosody ${attrs.join(" ")}>${text}</prosody>`;
}
/**
 * Wrap text with speak tags if not already present
 * @param text Text to wrap
 * @returns SSML with speak tags
 */
function wrapWithSpeakTags(text) {
    if (isSSML(text))
        return text;
    return `<speak>${text}</speak>`;
}

var ssmlUtils = /*#__PURE__*/Object.freeze({
    __proto__: null,
    createProsodyTag: createProsodyTag,
    isSSML: isSSML,
    stripSSML: stripSSML,
    wrapWithSpeakTags: wrapWithSpeakTags
});

/**
 * Abstract base class for all TTS clients
 * This provides a unified interface for all TTS providers
 */
class AbstractTTSClient {
    /**
     * Creates a new TTS client
     * @param credentials Provider-specific credentials
     */
    constructor(credentials) {
        Object.defineProperty(this, "credentials", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: credentials
        });
        /**
         * Currently selected voice ID
         */
        Object.defineProperty(this, "voiceId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        /**
         * Currently selected language
         */
        Object.defineProperty(this, "lang", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "en-US"
        });
        /**
         * Event callbacks
         */
        Object.defineProperty(this, "callbacks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        /**
         * SSML builder instance
         */
        Object.defineProperty(this, "ssml", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * Audio playback properties
         */
        Object.defineProperty(this, "audio", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * TTS properties (rate, pitch, volume)
         */
        Object.defineProperty(this, "properties", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                volume: 100,
                rate: "medium",
                pitch: "medium",
            }
        });
        /**
         * Word timings for the current audio
         */
        Object.defineProperty(this, "timings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        /**
         * Audio sample rate
         */
        Object.defineProperty(this, "audioRate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 24000
        });
        this.ssml = new SSMLBuilder();
        this.audio = {
            isPlaying: false,
            isPaused: false,
            audioElement: null,
            position: 0,
            duration: 0,
        };
    }
    /**
     * Get available voices from the provider with normalized language codes
     * @returns Promise resolving to an array of unified voice objects
     */
    async getVoices() {
        // Get raw voices from the engine-specific implementation
        const rawVoices = await this._getVoices();
        // Process and normalize the voices
        // In a full implementation, we would normalize language codes here
        // similar to the Python version's language_utils.LanguageNormalizer
        return rawVoices;
    }
    // --- Optional overrides ---
    /**
     * Speak text using the default audio output
     * @param text Text or SSML to speak
     * @param options Synthesis options
     * @returns Promise resolving when audio playback starts
     */
    async speak(text, options) {
        // Trigger onStart callback
        this.emit("start");
        // Convert text to audio bytes
        const audioBytes = await this.synthToBytes(text, options);
        // Create audio blob and URL
        const blob = new Blob([audioBytes], { type: "audio/wav" }); // default to WAV
        const url = URL.createObjectURL(blob);
        // Create and play audio element
        const audio = new Audio(url);
        this.audio.audioElement = audio;
        this.audio.isPlaying = true;
        this.audio.isPaused = false;
        // Set up event handlers
        audio.onended = () => {
            this.emit("end");
            this.audio.isPlaying = false;
            URL.revokeObjectURL(url); // Clean up the URL
        };
        // Create estimated word timings if needed
        this._createEstimatedWordTimings(text);
        // Play the audio
        await audio.play();
    }
    /**
     * Speak text using streaming synthesis
     * @param text Text or SSML to speak
     * @param options Synthesis options
     * @returns Promise resolving when audio playback starts
     */
    async speakStreamed(text, options) {
        // Trigger onStart callback
        this.emit("start");
        try {
            // Get streaming audio data
            const stream = await this.synthToBytestream(text, options);
            const reader = stream.getReader();
            const chunks = [];
            // Read all chunks from the stream
            let result = await reader.read();
            while (!result.done) {
                chunks.push(result.value);
                result = await reader.read();
            }
            // Combine chunks into a single audio buffer
            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const audioBytes = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                audioBytes.set(chunk, offset);
                offset += chunk.length;
            }
            // Create estimated word timings
            this._createEstimatedWordTimings(text);
            // Play the audio
            const blob = new Blob([audioBytes], { type: "audio/wav" });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            this.audio.audioElement = audio;
            this.audio.isPlaying = true;
            this.audio.isPaused = false;
            audio.onended = () => {
                this.emit("end");
                this.audio.isPlaying = false;
                URL.revokeObjectURL(url);
            };
            await audio.play();
        }
        catch (error) {
            console.error("Error in streaming synthesis:", error);
            this.emit("end"); // Ensure end event is triggered even on error
            throw error;
        }
    }
    /**
     * Synthesize text to audio and save it to a file (browser download)
     * @param text Text or SSML to synthesize
     * @param filename Filename to save as
     * @param format Audio format (mp3 or wav)
     * @param options Synthesis options
     */
    async synthToFile(text, filename, format = "wav", options) {
        // Convert text to audio bytes
        const audioBytes = await this.synthToBytes(text, options);
        // Create blob with appropriate MIME type
        const mimeType = format === "mp3" ? "audio/mpeg" : "audio/wav";
        const blob = new Blob([audioBytes], { type: mimeType });
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename.endsWith(`.${format}`) ? filename : `${filename}.${format}`;
        // Trigger download
        document.body.appendChild(a);
        a.click();
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
    /**
     * Set the voice to use for synthesis
     * @param voiceId Voice ID to use
     * @param lang Language code (optional)
     */
    setVoice(voiceId, lang) {
        this.voiceId = voiceId;
        if (lang) {
            this.lang = lang;
        }
    }
    // --- Playback control methods ---
    /**
     * Pause audio playback
     */
    pause() {
        if (this.audio.audioElement && this.audio.isPlaying && !this.audio.isPaused) {
            this.audio.audioElement.pause();
            this.audio.isPaused = true;
        }
    }
    /**
     * Resume audio playback
     */
    resume() {
        if (this.audio.audioElement && this.audio.isPlaying && this.audio.isPaused) {
            this.audio.audioElement.play();
            this.audio.isPaused = false;
        }
    }
    /**
     * Stop audio playback
     */
    stop() {
        if (this.audio.audioElement) {
            this.audio.audioElement.pause();
            this.audio.audioElement.currentTime = 0;
            this.audio.isPlaying = false;
            this.audio.isPaused = false;
        }
    }
    /**
     * Create estimated word timings for non-streaming engines
     * @param text Text to create timings for
     */
    _createEstimatedWordTimings(text) {
        // Extract plain text from SSML if needed
        const plainText = this._isSSML(text) ? this._stripSSML(text) : text;
        // Split into words
        const words = plainText.split(/\s+/).filter((word) => word.length > 0);
        if (!words.length)
            return;
        // Estimate duration (assuming average speaking rate)
        const estimatedDuration = words.length * 0.3; // ~300ms per word
        const wordDuration = estimatedDuration / words.length;
        // Create evenly-spaced word timings
        this.timings = [];
        for (let i = 0; i < words.length; i++) {
            const startTime = i * wordDuration;
            const endTime = (i + 1) * wordDuration;
            this.timings.push([startTime, endTime, words[i]]);
        }
    }
    /**
     * Check if text is SSML
     * @param text Text to check
     * @returns True if text is SSML
     */
    _isSSML(text) {
        return isSSML(text);
    }
    /**
     * Strip SSML tags from text
     * @param ssml SSML text
     * @returns Plain text without SSML tags
     */
    _stripSSML(ssml) {
        return stripSSML(ssml);
    }
    // --- Event system ---
    /**
     * Register a callback for an event
     * @param event Event type
     * @param fn Callback function
     */
    on(event, fn) {
        this.callbacks[event] = this.callbacks[event] || [];
        this.callbacks[event].push(fn);
    }
    /**
     * Emit an event to all registered callbacks
     * @param event Event type
     * @param args Event arguments
     */
    emit(event, ...args) {
        for (const fn of this.callbacks[event] || []) {
            fn(...args);
        }
    }
    /**
     * Start playback with word boundary callbacks
     * @param text Text or SSML to speak
     * @param callback Callback function for word boundaries
     * @param options Synthesis options
     */
    async startPlaybackWithCallbacks(text, callback, options) {
        // Speak the text
        await this.speak(text, options);
        // Use the timings to schedule callbacks
        for (const [start, end, word] of this.timings) {
            setTimeout(() => {
                callback(word, start, end);
            }, start * 1000);
        }
    }
    /**
     * Connect a callback to an event
     * @param event Event name
     * @param callback Callback function
     */
    connect(event, callback) {
        if (event === "onStart") {
            this.on("start", callback);
        }
        else if (event === "onEnd") {
            this.on("end", callback);
        }
    }
    /**
     * Get the value of a property
     * @param propertyName Property name
     * @returns Property value
     */
    getProperty(propertyName) {
        return this.properties[propertyName];
    }
    /**
     * Set a property value
     * @param propertyName Property name
     * @param value Property value
     */
    setProperty(propertyName, value) {
        this.properties[propertyName] = value;
    }
    /**
     * Create a prosody tag with the current properties
     * @param text Text to wrap with prosody
     * @returns Text with prosody tag
     */
    constructProsodyTag(text) {
        const attrs = [];
        if (this.properties.rate) {
            attrs.push(`rate="${this.properties.rate}"`);
        }
        if (this.properties.pitch) {
            attrs.push(`pitch="${this.properties.pitch}"`);
        }
        if (this.properties.volume) {
            attrs.push(`volume="${this.properties.volume}%"`);
        }
        if (attrs.length === 0) {
            return text;
        }
        return `<prosody ${attrs.join(" ")}>${text}</prosody>`;
    }
    /**
     * Check if credentials are valid
     * @returns Promise resolving to true if credentials are valid
     */
    async checkCredentials() {
        try {
            const voices = await this._getVoices();
            return voices.length > 0;
        }
        catch (error) {
            console.error("Error checking credentials:", error);
            return false;
        }
    }
}

/**
 * Filter voices by language code
 * @param voices Array of voices to filter
 * @param languageCode BCP-47 language code to filter by
 * @returns Filtered array of voices
 */
function filterByLanguage(voices, languageCode) {
    return voices.filter((voice) => voice.languageCodes.some((lang) => lang.bcp47.toLowerCase() === languageCode.toLowerCase()));
}
/**
 * Filter voices by gender
 * @param voices Array of voices to filter
 * @param gender Gender to filter by
 * @returns Filtered array of voices
 */
function filterByGender(voices, gender) {
    return voices.filter((voice) => voice.gender === gender);
}
/**
 * Filter voices by provider
 * @param voices Array of voices to filter
 * @param provider Provider to filter by
 * @returns Filtered array of voices
 */
function filterByProvider(voices, provider) {
    return voices.filter((voice) => voice.provider === provider);
}
/**
 * Find a voice by ID
 * @param voices Array of voices to search
 * @param id Voice ID to find
 * @returns The found voice or undefined
 */
function findById(voices, id) {
    return voices.find((voice) => voice.id === id);
}
/**
 * Get all available languages from a list of voices
 * @param voices Array of voices
 * @returns Array of unique language codes
 */
function getAvailableLanguages(voices) {
    // Use a Set to collect unique language codes
    const languages = new Set();
    // Iterate through all voices and their language codes
    for (const voice of voices) {
        for (const lang of voice.languageCodes) {
            languages.add(lang.bcp47);
        }
    }
    // Convert Set to Array and return
    return Array.from(languages);
}

var voiceUtils = /*#__PURE__*/Object.freeze({
    __proto__: null,
    filterByGender: filterByGender,
    filterByLanguage: filterByLanguage,
    filterByProvider: filterByProvider,
    findById: findById,
    getAvailableLanguages: getAvailableLanguages
});

/**
 * Utility class for audio playback
 */
class AudioPlayback {
    constructor() {
        Object.defineProperty(this, "audioElement", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    /**
     * Play audio from a URL
     * @param url URL of the audio to play
     * @param onStart Callback when playback starts
     * @param onEnd Callback when playback ends
     * @returns Promise that resolves when playback starts
     */
    play(url, onStart, onEnd) {
        return new Promise((resolve) => {
            this.stop();
            this.audioElement = new Audio(url);
            this.audioElement.onplay = () => {
                if (onStart)
                    onStart();
                resolve();
            };
            this.audioElement.onended = () => {
                if (onEnd)
                    onEnd();
            };
            this.audioElement.play();
        });
    }
    /**
     * Play audio from a Blob
     * @param blob Audio blob
     * @param onStart Callback when playback starts
     * @param onEnd Callback when playback ends
     * @returns Promise that resolves when playback starts
     */
    playFromBlob(blob, onStart, onEnd) {
        const url = URL.createObjectURL(blob);
        return this.play(url, onStart, onEnd).then(() => {
            // Clean up the URL when playback ends
            if (this.audioElement) {
                this.audioElement.onended = () => {
                    if (onEnd)
                        onEnd();
                    URL.revokeObjectURL(url);
                };
            }
        });
    }
    /**
     * Pause audio playback
     */
    pause() {
        if (this.audioElement) {
            this.audioElement.pause();
        }
    }
    /**
     * Resume audio playback
     */
    resume() {
        if (this.audioElement) {
            this.audioElement.play();
        }
    }
    /**
     * Stop audio playback
     */
    stop() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            this.audioElement = null;
        }
    }
}

/**
 * Speech Markdown converter using the official speechmarkdown-js library
 *
 * This module provides functions to convert Speech Markdown to SSML
 * using the speechmarkdown-js library (https://github.com/speechmarkdown/speechmarkdown-js)
 */
// Create a SpeechMarkdown instance with default options
const speechMarkdownInstance = new SpeechMarkdown();
/**
 * Convert Speech Markdown to SSML
 *
 * This function uses the speechmarkdown-js library to convert Speech Markdown syntax to SSML.
 * The library supports various Speech Markdown features including:
 * - Breaks: [500ms] or [break:"500ms"]
 * - Emphasis: *emphasized text*
 * - Rate, pitch, volume: (rate:slow), (pitch:high), (volume:loud)
 * - And many more (see the speechmarkdown-js documentation)
 *
 * @param markdown Speech Markdown text
 * @param platform Target platform (amazon-alexa, google-assistant, microsoft-azure, etc.)
 * @returns SSML text
 */
function toSSML(markdown, platform = 'amazon-alexa') {
    return speechMarkdownInstance.toSSML(markdown, { platform });
}
/**
 * Check if text is Speech Markdown
 *
 * This function checks if the text contains Speech Markdown syntax patterns.
 * It uses regular expressions to detect common Speech Markdown patterns such as:
 * - Breaks: [500ms] or [break:"500ms"]
 * - Emphasis: *emphasized text*
 * - Rate, pitch, volume: (rate:slow), (pitch:high), (volume:loud)
 *
 * @param text Text to check
 * @returns True if the text contains Speech Markdown syntax
 */
function isSpeechMarkdown(text) {
    // Use a simple heuristic to check for common Speech Markdown patterns
    // This is a simplified version as the library doesn't provide a direct way to check
    const patterns = [
        /\[\d+m?s\]/, // Breaks
        /\[break:"\d+m?s"\]/, // Breaks with quotes
        /\*.*?\*/, // Emphasis (short format)
        /\(emphasis:(strong|moderate|reduced|none)\)/, // Emphasis
        /\(rate:(x-slow|slow|medium|fast|x-fast)\)/, // Rate
        /\(pitch:(x-low|low|medium|high|x-high)\)/, // Pitch
        /\(volume:(silent|x-soft|soft|medium|loud|x-loud)\)/, // Volume
        /\(voice:(\w+)\)/, // Voice
        /\(lang:(\w+(-\w+)?)\)/, // Language
        /\(\w+:.*?\)/, // Any other Speech Markdown directive
    ];
    return patterns.some((pattern) => pattern.test(text));
}
/**
 * Get the available platforms supported by the Speech Markdown library
 *
 * This function returns the list of platforms supported by the speechmarkdown-js library.
 * These platforms have different SSML dialects, and the library will generate
 * SSML appropriate for the specified platform.
 *
 * @returns Array of platform names (amazon-alexa, google-assistant, microsoft-azure)
 */
function getAvailablePlatforms() {
    // The library doesn't expose a direct way to get platforms, so we hardcode them
    // These are the platforms supported by speechmarkdown-js as of version 1.x
    return ['amazon-alexa', 'google-assistant', 'microsoft-azure'];
}

var converter = /*#__PURE__*/Object.freeze({
    __proto__: null,
    getAvailablePlatforms: getAvailablePlatforms,
    isSpeechMarkdown: isSpeechMarkdown,
    toSSML: toSSML
});

/**
 * Azure TTS Client
 */
class AzureTTSClient extends AbstractTTSClient {
    /**
     * Create a new Azure TTS client
     * @param credentials Azure credentials object with subscriptionKey and region
     */
    constructor(credentials) {
        super(credentials);
        Object.defineProperty(this, "subscriptionKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "region", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.subscriptionKey = credentials.subscriptionKey;
        this.region = credentials.region;
    }
    /**
     * Get raw voices from Azure
     * @returns Promise resolving to an array of unified voice objects
     */
    async _getVoices() {
        try {
            const response = await fetch(`https://${this.region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
                method: "GET",
                headers: {
                    "Ocp-Apim-Subscription-Key": this.subscriptionKey,
                },
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch voices: ${response.statusText}`);
            }
            const voices = await response.json();
            // Transform Azure voices to unified format
            return voices.map((voice) => ({
                id: voice.ShortName,
                name: voice.DisplayName,
                gender: voice.Gender === "Female" ? "Female" : voice.Gender === "Male" ? "Male" : "Unknown",
                provider: "azure",
                languageCodes: [
                    {
                        bcp47: voice.Locale,
                        iso639_3: this.bcp47ToIso639_3(voice.Locale),
                        display: voice.LocaleName,
                    },
                ],
            }));
        }
        catch (error) {
            console.error("Error fetching Azure voices:", error);
            return [];
        }
    }
    /**
     * Synthesize text to audio bytes
     * @param text Text or SSML to synthesize
     * @param options Synthesis options
     * @returns Promise resolving to audio bytes
     */
    async synthToBytes(text, options) {
        const ssml = this.prepareSSML(text, options);
        try {
            const response = await fetch(`https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
                method: "POST",
                headers: {
                    "Ocp-Apim-Subscription-Key": this.subscriptionKey,
                    "Content-Type": "application/ssml+xml",
                    "X-Microsoft-OutputFormat": options?.format === "mp3"
                        ? "audio-24khz-96kbitrate-mono-mp3"
                        : "riff-24khz-16bit-mono-pcm",
                    "User-Agent": "js-tts-wrapper",
                },
                body: ssml,
            });
            if (!response.ok) {
                throw new Error(`Failed to synthesize speech: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return new Uint8Array(arrayBuffer);
        }
        catch (error) {
            console.error("Error synthesizing speech:", error);
            throw error;
        }
    }
    /**
     * Synthesize text to a byte stream
     * @param text Text or SSML to synthesize
     * @param options Synthesis options
     * @returns Promise resolving to a readable stream of audio bytes
     */
    async synthToBytestream(text, options) {
        const ssml = this.prepareSSML(text, options);
        try {
            const response = await fetch(`https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
                method: "POST",
                headers: {
                    "Ocp-Apim-Subscription-Key": this.subscriptionKey,
                    "Content-Type": "application/ssml+xml",
                    "X-Microsoft-OutputFormat": options?.format === "mp3"
                        ? "audio-24khz-96kbitrate-mono-mp3"
                        : "riff-24khz-16bit-mono-pcm",
                    "User-Agent": "js-tts-wrapper",
                },
                body: ssml,
            });
            if (!response.ok) {
                throw new Error(`Failed to synthesize speech: ${response.statusText}`);
            }
            // Return the response body as a stream
            return response.body;
        }
        catch (error) {
            console.error("Error synthesizing speech stream:", error);
            throw error;
        }
    }
    /**
     * Start playback with word boundary callbacks
     * @param text Text or SSML to speak
     * @param callback Callback function for word boundaries
     * @param options Synthesis options
     */
    async startPlaybackWithCallbacks(text, callback, options) {
        // This is a simplified implementation
        // A full implementation would use the Azure Speech SDK to get word boundary events
        await super.startPlaybackWithCallbacks(text, callback, options);
    }
    /**
     * Prepare SSML for synthesis
     * @param text Text or SSML to prepare
     * @param options Synthesis options
     * @returns SSML ready for synthesis
     */
    prepareSSML(text, options) {
        // Convert from Speech Markdown if requested
        if (options?.useSpeechMarkdown && isSpeechMarkdown(text)) {
            text = toSSML(text, 'microsoft-azure');
        }
        // Ensure text is wrapped in SSML
        let ssml = isSSML(text) ? text : wrapWithSpeakTags(text);
        // Add voice selection if a voice is set
        if (this.voiceId) {
            // Insert voice tag after <speak> tag
            ssml = ssml.replace("<speak", `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${this.lang}"`);
            // Insert voice tag before the content
            ssml = ssml.replace(">", `><voice name="${this.voiceId}">`);
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
            }
            else {
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
            const attrs = [];
            if (options.rate)
                attrs.push(`rate="${options.rate}"`);
            if (options.pitch)
                attrs.push(`pitch="${options.pitch}"`);
            if (options.volume !== undefined)
                attrs.push(`volume="${options.volume}%"`);
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
    /**
     * Convert BCP-47 language code to ISO 639-3
     * @param bcp47 BCP-47 language code
     * @returns ISO 639-3 language code
     */
    bcp47ToIso639_3(bcp47) {
        // This is a simplified mapping
        // A full implementation would use a complete mapping table
        const map = {
            en: "eng",
            fr: "fra",
            es: "spa",
            de: "deu",
            it: "ita",
            ja: "jpn",
            ko: "kor",
            pt: "por",
            ru: "rus",
            zh: "zho",
        };
        const lang = bcp47.split("-")[0].toLowerCase();
        return map[lang] || "und"; // 'und' for undefined
    }
}

export { AbstractTTSClient, AudioPlayback, AzureTTSClient, SSMLBuilder, ssmlUtils as SSMLUtils, converter as SpeechMarkdown, voiceUtils as VoiceUtils };
