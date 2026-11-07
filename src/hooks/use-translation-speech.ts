import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { synthesizeTranslation } from "@/lib/speech.functions";
import { pendingSpeech } from "@/lib/speech-text";

export function useTranslationSpeech(text: string) {
  const generate = useServerFn(synthesizeTranslation);
  const generateRef = useRef(generate);
  generateRef.current = generate;
  const [enabled, setEnabled] = useState(true);
  const [state, setState] = useState<"idle" | "loading" | "speaking">("idle");
  const [error, setError] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);
  const prefix = useRef("");
  const epoch = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const cancel = useCallback(() => {
    epoch.current++;
    audio.current?.pause();
    audio.current = null;
    queue.current = Promise.resolve();
    setState("idle");
  }, []);

  const speak = useCallback((value: string) => {
    const version = epoch.current;
    queue.current = queue.current.then(async () => {
      if (version !== epoch.current) return;
      setState("loading");
      setError("");
      try {
        const result = await generateRef.current({ data: { text: value.slice(0, 5000) } });
        if (version !== epoch.current) return;
        if (result.error || !result.audio) throw new Error(result.error || "No audio was returned.");
        const player = new Audio(`data:audio/mpeg;base64,${result.audio}`);
        audio.current = player;
        const ended = new Promise<void>((resolve) => {
          player.onended = () => resolve();
          player.onpause = () => resolve();
          player.onerror = () => resolve();
        });
        await player.play();
        setState("speaking");
        await ended;
      } catch (e) {
        if (version === epoch.current) setError(e instanceof DOMException && e.name === "NotAllowedError"
          ? "Your browser paused speech. Tap Play translation to hear it."
          : e instanceof Error ? e.message : "Speech couldn't play. Try again.");
      } finally {
        if (version === epoch.current) { audio.current = null; setState("idle"); }
      }
    });
  }, []);

  useEffect(() => {
    if (!text || !enabled) {
      prefix.current = text;
      cancel();
      setError("");
      return;
    }
    // Wait for a short pause so fingerspelled letters can form a word.
    const timer = window.setTimeout(() => {
      const next = pendingSpeech(text, prefix.current);
      prefix.current = text;
      if (next) speak(next);
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [text, enabled, cancel, speak]);

  useEffect(() => () => { epoch.current++; audio.current?.pause(); }, []);

  const toggle = () => { cancel(); prefix.current = text; setEnabled((v) => !v); };
  const replay = () => { cancel(); prefix.current = text; if (text.trim()) speak(text.trim()); };
  return { enabled, state, error, toggle, replay, cancel };
}