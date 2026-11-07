import { describe, expect, it } from "vitest";
import { tentativeSuggestion } from "./suggestion";
import { SentenceBuilder } from "./sentence";

describe("tentative suggestions", () => {
  it("shows only matches strictly above 65%", () => {
    expect(tentativeSuggestion({ label: "Yes", kind: "word", confidence: 0.65 })).toBeNull();
    expect(tentativeSuggestion({ label: "Yes", kind: "word", confidence: 0.651 })?.label).toBe("Yes");
    expect(tentativeSuggestion({ label: "Yes", kind: "word", confidence: NaN })).toBeNull();
  });
  it("does not commit a tentative 66% match even after two seconds", () => {
    const builder = new SentenceBuilder();
    for (let t = 0; t <= 3000; t += 100) builder.push(tentativeSuggestion({ label: "Yes", kind: "word", confidence: 0.66 }), t);
    expect(builder.text).toBe("");
  });
});