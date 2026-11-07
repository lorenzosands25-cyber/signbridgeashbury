import type { Classification } from "./classifier";

// Turns a noisy per-frame stream of classifications into committed text.
// Guided practice uses the wall-clock gate; free conversation may accept a guess on sign change.
export const MIN_SIGN_CONFIDENCE = 0.7;
export const SIGN_HOLD_MS = 2000;
const MAX_SAMPLE_GAP_MS = 500;
export type BuilderStatus = "idle" | "tracking" | "recognized" | "low-confidence" | "unrecognized";

export class SentenceBuilder {
  text = "";
  confidences: number[] = [];
  private run: { key: string; since: number; last: number; n: number; sum: number } | null = null;
  private lastCommitted: string | null = null;
  private absentSince: number | null = null;
  private tentative: { candidate: Classification; source: string; last: number } | null = null;

  constructor(public threshold = MIN_SIGN_CONFIDENCE, public holdMs = SIGN_HOLD_MS, public spaceAfterMs = 1200) {}

  resetTracking() {
    this.run = null;
    this.lastCommitted = null;
    this.absentSince = null;
    this.tentative = null;
  }

  private append(c: Classification, key: string, confidence: number) {
    this.lastCommitted = key;
    if (c.kind === "word") this.text = (this.text.trimEnd() + " " + c.label + " ").trimStart();
    else this.text += c.label;
    this.confidences.push(confidence);
  }

  push(c: Classification | null, now: number, source = "default", confirmOnChange = false): { status: BuilderStatus; committed?: string } {
    let accepted: string | undefined;
    if (confirmOnChange && c?.label && Number.isFinite(c.confidence) && c.confidence > 0.65) {
      const previous = this.tentative;
      const key = `${source}:${c.kind}:${c.label}`;
      if (previous && previous.source === source && now >= previous.last && now - previous.last <= MAX_SAMPLE_GAP_MS && (previous.candidate.label !== c.label || previous.candidate.kind !== c.kind)) {
        const previousKey = `${source}:${previous.candidate.kind}:${previous.candidate.label}`;
        if (this.lastCommitted !== previousKey) {
          this.append(previous.candidate, previousKey, previous.candidate.confidence);
          accepted = previous.candidate.label ?? undefined;
        }
      }
      this.tentative = this.lastCommitted === key ? null : { candidate: c, source, last: now };
    } else this.tentative = null;
    const result = (status: BuilderStatus) => accepted ? { status, committed: accepted } : { status };
    if (!c) {
      if (this.absentSince === null) this.absentSince = now;
      this.run = null;
      this.lastCommitted = null;
      if (now - this.absentSince > this.spaceAfterMs && this.text && !this.text.endsWith(" ")) this.text += " ";
      return result("idle");
    }
    this.absentSince = null;
    if (!c.label || !Number.isFinite(c.confidence) || c.confidence < Math.max(MIN_SIGN_CONFIDENCE, this.threshold)) {
      this.run = null;
      return result(c.label ? "low-confidence" : "unrecognized");
    }
    const key = `${source}:${c.kind}:${c.label}`;
    if (!this.run || this.run.key !== key || now - this.run.last > MAX_SAMPLE_GAP_MS || now < this.run.last) {
      this.run = { key, since: now, last: now, n: 0, sum: 0 };
    }
    this.run.last = now;
    this.run.n++;
    this.run.sum += c.confidence;
    const avg = this.run.sum / this.run.n;
    if (now - this.run.since <= Math.max(SIGN_HOLD_MS, this.holdMs)) return result("tracking");
    if (this.lastCommitted === key) return result("recognized");
    this.append(c, key, avg);
    this.tentative = null;
    return { status: "recognized", committed: c.label };
  }

  /** Whole words cannot bypass the same confidence/duration gate as letters. */
  get confirmationProgress() {
    return this.run ? Math.min(1, (this.run.last - this.run.since) / Math.max(SIGN_HOLD_MS, this.holdMs)) : 0;
  }

  commitWord(label: string, confidence: number, now: number, source = "default"): boolean {
    return !!this.push({ label, kind: "word", confidence }, now, source).committed;
  }

  /** Allow repeating the same letter (e.g. "LL") by lowering the hand briefly. */
  get averageConfidence() {
    return this.confidences.length ? this.confidences.reduce((a, b) => a + b, 0) / this.confidences.length : 0;
  }

  clear() {
    this.text = "";
    this.confidences = [];
    this.resetTracking();
  }
}
