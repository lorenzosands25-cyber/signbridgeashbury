import { describe, expect, it } from "vitest";
import { advancePractice, practiceSigns } from "./practice";
import { SentenceBuilder } from "./sentence";

describe("phrase practice order", () => {
  it("confirms each phrase step independently without borrowing the previous step's timer", () => {
    const signs = practiceSigns("Please help");
    const builder = new SentenceBuilder();
    let step = 0;
    for (let t = 0; t <= 2100; t += 100) {
      const result = builder.push({ label: "Please", kind: "word", confidence: 0.7 }, t);
      if (result.committed) step = advancePractice(signs, step, result.committed);
    }
    expect(step).toBe(1);
    builder.resetTracking();
    for (let t = 2200; t <= 4200; t += 100) builder.push({ label: "Help", kind: "word", confidence: 0.7 }, t, "pair");
    expect(builder.text).toBe("Please ");
    const result = builder.push({ label: "Help", kind: "word", confidence: 0.7 }, 4201, "pair");
    if (result.committed) step = advancePractice(signs, step, result.committed);
    expect(step).toBe(2);
    expect(builder.text).toBe("Please Help ");
  });
  it("requires Please followed by Help for Please help", () => {
    const signs = practiceSigns("Please help");
    expect(signs).toEqual(["Please", "Help"]);
    expect(advancePractice(signs, 0, "Help")).toBe(0);
    expect(advancePractice(signs, 0, "Please")).toBe(1);
    expect(advancePractice(signs, 1, "Help")).toBe(2);
    expect(advancePractice(signs, 2, "Help")).toBe(2);
  });
  it("supports individual practice without inventing a phrase", () => {
    expect(practiceSigns("Meet")).toEqual(["Meet"]);
    expect(practiceSigns()).toEqual([]);
  });
});