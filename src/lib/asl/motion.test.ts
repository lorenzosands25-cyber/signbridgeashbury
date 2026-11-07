import { describe, expect, it } from "vitest";
import { detectMotionSign, type Body, type Frame, type Shape } from "./motion";

const body: Body = { sw: 100, mouth: { x: 0, y: -60 }, forehead: { x: 0, y: -120 }, shoulderMid: { x: 0, y: 0 } };
const mk = (n: number, shape: Shape, at: (i: number) => { x: number; y: number }): Frame[] =>
  Array.from({ length: n }, (_, i) => ({ t: i * 33, shape, palm: at(i), tip: at(i), indexTip: at(i), body }));

describe("motion signs", () => {
  it("flat hand circling on chest reads as Please", () => {
    expect(detectMotionSign(mk(30, "open", (i) => ({ x: Math.cos(i / 3) * 15, y: 50 + Math.sin(i / 3) * 15 })))?.label).toBe("Please");
  });
  it("hand moving from chin forward/down reads as Thank you", () => {
    expect(detectMotionSign(mk(30, "open", (i) => ({ x: 0, y: -60 + i * 4 })))?.label).toBe("Thank you");
  });
  it("open hand held off to the side is not a body sign", () => {
    expect(detectMotionSign(mk(30, "open", () => ({ x: 200, y: 0 })))).toBeNull();
  });
  it("does not mistake a resting hand on the chest for Please", () => {
    expect(detectMotionSign(mk(30, "open", () => ({ x: 0, y: 50 })))).toBeNull();
  });
  it("does not mistake straight chest movement for a circular sign", () => {
    expect(detectMotionSign(mk(30, "fist", (i) => ({ x: -20 + i, y: 50 })))).toBeNull();
  });
  it("rejects a motion window shorter than 600 milliseconds", () => {
    expect(detectMotionSign(mk(30, "open", (i) => ({ x: Math.cos(i / 3) * 15, y: 50 + Math.sin(i / 3) * 15 })).map((f, i) => ({ ...f, t: i })))).toBeNull();
  });
});
