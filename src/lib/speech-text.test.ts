import { describe, expect, it } from "vitest";
import { pendingSpeech } from "./speech-text";
import { SentenceBuilder } from "./asl/sentence";

describe("spoken translations", () => {
  it("voices only the new committed text, without repeating earlier words", () => {
    expect(pendingSpeech("Hello Thank you ", "Hello ")).toBe("Thank you");
  });
  it("does not repeat an unchanged translation", () => {
    expect(pendingSpeech("Hello ", "Hello ")).toBe("");
  });
  it("does not voice low-confidence guesses", () => {
    const builder = new SentenceBuilder(0.75);
    builder.commitWord("Please", 0.5, 2000);
    expect(pendingSpeech(builder.text, "")).toBe("");
  });
  it("allows a new conversation after clearing", () => {
    expect(pendingSpeech("Yes ", "Hello ")).toBe("Yes");
  });
});