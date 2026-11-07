import { useCallback, useEffect, useState } from "react";

export type HistoryItem = { id: string; text: string; createdAt: number; confidence: number; favorite: boolean };
export type Settings = {
  facingMode: "user" | "environment";
  mirror: boolean;
  threshold: number;
  showLandmarks: boolean;
  textScale: number;
  theme: "light" | "dark";
};

export const defaultSettings: Settings = {
  facingMode: "user",
  mirror: true,
  threshold: 0.7,
  showLandmarks: true,
  textScale: 1,
  theme: "light",
};

const HK = "signa.history";
const SK = "signa.settings";

function read<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    const stored = v ? { ...(fallback as object), ...JSON.parse(v) } : fallback;
    // Migrate the previous frame-based confirmation setting once.
    if (k === SK && v && localStorage.getItem("signa.confirmation-v2") !== "true") {
      Object.assign(stored as object, { threshold: 0.7 });
      localStorage.setItem(SK, JSON.stringify(stored));
      localStorage.setItem("signa.confirmation-v2", "true");
    }
    return stored;
  } catch {
    return fallback;
  }
}

function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    setValue(Array.isArray(fallback) ? (JSON.parse(localStorage.getItem(key) || "[]") as T) : read(key, fallback));
    const on = (e: Event) => {
      if ((e as CustomEvent).detail === key)
        setValue(Array.isArray(fallback) ? (JSON.parse(localStorage.getItem(key) || "[]") as T) : read(key, fallback));
    };
    window.addEventListener("signa-store", on);
    return () => window.removeEventListener("signa-store", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const save = useCallback(
    (next: T | ((p: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        localStorage.setItem(key, JSON.stringify(v));
        queueMicrotask(() => window.dispatchEvent(new CustomEvent("signa-store", { detail: key })));
        return v;
      });
    },
    [key],
  );
  return [value, save] as const;
}

const emptyHistory: HistoryItem[] = [];
export const useHistory = () => useStored<HistoryItem[]>(HK, emptyHistory);
export const useSettings = () => useStored<Settings>(SK, defaultSettings);
