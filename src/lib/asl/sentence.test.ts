import { describe, expect, it } from "vitest";
import { SentenceBuilder } from "./sentence";

describe("SentenceBuilder", () => {
  it("does not commit a sign below the confidence threshold", () => {
    const b = new SentenceBuilder(0.75, 3);
    for (let i = 0; i < 10; i++) b.push({ label: "L", kind: "letter", confidence: 0.5 }, i);
    expect(b.text).toBe("");
  });
  it("commits a steady confident sign once", () => {
    const b = new SentenceBuilder(0.75, 3);
    for (let i = 0; i < 10; i++) b.push({ label: "L", kind: "letter", confidence: 0.9 }, i);
    expect(b.text).toBe("L");
  });
  it("never commits unrecognized handshapes", () => {
    const b = new SentenceBuilder(0.75, 3);
    for (let i = 0; i < 10; i++) b.push({ label: null, kind: "letter", confidence: 1 }, i);
    expect(b.text).toBe("");
  });
});
