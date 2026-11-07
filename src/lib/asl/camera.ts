export type CameraQuality = "balanced" | "detail";

export function cameraConstraints(facing: "user" | "environment", quality: CameraQuality, deviceId = ""): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: facing } }),
      width: { ideal: quality === "detail" ? 1280 : 640 },
      height: { ideal: quality === "detail" ? 720 : 480 },
      frameRate: { ideal: 30, max: 30 },
    },
  };
}

export function inferenceSize(width: number, height: number, quality: CameraQuality) {
  const scale = Math.min(1, (quality === "detail" ? 960 : 640) / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function cameraError(error: unknown): { state: "denied" | "unavailable" | "error"; message: string } {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return { state: "denied", message: "Camera permission is blocked. Allow camera access in your browser's site settings, then retry." };
  if (name === "NotReadableError" || name === "AbortError") return { state: "error", message: "Your camera is busy. Close other camera apps or tabs, then retry." };
  if (name === "NotFoundError" || name === "OverconstrainedError") return { state: "unavailable", message: "This camera is unavailable. Choose another camera or the default camera, then retry." };
  return { state: "error", message: "Tracking could not start. Check your connection and retry." };
}