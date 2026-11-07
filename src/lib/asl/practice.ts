export const TWO_HAND_SIGNS = ["Help", "Nice / Clean", "Meet"] as const;

export const PHRASE_PRACTICES = [
  { title: "Please help", signs: ["Please", "Help"] },
  { title: "Hello, thank you", signs: ["Hello", "Thank you"] },
  { title: "Yes, please", signs: ["Yes", "Please"] },
  { title: "Nice to meet", signs: ["Nice / Clean", "Meet"] },
] as const;

export function practiceSigns(practice?: string): readonly string[] {
  if (!practice) return [];
  return PHRASE_PRACTICES.find((p) => p.title === practice)?.signs ?? [practice];
}

export function advancePractice(signs: readonly string[], step: number, committed: string): number {
  return signs[step] === committed ? Math.min(signs.length, step + 1) : step;
}