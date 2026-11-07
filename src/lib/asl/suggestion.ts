import type { Classification } from "./classifier";

// Suggestions never enter the sentence or speech queue.
export function tentativeSuggestion(candidate: Classification | null): Classification | null {
  return candidate?.label && Number.isFinite(candidate.confidence) && candidate.confidence > 0.65 ? candidate : null;
}