import { describe, expect, it } from "vitest";
import { SentenceBuilder } from "./sentence";

describe("SentenceBuilder", () => {
  it("accepts a tentative word above 65% when a different sign appears", () => {
    const b = new SentenceBuilder();
    b.push({ label: "Yes", kind: "word", confidence: 0.66 }, 0, "Left", true);
    expect(b.text).toBe("");
    expect(b.push({ label: "Please", kind: "word", confidence: 0.8 }, 100, "Left", true).committed).toBe("Yes");
    expect(b.text).toBe("Yes ");
    expect(b.push({ label: "Help", kind: "word", confidence: 0.8 }, 200, "Left", true).committed).toBe("Please");
    expect(b.text).toBe("Yes Please ");
  });
  it("does not accept guesses at 65%, on lost hands, or from a different hand", () => {
    const a = { label: "Yes", kind: "word" as const, confidence: 0.66 };
    const next = { ...a, label: "Please" };
    for (const interrupt of ["low", "lost", "source", "gap", "reset"] as const) {
      const b = new SentenceBuilder();
      b.push(a, 0, "Left", true);
      if (interrupt === "low") b.push({ ...a, confidence: 0.65 }, 50, "Left", true);
      if (interrupt === "lost") b.push(null, 50, "Left", true);
      if (interrupt === "reset") b.resetTracking();
      b.push(next, interrupt === "gap" ? 501 : 100, interrupt === "source" ? "Right" : "Left", true);
      expect(b.text).toBe("");
    }
  });
  it("does not duplicate an already held-and-confirmed sign on transition", () => {
    const b = new SentenceBuilder();
    for (let t = 0; t <= 2100; t += 100) b.push({ label: "Yes", kind: "word", confidence: 0.8 }, t, "Left", true);
    expect(b.text).toBe("Yes ");
    b.push({ label: "Please", kind: "word", confidence: 0.8 }, 2200, "Left", true);
    expect(b.text).toBe("Yes ");
  });
  it("retains the duration gate in guided practice when signs change", () => {
    const b = new SentenceBuilder();
    b.push({ label: "Yes", kind: "word", confidence: 0.8 }, 0, "Left", false);
    b.push({ label: "Please", kind: "word", confidence: 0.8 }, 100, "Left", false);
    expect(b.text).toBe("");
  });
  it("reports only continuous confirmation evidence and clears it on low confidence", () => {
    const b = new SentenceBuilder();
    for (let t = 0; t <= 1000; t += 100) b.push({ label: "L", kind: "letter", confidence: 0.7 }, t);
    expect(b.confirmationProgress).toBe(0.5);
    b.push({ label: "L", kind: "letter", confidence: 0.69 }, 1100);
    expect(b.confirmationProgress).toBe(0);
  });
  it("does not commit a sign below the confidence threshold", () => {
    const b = new SentenceBuilder();
    for (let i = 0; i < 10; i++) b.push({ label: "L", kind: "letter", confidence: 0.5 }, i);
    expect(b.text).toBe("");
  });
  it("commits a steady confident sign once", () => {
    const b = new SentenceBuilder();
    for (let i = 0; i <= 30; i++) b.push({ label: "L", kind: "letter", confidence: 0.9 }, i * 100);
    expect(b.text).toBe("L");
  });
  it("never commits unrecognized handshapes", () => {
    const b = new SentenceBuilder();
    for (let i = 0; i < 10; i++) b.push({ label: null, kind: "letter", confidence: 1 }, i);
    expect(b.text).toBe("");
  });

  it("counts a sign at exactly 70% only after more than two seconds", () => {
    const b = new SentenceBuilder();
    const sign = { label: "L", kind: "letter" as const, confidence: 0.7 };
    for (let t = 0; t <= 2000; t += 100) b.push(sign, t);
    expect(b.text).toBe("");
    expect(b.push(sign, 2001).committed).toBe("L");
    expect(b.text).toBe("L");
  });

  it("never counts 69% even if a saved threshold is lower", () => {
    const b = new SentenceBuilder(0.5);
    for (let t = 0; t < 5000; t += 100) b.push({ label: "L", kind: "letter", confidence: 0.69 }, t);
    expect(b.text).toBe("");
  });

  it("restarts the two-second timer when confidence dips below 70%", () => {
    const b = new SentenceBuilder();
    const sign = { label: "L", kind: "letter" as const, confidence: 0.9 };
    for (let t = 0; t <= 1900; t += 100) b.push(sign, t);
    b.push({ ...sign, confidence: 0.69 }, 2000);
    for (let t = 2100; t <= 4100; t += 100) b.push(sign, t);
    expect(b.text).toBe("");
    expect(b.push(sign, 4101).committed).toBe("L");
  });

  it("applies the same two-second gate to motion words", () => {
    const b = new SentenceBuilder();
    for (let t = 0; t <= 2000; t += 100) expect(b.commitWord("Please", 0.7, t)).toBe(false);
    expect(b.commitWord("Please", 0.7, 2001)).toBe(true);
    expect(b.text).toBe("Please ");
    expect(b.commitWord("Please", 0.7, 2100)).toBe(false);
  });

  it("does not combine confirmation time from different hands", () => {
    const b = new SentenceBuilder();
    const sign = { label: "L", kind: "letter" as const, confidence: 0.9 };
    for (let t = 0; t <= 1500; t += 100) b.push(sign, t, "Left");
    for (let t = 1600; t <= 3000; t += 100) b.push(sign, t, "Right");
    expect(b.text).toBe("");
  });

  it("restarts after a long sample gap or camera reset", () => {
    const b = new SentenceBuilder();
    const sign = { label: "L", kind: "letter" as const, confidence: 0.9 };
    for (let t = 0; t <= 1500; t += 100) b.push(sign, t);
    expect(b.push(sign, 3000).status).toBe("tracking");
    b.resetTracking();
    expect(b.push(sign, 3100).status).toBe("tracking");
    expect(b.text).toBe("");
  });

  it("clears pending evidence when text is cleared", () => {
    const b = new SentenceBuilder();
    const sign = { label: "L", kind: "letter" as const, confidence: 0.9 };
    for (let t = 0; t <= 1900; t += 100) b.push(sign, t);
    b.clear();
    b.push(sign, 2001);
    expect(b.text).toBe("");
  });

  it("restarts when the detected sign changes", () => {
    const b = new SentenceBuilder();
    for (let t = 0; t <= 1900; t += 100) b.push({ label: "L", kind: "letter", confidence: 0.9 }, t);
    b.push({ label: "B", kind: "letter", confidence: 0.9 }, 2001);
    expect(b.text).toBe("");
  });
});
