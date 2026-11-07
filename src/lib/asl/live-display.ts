import type { Classification } from "./classifier";

// Display-only deduplication; every video sample still reaches recognition.
export function sameDisplayedClassification(a: Classification | null, b: Classification | null): boolean {
  if (!a || !b) return a === b;
  return a.label === b.label && a.kind === b.kind && Math.round(a.confidence * 100) === Math.round(b.confidence * 100);
}

export function needsDisplayUpdate(now: number, last: number, previousKey: string, nextKey: string): boolean {
  return previousKey !== nextKey || now - last >= 100;
}