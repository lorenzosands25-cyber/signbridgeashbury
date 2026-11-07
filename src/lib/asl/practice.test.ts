import { describe, expect, it } from "vitest";
import { advancePractice, practiceSigns } from "./practice";

describe("phrase practice order", () => {
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