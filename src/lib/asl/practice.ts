export const TWO_HAND_SIGNS = ["Help", "Nice / Clean", "Meet"] as const;

export const PHRASE_PRACTICES = [
  { title: "Please help", signs: ["Please", "Help"] },
  { title: "Hello, thank you", signs: ["Hello", "Thank you"] },
  { title: "Yes, please", signs: ["Yes", "Please"] },
  { title: "Nice to meet", signs: ["Nice / Clean", "Meet"] },
  { title: "Hello, please help", signs: ["Hello", "Please", "Help"] },
  { title: "Help, thank you", signs: ["Help", "Thank you"] },
  { title: "Sorry, please help", signs: ["Sorry", "Please", "Help"] },
  { title: "Hello, nice to meet", signs: ["Hello", "Nice / Clean", "Meet"] },
  { title: "Yes, thank you", signs: ["Yes", "Thank you"] },
  { title: "Please, thank you", signs: ["Please", "Thank you"] },
] as const;

export function practiceSigns(practice?: string): readonly string[] {
  if (!practice) return [];
  return PHRASE_PRACTICES.find((p) => p.title === practice)?.signs ?? (TWO_HAND_SIGNS.some((s) => s === practice) ? [practice] : []);
}

export function advancePractice(signs: readonly string[], step: number, committed: string): number {
  return signs[step] === committed ? Math.min(signs.length, step + 1) : step;
}