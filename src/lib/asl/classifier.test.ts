import { describe, expect, it } from "vitest";
import { classifyHandshape, type Landmark } from "./classifier";

describe("handshape input quality", () => {
  it("rejects incomplete hands", () => {
    expect(classifyHandshape([{ x: 0, y: 0 }]).label).toBeNull();
  });
  it("rejects invalid coordinates rather than producing a confident label", () => {
    const hand: Landmark[] = Array.from({ length: 21 }, (_, i) => ({ x: i / 100, y: i / 100 }));
    hand[8] = { x: NaN, y: 0 };
    expect(classifyHandshape(hand)).toEqual({ label: null, kind: "letter", confidence: 0 });
  });
  it("rejects collapsed landmarks", () => {
    expect(classifyHandshape(Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))).label).toBeNull();
  });
});