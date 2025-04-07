(function (factory) {
	typeof define === 'function' && define.amd ? define(factory) :
	factory();
})((function () { 'use strict';

	Object.defineProperty(exports, "__esModule", { value: true });
	exports.AzureTTSClient = exports.SpeechMarkdownConverter = exports.SSMLBuilder = exports.AudioPlayback = exports.VoiceUtils = exports.SSMLUtils = exports.AbstractTTSClient = void 0;
	// Core exports
	var abstract_tts_1 = require("./core/abstract-tts");
	Object.defineProperty(exports, "AbstractTTSClient", { enumerable: true, get: function () { return abstract_tts_1.AbstractTTSClient; } });
	var ssml_utils_1 = require("./core/ssml-utils");
	Object.defineProperty(exports, "SSMLUtils", { enumerable: true, get: function () { return ssml_utils_1.SSMLUtils; } });
	var voice_utils_1 = require("./core/voice-utils");
	Object.defineProperty(exports, "VoiceUtils", { enumerable: true, get: function () { return voice_utils_1.VoiceUtils; } });
	var playback_1 = require("./core/playback");
	Object.defineProperty(exports, "AudioPlayback", { enumerable: true, get: function () { return playback_1.AudioPlayback; } });
	// SSML exports
	var builder_1 = require("./ssml/builder");
	Object.defineProperty(exports, "SSMLBuilder", { enumerable: true, get: function () { return builder_1.SSMLBuilder; } });
	// Markdown exports
	var converter_1 = require("./markdown/converter");
	Object.defineProperty(exports, "SpeechMarkdownConverter", { enumerable: true, get: function () { return converter_1.SpeechMarkdownConverter; } });
	// Engine exports
	var azure_1 = require("./engines/azure");
	Object.defineProperty(exports, "AzureTTSClient", { enumerable: true, get: function () { return azure_1.AzureTTSClient; } });

}));
