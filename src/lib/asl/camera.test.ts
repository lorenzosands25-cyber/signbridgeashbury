import { describe, expect, it } from "vitest";
import { cameraConstraints, cameraError, inferenceSize } from "./camera";

describe("camera pipeline", () => {
  it("never requests microphone access and selects the requested camera", () => {
    expect(cameraConstraints("user", "balanced", "webcam")).toEqual({ audio: false, video: { deviceId: { exact: "webcam" }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } } });
  });
  it("preserves camera aspect ratio and does not upscale small frames", () => {
    expect(inferenceSize(1920, 1080, "balanced")).toEqual({ width: 640, height: 360 });
    expect(inferenceSize(320, 240, "detail")).toEqual({ width: 320, height: 240 });
    expect(inferenceSize(1080, 1920, "detail")).toEqual({ width: 540, height: 960 });
  });
  it("distinguishes a busy camera from permission denial", () => {
    expect(cameraError(new DOMException("", "NotReadableError")).state).toBe("error");
    expect(cameraError(new DOMException("", "NotAllowedError")).state).toBe("denied");
  });
});