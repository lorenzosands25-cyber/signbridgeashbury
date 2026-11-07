/** Only pass committed SentenceBuilder text, never frame-level guesses. */
export function pendingSpeech(text: string, spokenPrefix: string) {
  return (text.startsWith(spokenPrefix) ? text.slice(spokenPrefix.length) : text).trim();
}