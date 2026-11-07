import { describe, expect, it } from "vitest";
import { detectMotionSign, isMoving, type Body, type Frame, type Shape } from "./motion";
import { SentenceBuilder } from "./sentence";

const body: Body = { sw: 100, mouth: { x: 0, y: -60 }, forehead: { x: 0, y: -120 }, shoulderMid: { x: 0, y: 0 } };
const mk = (n: number, shape: Shape, at: (i: number) => { x: number; y: number }): Frame[] =>
  Array.from({ length: n }, (_, i) => ({ t: i * 33, shape, palm: at(i), tip: at(i), indexTip: at(i), body }));

describe("motion signs", () => {
  it.each([10, 30, 60, 120])("matches smooth chest-height Yes nods at %i fps", (fps) => {
    const frames = Array.from({ length: fps + 1 }, (_, i) => {
      const t = i * 1000 / fps;
      const palm = { x: 0, y: 50 + 6 * Math.sin(t / 1000 * 4 * Math.PI) };
      return { t, shape: "fist" as const, palm, tip: palm, indexTip: palm, body };
    });
    expect(detectMotionSign(frames)?.label).toBe("Yes");
  });
  it.each([
    ["resting", (i: number) => ({ x: 0, y: 50 })],
    ["tiny jitter", (i: number) => ({ x: 0, y: 50 + Math.sin(i) })],
    ["horizontal shaking", (i: number) => ({ x: Math.sin(i / 3) * 15, y: 50 })],
    ["one-way travel", (i: number) => ({ x: 0, y: 20 + i })],
  ] as const)("does not label %s as Yes", (_, at) => {
    expect(detectMotionSign(mk(30, "fist", at))?.label).not.toBe("Yes");
  });
  it("keeps fist circles as Sorry instead of Yes", () => {
    expect(detectMotionSign(mk(30, "fist", (i) => ({ x: Math.cos(i / 3) * 15, y: 50 + Math.sin(i / 3) * 15 })))?.label).toBe("Sorry");
  });
  it("ignores apparent nodding caused by body/camera translation", () => {
    const frames = mk(30, "fist", () => ({ x: 0, y: 50 })).map((f, i) => {
      const dy = Math.sin(i / 3) * 15;
      const shift = (p: { x: number; y: number }) => ({ x: p.x, y: p.y + dy });
      return { ...f, palm: shift(f.palm), tip: shift(f.tip), indexTip: shift(f.indexTip), body: { ...body, shoulderMid: shift(body.shoulderMid), mouth: shift(body.mouth), forehead: shift(body.forehead) } };
    });
    expect(detectMotionSign(frames)).toBeNull();
    expect(isMoving(frames)).toBe(false);
  });
  it("caps a moving suggestion at its handshape confidence", () => {
    const frames = mk(30, "fist", (i) => ({ x: 0, y: 50 + Math.sin(i / 3) * 6 })).map((f) => ({ ...f, shapeConfidence: 0.66 }));
    expect(detectMotionSign(frames)).toEqual({ label: "Yes", confidence: 0.66 });
    expect(detectMotionSign(frames.map((f) => ({ ...f, shapeConfidence: 0.65 })))).toBeNull();
  });
  it("confirms continuously moving Yes only after over two seconds of matches", () => {
    const builder = new SentenceBuilder();
    const frames: Frame[] = [];
    let firstMatch: number | undefined;
    let committedAt: number | undefined;
    for (let t = 0; t <= 4000; t += 50) {
      const palm = { x: 0, y: 50 + Math.sin(t / 1000 * 4 * Math.PI) * 6 };
      frames.push({ t, shape: "fist", palm, tip: palm, indexTip: palm, body });
      const match = detectMotionSign(frames.filter((f) => t - f.t < 1200));
      if (match && firstMatch === undefined) firstMatch = t;
      const result = builder.push(match ? { ...match, kind: "word" } : null, t);
      if (result.committed) committedAt = t;
      if (firstMatch !== undefined && t - firstMatch <= 2000) expect(builder.text).toBe("");
    }
    expect(firstMatch).toBe(600);
    expect(committedAt).toBe(2650);
    expect(builder.text).toBe("Yes ");
  });
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
