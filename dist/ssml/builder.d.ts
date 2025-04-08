/**
 * SSML Builder class for creating SSML markup
 */
export declare class SSMLBuilder {
    private ssml;
    /**
     * Add text or SSML to the builder
     * @param text Text or SSML to add
     * @returns The SSML string
     */
    add(text: string): string;
    /**
     * Add a break to the SSML
     * @param time Break duration (e.g., '500ms')
     * @returns The SSML builder instance
     */
    addBreak(time?: string): SSMLBuilder;
    /**
     * Add prosody element to the SSML
     * @param text Text to wrap with prosody
     * @param rate Speech rate
     * @param pitch Speech pitch
     * @param volume Speech volume
     * @returns The SSML builder instance
     */
    addProsody(text: string, rate?: "x-slow" | "slow" | "medium" | "fast" | "x-fast", pitch?: "x-low" | "low" | "medium" | "high" | "x-high", volume?: string): SSMLBuilder;
    /**
     * Wrap text with speak tags
     * @param text Text to wrap
     * @returns SSML string with speak tags
     */
    wrapWithSpeak(text: string): string;
    /**
     * Clear the SSML content
     */
    clearSSML(): void;
    /**
     * Get the current SSML string
     * @returns The current SSML string
     */
    toString(): string;
}
