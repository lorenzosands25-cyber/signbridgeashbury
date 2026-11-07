import type { Classification } from "./classifier";

// Turns a noisy per-frame stream of classifications into committed text.
// A sign is only committed after it is held steadily for `stableFrames` frames
// with an average confidence at or above `threshold` — never on uncertain input.
export type BuilderStatus = "idle" | "tracking" | "recognized" | "low-confidence" | "unrecognized";

export class SentenceBuilder {
  text = "";
  confidences: number[] = [];
  private run: { label: string | null; n: number; sum: number } = { label: null, n: 0, sum: 0 };
  private lastCommitted: string | null = null;
  private absentSince: number | null = null;

  constructor(public threshold = 0.75, public stableFrames = 10, public spaceAfterMs = 1200) {}

  push(c: Classification | null, now: number): { status: BuilderStatus; committed?: string } {
    if (!c) {
      if (this.absentSince === null) this.absentSince = now;
      this.run = { label: null, n: 0, sum: 0 };
      this.lastCommitted = null;
      if (now - this.absentSince > this.spaceAfterMs && this.text && !this.text.endsWith(" ")) this.text += " ";
      return { status: "idle" };
    }
    this.absentSince = null;
    if (c.label !== this.run.label) this.run = { label: c.label, n: 0, sum: 0 };
    this.run.n++;
    this.run.sum += c.confidence;
    if (!c.label) return { status: "unrecognized" };
    const avg = this.run.sum / this.run.n;
    if (this.run.n < this.stableFrames) return { status: "tracking" };
    if (avg < this.threshold) return { status: "low-confidence" };
    if (this.lastCommitted === c.label) return { status: "recognized" };
    this.lastCommitted = c.label;
    if (c.kind === "word") {
      this.text = (this.text.trimEnd() + " " + c.label + " ").trimStart();
    } else {
      this.text += c.label;
    }
    this.confidences.push(avg);
    return { status: "recognized", committed: c.label };
  }

  private lastWordAt = new Map<string, number>();
  /** Commit a whole word from the movement detector (already confidence-checked). */
  commitWord(label: string, confidence: number, now: number): boolean {
    if (confidence < this.threshold) return false;
    if (now - (this.lastWordAt.get(label) ?? -1e9) < 1500) return false;
    this.lastWordAt.set(label, now);
    this.text = (this.text.trimEnd() + " " + label + " ").trimStart();
    this.confidences.push(confidence);
    this.run = { label: null, n: 0, sum: 0 };
    return true;
  }

  /** Allow repeating the same letter (e.g. "LL") by lowering the hand briefly. */
  get averageConfidence() {
    return this.confidences.length ? this.confidences.reduce((a, b) => a + b, 0) / this.confidences.length : 0;
  }

  clear() {
    this.text = "";
    this.confidences = [];
    this.lastCommitted = null;
  }
}
