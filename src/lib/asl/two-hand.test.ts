import { describe, expect, it } from "vitest";
import { detectTwoHandSign, type PairedFrame } from "./two-hand";
import { SentenceBuilder } from "./sentence";
import type { Frame, Shape } from "./motion";

const hand = (t: number, shape: Shape, x: number, y: number): Frame => ({ t, shape, palm: { x, y }, tip: { x, y: y - 30 }, indexTip: { x, y: y - 30 }, body: { sw: 100, shoulderMid: { x: 0, y: 0 }, mouth: { x: 0, y: -60 }, forehead: { x: 0, y: -120 } }, palmNormal: { x: 0, y: 1, z: 0 }, thumbUp: true });
const help = (): PairedFrame[] => Array.from({ length: 30 }, (_, i) => ({ t: i * 33, left: hand(i * 33, "fist", 0, 60 - i), right: hand(i * 33, "open", 0, 75 - i) }));

describe("guided two-hand candidates", () => {
  it("requires both a lifting fist and supporting flat palm for Help", () => {
    expect(detectTwoHandSign(help(), "Help")?.label).toBe("Help");
    expect(detectTwoHandSign(help().map((f) => ({ ...f, right: { ...f.right, shape: "other" } })), "Help")).toBeNull();
    expect(detectTwoHandSign(help().map((f) => ({ ...f, left: { ...f.left, thumbUp: false } })), "Help")).toBeNull();
  });
  it("rejects stationary hands and whole-body movement for Help", () => {
    expect(detectTwoHandSign(help().map((f) => ({ ...f, left: hand(f.t, "fist", 0, 60), right: hand(f.t, "open", 0, 75) })), "Help")).toBeNull();
    expect(detectTwoHandSign(help().map((f, i) => ({ ...f, left: { ...f.left, body: { ...f.left.body, shoulderMid: { x: 0, y: -i } } }, right: { ...f.right, body: { ...f.right.body, shoulderMid: { x: 0, y: -i } } } })), "Help")).toBeNull();
  });
  it("requires a sweeping hand over a stationary flat palm for Nice / Clean", () => {
    const frames = Array.from({ length: 30 }, (_, i) => ({ t: i * 33, left: hand(i * 33, "open", -25 + i * 1.7, 60), right: hand(i * 33, "open", 0, 65) }));
    expect(detectTwoHandSign(frames, "Nice / Clean")?.label).toBe("Nice / Clean");
    expect(detectTwoHandSign(frames.map((f) => ({ ...f, right: { ...f.right, palmNormal: { x: 0, y: 0, z: 1 } } })), "Nice / Clean")).toBeNull();
  });
  it("requires two raised index hands approaching each other for Meet", () => {
    const frames = Array.from({ length: 30 }, (_, i) => ({ t: i * 33, left: hand(i * 33, "index", -40 + i, 60), right: hand(i * 33, "index", 40 - i, 60) }));
    expect(detectTwoHandSign(frames, "Meet")?.label).toBe("Meet");
    expect(detectTwoHandSign([...frames].reverse().map((f, i) => ({ ...f, t: i * 33 })), "Meet")).toBeNull();
  });
  it("rejects bad coordinates, stale samples, and unsupported targets", () => {
    const frames = help();
    expect(detectTwoHandSign(frames.map((f) => ({ ...f, left: { ...f.left, palm: { x: NaN, y: 0 } } })), "Help")).toBeNull();
    expect(detectTwoHandSign(frames.map((f, i) => ({ ...f, t: i * 1000 })), "Help")).toBeNull();
    expect(detectTwoHandSign(frames, "anything")).toBeNull();
  });
  it("does not let a two-hand candidate bypass 70% for more than two seconds", () => {
    const b = new SentenceBuilder();
    for (let t = 0; t <= 2000; t += 100) b.push({ label: "Help", kind: "word", confidence: 0.7 }, t, "pair");
    expect(b.text).toBe("");
    expect(b.push({ label: "Help", kind: "word", confidence: 0.7 }, 2001, "pair").committed).toBe("Help");
    b.clear();
    for (let t = 0; t <= 3000; t += 100) b.push({ label: "Help", kind: "word", confidence: 0.69 }, t, "pair");
    expect(b.text).toBe("");
  });
});