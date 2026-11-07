import { describe, expect, it } from "vitest";
import { updateMotionWindow } from "./motion-window";
import { detectMotionSign, type Frame } from "./motion";
import { SentenceBuilder } from "./sentence";

const frame = (t: number, shape: Frame["shape"]): Frame => ({ t, shape, palm: { x: Math.cos(t / 100) * 15, y: 50 + Math.sin(t / 100) * 15 }, tip: { x: 0, y: 50 }, indexTip: { x: 0, y: 50 }, body: { sw: 100, mouth: { x: 0, y: -60 }, forehead: { x: 0, y: -120 }, shoulderMid: { x: 0, y: 0 } } });
const key = (f: Frame) => f.shape;

describe("responsive motion windows", () => {
  it("drops the old sign on the first changed-handshape frame and detects the new motion with 600ms evidence", () => {
    let frames: Frame[] = [];
    for (let t = 0; t <= 1200; t += 33) frames = updateMotionWindow(frames, frame(t, "open"), key);
    expect(detectMotionSign(frames)?.label).toBe("Please");
    frames = updateMotionWindow(frames, frame(1250, "fist"), key);
    expect(frames).toHaveLength(1);
    expect(detectMotionSign(frames)).toBeNull();
    for (let t = 1283; t < 1850; t += 33) frames = updateMotionWindow(frames, frame(t, "fist"), key);
    expect(detectMotionSign(frames)).toBeNull();
    frames = updateMotionWindow(frames, frame(1850, "fist"), key);
    expect(detectMotionSign(frames)?.label).toBe("Sorry");
  });
  it("restarts on unknown shapes and gaps without borrowing previous evidence", () => {
    const initial = [frame(0, "open"), frame(100, "open")];
    expect(updateMotionWindow(initial, frame(110, "other"), key)).toHaveLength(1);
    expect(updateMotionWindow(initial, frame(601, "open"), key)).toHaveLength(1);
    expect(updateMotionWindow(initial, frame(90, "open"), key)).toHaveLength(1);
  });
  it("resets paired evidence when either hand changes shape", () => {
    const old = { t: 0, left: "fist", right: "open" };
    const next = { t: 33, left: "fist", right: "other" };
    expect(updateMotionWindow([old], next, (f) => `${f.left}:${f.right}`)).toEqual([next]);
  });
  it("keeps confirmation at 70% continuously for more than two seconds after a switch", () => {
    const b = new SentenceBuilder();
    for (let t = 0; t <= 1900; t += 100) b.push({ label: "Please", kind: "word", confidence: 0.9 }, t);
    for (let t = 2000; t <= 4000; t += 100) b.push({ label: "Sorry", kind: "word", confidence: 0.7 }, t);
    expect(b.text).toBe("");
    expect(b.push({ label: "Sorry", kind: "word", confidence: 0.7 }, 4001).committed).toBe("Sorry");
  });
});