// Geometric handshape classifier on top of MediaPipe's 21 hand landmarks.
// It recognises a small, verified set of static ASL fingerspelling handshapes.
// To expand vocabulary, replace `classifyHandshape` with a trained model
// (e.g. a TF.js / ONNX classifier fed with normalized landmarks over time) that
// returns the same `Classification` shape.

export type Landmark = { x: number; y: number; z?: number };

export type Classification = {
  label: string | null; // null = hand seen but sign not recognised
  kind: "letter" | "word";
  confidence: number; // 0..1
};

export const SUPPORTED_SIGNS = [
  "A", "B", "C", "D", "F", "I", "L", "O", "S", "U", "V", "W", "Y", "5", "I love you",
] as const;

const d = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number) => Math.max(0, Math.min(1, v));

export function classifyHandshape(input: Landmark[]): Classification {
  const lm = (i: number) => input[i]!;
  if (input.length < 21) return { label: null, kind: "letter", confidence: 0 };
  const palm = d(lm(0), lm(9)) || 1e-6;

  // Combine two cues per finger: joint straightness (camera-angle robust) and
  // tip-vs-PIP distance from the wrist. Uses 3D coordinates when available.
  const straight = (mcp: number, pip: number, tip: number) => {
    const a = lm(mcp), b = lm(pip), c = lm(tip);
    const v1 = [b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0)];
    const v2 = [c.x - b.x, c.y - b.y, (c.z ?? 0) - (b.z ?? 0)];
    const dot = v1[0]! * v2[0]! + v1[1]! * v2[1]! + v1[2]! * v2[2]!;
    const n = Math.hypot(...v1) * Math.hypot(...v2) || 1e-6;
    return dot / n; // 1 = straight, <0 = folded back
  };
  const fingerScore = (mcp: number, pip: number, tip: number) => {
    const dist = clamp((d(lm(0), lm(tip)) / (d(lm(0), lm(pip)) || 1e-6) - 0.95) / 0.45);
    const ang = clamp((straight(mcp, pip, tip) - 0.1) / 0.7);
    return dist * 0.5 + ang * 0.5;
  };
  const thumb = clamp((d(lm(4), lm(5)) / palm - 0.4) / 0.4);
  const scores = [thumb, fingerScore(5, 6, 8), fingerScore(9, 10, 12), fingerScore(13, 14, 16), fingerScore(17, 18, 20)];
  const ext = scores.map((s) => s > 0.5);
  // Certainty: how decisively each finger is open/closed.
  const certainty = scores.reduce((acc, s) => acc + Math.abs(s - 0.5) * 2, 0) / scores.length;

  // O: all fingertips gathered at the thumb tip.
  const tipsToThumb = [8, 12, 16, 20].map((t) => d(lm(t), lm(4)) / palm);
  if (Math.max(...tipsToThumb) < 0.45 && !ext[1] && !ext[2]) {
    return { label: "O", kind: "letter", confidence: clamp(1 - Math.max(...tipsToThumb)) };
  }

  // F: thumb and index tips touch, other three fingers up.
  if (d(lm(4), lm(8)) / palm < 0.3 && ext[2] && ext[3] && ext[4]) {
    return { label: "F", kind: "letter", confidence: clamp(certainty * 0.6 + (1 - d(lm(4), lm(8)) / palm) * 0.4) };
  }
  // C: fingers half-curved together, thumb opposite with an open gap.
  const half = scores.slice(1).every((s) => s > 0.2 && s < 0.8);
  const gap = d(lm(4), lm(8)) / palm;
  if (half && gap > 0.45 && gap < 1.2 && d(lm(8), lm(20)) / palm < 0.9) {
    return { label: "C", kind: "letter", confidence: clamp(0.55 + (1 - Math.abs(gap - 0.8)) * 0.35) };
  }

  const key = ext.map((e) => (e ? 1 : 0)).join("");
  let label: string | null = null;
  let kind: Classification["kind"] = "letter";
  switch (key) {
    case "00000":
    case "10000":
      label = lm(4).y < lm(6).y ? "A" : "S";
      break;
    case "01000": label = "D"; break;
    case "11000": label = "L"; break;
    case "01100": label = d(lm(8), lm(12)) / palm > 0.35 ? "V" : "U"; break;
    case "01110": label = "W"; break;
    case "00001": label = "I"; break;
    case "10001": label = "Y"; break;
    case "11001": label = "I love you"; kind = "word"; break;
    case "01111": label = "B"; break;
    case "11111": label = "5"; break;
  }
  return { label, kind, confidence: label ? certainty : certainty * 0.5 };
}
