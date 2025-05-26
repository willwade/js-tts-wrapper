/**
 * Node.js audio playback control functions
 * This file re-exports the audio control functions from utils/node-audio.ts
 * to avoid circular dependencies.
 */

import { pauseAudioPlayback, resumeAudioPlayback, stopAudioPlayback } from "../utils/node-audio";

// Re-export the audio control functions
export { pauseAudioPlayback, resumeAudioPlayback, stopAudioPlayback };
