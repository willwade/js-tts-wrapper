import './style.css';
import { SherpaOnnxWasmTTSClient } from 'js-tts-wrapper/browser';
const DEFAULT_WASM_PATH = 'https://cdn.jsdelivr.net/gh/willwade/js-tts-wrapper-assets@main/sherpaonnx/tts/vocoder-models/sherpa-onnx-tts.js';
const DEFAULT_MODELS_URL = 'https://cdn.jsdelivr.net/gh/willwade/js-tts-wrapper-assets@main/sherpaonnx/models/merged_models.json';
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const voiceSelect = document.getElementById('voice-select');
const speakBtn = document.getElementById('speak-btn');
const textInput = document.getElementById('text-input');
const ttsClient = new SherpaOnnxWasmTTSClient({
    wasmPath: DEFAULT_WASM_PATH,
    mergedModelsUrl: DEFAULT_MODELS_URL,
});
let initialized = false;
let currentVoice = null;
const log = (message) => {
    const time = new Date().toLocaleTimeString();
    logEl.textContent = `[${time}] ${message}\n` + logEl.textContent;
};
const setBusy = (busy, label = 'Speak') => {
    speakBtn.disabled = busy;
    speakBtn.textContent = busy ? 'Working…' : label;
};
async function populateVoices() {
    statusEl.value = 'Fetching voices…';
    const voices = await ttsClient.getVoices();
    voiceSelect.innerHTML = '';
    voices.forEach((voice) => {
        const opt = document.createElement('option');
        opt.value = voice.id;
        opt.textContent = `${voice.name} (${voice.languageCodes?.[0]?.display ?? 'Unknown'})`;
        voiceSelect.appendChild(opt);
    });
    if (voices.length === 0) {
        const opt = document.createElement('option');
        opt.value = 'sherpa_en';
        opt.textContent = 'Fallback voice';
        voiceSelect.appendChild(opt);
    }
    voiceSelect.disabled = false;
    currentVoice = voiceSelect.value;
    statusEl.value = `Loaded ${voices.length || 1} voices`;
}
async function ensureVoiceSelected(voiceId) {
    if (currentVoice === voiceId) {
        return;
    }
    log(`Setting voice to ${voiceId}`);
    await ttsClient.setVoice(voiceId);
    currentVoice = voiceId;
}
async function initialise() {
    try {
        statusEl.value = 'Initializing SherpaONNX WASM…';
        log('Initializing WebAssembly runtime');
        await ttsClient.initializeWasm(DEFAULT_WASM_PATH);
        initialized = true;
        statusEl.value = 'WASM ready – loading voices…';
        await populateVoices();
        setBusy(false);
        log('Ready to speak');
    }
    catch (error) {
        console.error(error);
        statusEl.value = 'Initialization failed. See console for details.';
        log(`Initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
speakBtn.addEventListener('click', async () => {
    if (!initialized) {
        await initialise();
        return;
    }
    const text = textInput.value.trim();
    if (!text) {
        log('Please enter some text');
        return;
    }
    try {
        setBusy(true);
        await ensureVoiceSelected(voiceSelect.value);
        statusEl.value = 'Synthesizing…';
        log(`Speaking ${text.length} characters`);
        await ttsClient.speak(text);
        statusEl.value = 'Done!';
        log('Playback finished');
    }
    catch (error) {
        console.error(error);
        statusEl.value = 'Failed to synthesize';
        log(`Speak failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    finally {
        setBusy(false);
    }
});
initialise();
