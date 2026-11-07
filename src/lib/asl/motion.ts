// Body-aware, movement-based ASL sign detection.
// Combines MediaPipe Pose (face + shoulders) with hand landmarks to know WHERE
// a hand is on the body (forehead, chin, chest) and HOW it moves over ~1s.
// Rules are a hand-written MVP for a few common signs; a trained sequence model
// (e.g. on WLASL) can replace `detectMotionSign` with the same output shape.

export type Shape = "open" | "fist" | "index" | "other";
export type Pt = { x: number; y: number };

/** Body reference frame for one video frame, in pixel-like units. */
export type Body = { sw: number; mouth: Pt; forehead: Pt; shoulderMid: Pt };

export type Frame = { t: number; shape: Shape; palm: Pt; tip: Pt; indexTip: Pt; body: Body };

export type MotionResult = { label: string; confidence: number } | null;

export const MOTION_SIGNS = ["Please", "Sorry", "Thank you", "Hello", "Yes", "Me"] as const;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export function zoneOf(p: Pt, b: Body): "forehead" | "chin" | "chest" | "neutral" {
  if (dist(p, b.forehead) < 0.45 * b.sw) return "forehead";
  if (dist(p, b.mouth) < 0.4 * b.sw) return "chin";
  const dy = (p.y - b.shoulderMid.y) / b.sw;
  if (dy > 0.05 && dy < 1.1 && Math.abs(p.x - b.shoulderMid.x) < 0.65 * b.sw) return "chest";
  return "neutral";
}

const frac = (fs: Frame[], f: (x: Frame) => boolean) => fs.filter(f).length / Math.max(1, fs.length);
const pathLen = (fs: Frame[], pick: (x: Frame) => Pt) => {
  let s = 0;
  for (let i = 1; i < fs.length; i++) {
    const current = fs[i], previous = fs[i - 1];
    if (current && previous) s += dist(pick(current), pick(previous)) / current.body.sw;
  }
  return s;
};

/** Is the hand currently inside a body zone where letters shouldn't be read? */
export function inBodyZone(f: Frame) {
  return zoneOf(f.palm, f.body) === "chest" || zoneOf(f.tip, f.body) !== "neutral";
}

export function detectMotionSign(fs: Frame[]): MotionResult {
  const first = fs[0], last = fs[fs.length - 1];
  if (fs.length < 12 || !first || !last || last.t - first.t < 600 || fs.some((f) => !Number.isFinite(f.body.sw) || f.body.sw <= 0)) return null;
  const n = fs.length;
  const head = fs.slice(0, Math.ceil(n * 0.3));
  const tail = fs.slice(Math.floor(n * 0.7));
  const onChest = (f: Frame) => zoneOf(f.palm, f.body) === "chest";
  const travel = pathLen(fs, (f) => f.palm);
  // Circular chest signs need real two-axis movement, not a resting hand or jitter.
  const xs = fs.map((f) => (f.palm.x - f.body.shoulderMid.x) / f.body.sw);
  const ys = fs.map((f) => (f.palm.y - f.body.shoulderMid.y) / f.body.sw);
  const circular = travel > 0.4 && Math.max(...xs) - Math.min(...xs) > 0.12 && Math.max(...ys) - Math.min(...ys) > 0.12 && dist(first.palm, last.palm) / last.body.sw < travel * 0.65;

  // THANK YOU: open hand fingertips at chin, then moves forward/down away from mouth.
  if (frac(head, (f) => f.shape === "open" && zoneOf(f.tip, f.body) === "chin") > 0.5) {
    if (frac(tail, (f) => f.shape === "open") > 0.5 && dist(last.tip, last.body.mouth) > 0.6 * last.body.sw && last.tip.y > last.body.mouth.y)
      return { label: "Thank you", confidence: 0.88 };
  }
  // HELLO: flat hand at forehead, then moves outward.
  if (frac(head, (f) => f.shape === "open" && zoneOf(f.tip, f.body) === "forehead") > 0.5) {
    const outward = Math.abs(last.tip.x - last.body.forehead.x) - Math.abs(first.tip.x - first.body.forehead.x);
    if (outward > 0.5 * last.body.sw && frac(tail, (f) => f.shape === "open") > 0.5)
      return { label: "Hello", confidence: 0.85 };
  }
  // PLEASE: flat hand on chest (usually circling).
  if (frac(fs, (f) => f.shape === "open" && onChest(f)) > 0.7 && circular) {
    return { label: "Please", confidence: Math.min(0.95, 0.76 + Math.min(1, travel / 0.6) * 0.19) };
  }
  // SORRY: fist circling on chest.
  if (frac(fs, (f) => f.shape === "fist" && onChest(f)) > 0.7 && circular) {
    return { label: "Sorry", confidence: Math.min(0.92, 0.76 + Math.min(1, travel / 0.6) * 0.16) };
  }
  // ME: index finger pointing at own chest.
  if (frac(fs, (f) => f.shape === "index" && zoneOf(f.indexTip, f.body) === "chest") > 0.75 && travel < 0.4) {
    return { label: "Me", confidence: 0.8 };
  }
  // YES: fist nodding up and down in front of the body.
  if (frac(fs, (f) => f.shape === "fist" && !onChest(f)) > 0.7) {
    let turns = 0, dir = 0, amp = 0;
    for (let i = 1; i < n; i++) {
      const current = fs[i], previous = fs[i - 1];
      if (!current || !previous) continue;
      const dy = current.palm.y - previous.palm.y;
      const sw = current.body.sw;
      if (Math.abs(dy) < 0.01 * sw) continue;
      const s = Math.sign(dy);
      if (dir && s !== dir) turns++;
      dir = s;
      amp = Math.max(amp, Math.abs(current.palm.y - first.palm.y) / sw);
    }
    if (turns >= 2 && amp > 0.08) return { label: "Yes", confidence: 0.8 };
  }
  return null;
}
