import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTranslationSpeech } from "./use-translation-speech";

const mocks = vi.hoisted(() => ({ generate: vi.fn(), play: vi.fn(), pause: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.generate }));
vi.mock("@/lib/speech.functions", () => ({ synthesizeTranslation: vi.fn() }));

describe("automatic translated speech", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.generate.mockReset().mockResolvedValue({ audio: "test", error: null });
    mocks.play.mockReset().mockResolvedValue(undefined);
    mocks.pause.mockReset();
    vi.stubGlobal("Audio", class {
      onended?: () => void;
      onpause?: () => void;
      play() { const result = mocks.play(); this.onended?.(); return result; }
      pause() { mocks.pause(); this.onpause?.(); }
    });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("groups committed letters after a pause and voices only the new text", async () => {
    const { rerender } = renderHook(({ text }) => useTranslationSpeech(text), { initialProps: { text: "H" } });
    rerender({ text: "HI" });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.generate).toHaveBeenLastCalledWith({ data: { text: "HI" } });
    rerender({ text: "HI Yes " });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(mocks.generate).toHaveBeenLastCalledWith({ data: { text: "Yes" } });
  });

  it("does not synthesize new translations while muted", async () => {
    const { result, rerender } = renderHook(({ text }) => useTranslationSpeech(text), { initialProps: { text: "" } });
    act(() => result.current.toggle());
    rerender({ text: "Please " });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("ignores pending audio after the translation is cleared", async () => {
    let resolve: ((value: { audio: string; error: null }) => void) | undefined;
    mocks.generate.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const { rerender } = renderHook(({ text }) => useTranslationSpeech(text), { initialProps: { text: "Hello " } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    rerender({ text: "" });
    await act(async () => { resolve?.({ audio: "test", error: null }); });
    expect(mocks.play).not.toHaveBeenCalled();
  });
});