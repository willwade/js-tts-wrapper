/**
 * SSML Builder class for creating SSML markup
 */
export class SSMLBuilder {
  private ssml: string = "";

  /**
   * Add text or SSML to the builder
   * @param text Text or SSML to add
   * @returns The SSML string
   */
  add(text: string): string {
    // If text doesn't start with <speak>, wrap it
    if (!text.trim().startsWith("<speak")) {
      this.ssml = `<speak>${text}</speak>`;
    } else {
      this.ssml = text;
    }
    return this.ssml;
  }

  /**
   * Add a break to the SSML
   * @param time Break duration (e.g., '500ms')
   * @returns The SSML builder instance
   */
  addBreak(time: string = "500ms"): SSMLBuilder {
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
  addProsody(
    text: string,
    rate?: "x-slow" | "slow" | "medium" | "fast" | "x-fast",
    pitch?: "x-low" | "low" | "medium" | "high" | "x-high",
    volume?: string
  ): SSMLBuilder {
    let prosodyAttrs = "";
    if (rate) prosodyAttrs += ` rate="${rate}"`;
    if (pitch) prosodyAttrs += ` pitch="${pitch}"`;
    if (volume) prosodyAttrs += ` volume="${volume}"`;

    const prosodyElement = `<prosody${prosodyAttrs}>${text}</prosody>`;

    if (this.ssml.includes("<speak>")) {
      this.ssml = this.ssml.replace("<speak>", `<speak>${prosodyElement}`);
    } else {
      this.ssml = `<speak>${prosodyElement}</speak>`;
    }

    return this;
  }

  /**
   * Wrap text with speak tags
   * @param text Text to wrap
   * @returns SSML string with speak tags
   */
  wrapWithSpeak(text: string): string {
    if (!text.trim().startsWith("<speak")) {
      return `<speak>${text}</speak>`;
    }
    return text;
  }

  /**
   * Clear the SSML content
   */
  clearSSML(): void {
    this.ssml = "";
  }

  /**
   * Get the current SSML string
   * @returns The current SSML string
   */
  toString(): string {
    return this.ssml;
  }
}
