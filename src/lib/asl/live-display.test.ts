import { describe, expect, it } from "vitest";
import { needsDisplayUpdate, sameDisplayedClassification } from "./live-display";

describe("display-only scheduling", () => {
  it("publishes changed signs immediately but limits unchanged display refresh to 100ms", () => {
    expect(needsDisplayUpdate(1, 0, "Please", "Sorry")).toBe(true);
    expect(needsDisplayUpdate(99, 0, "Please", "Please")).toBe(false);
    expect(needsDisplayUpdate(100, 0, "Please", "Please")).toBe(true);
  });
  it("compares the displayed percentage without hiding label or presence changes", () => {
    const a = { label: "Please", kind: "word" as const, confidence: 0.901 };
    expect(sameDisplayedClassification(a, { ...a, confidence: 0.904 })).toBe(true);
    expect(sameDisplayedClassification(a, { ...a, confidence: 0.91 })).toBe(false);
    expect(sameDisplayedClassification(a, { ...a, label: "Sorry" })).toBe(false);
    expect(sameDisplayedClassification(a, null)).toBe(false);
  });
});