import type { Frame, MotionResult, Pt } from "./motion";

// Experimental, guided-practice-only rules. Not a trained ASL classifier.
export type PairedFrame = { t: number; left: Frame; right: Frame };
const distance = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const portion = (fs: PairedFrame[], check: (f: PairedFrame) => boolean) => fs.filter(check).length / fs.length;

export function detectTwoHandSign(fs: PairedFrame[], target: string): MotionResult {
  const first = fs[0], last = fs[fs.length - 1];
  if (!first || !last || fs.length < 12 || last.t - first.t < 600) return null;
  if (fs.some((f, i) => !Number.isFinite(f.t) || (i > 0 && f.t - (fs[i - 1]?.t ?? f.t) > 500) || (i > 0 && f.t <= (fs[i - 1]?.t ?? f.t)) || [f.left, f.right].some((h) => !Number.isFinite(h.body.sw) || h.body.sw <= 0 || [h.palm, h.tip, h.indexTip].some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))))) return null;
  const sw = last.left.body.sw;
  // Work in body-relative coordinates so camera/body movement alone cannot match.
  const relative = (h: Frame) => ({ x: (h.palm.x - h.body.shoulderMid.x) / h.body.sw, y: (h.palm.y - h.body.shoulderMid.y) / h.body.sw });
  const supportFlat = (h: Frame) => h.shape === "open" && Math.abs(h.palmNormal?.y ?? 0) > 0.65;

  if (target === "Help") {
    for (const dominant of ["left", "right"] as const) {
      const support = dominant === "left" ? "right" : "left";
      const match = (f: PairedFrame) => f[dominant].shape === "fist" && f[dominant].thumbUp === true && supportFlat(f[support]) && distance(f[dominant].palm, f[support].palm) / f[dominant].body.sw < 0.4 && f[dominant].palm.y <= f[support].palm.y;
      const a = relative(first[dominant]), b = relative(last[dominant]);
      const sa = relative(first[support]), sb = relative(last[support]);
      if (portion(fs, match) > 0.85 && a.y - b.y > 0.18 && sa.y - sb.y > 0.18 && Math.abs((a.y - b.y) - (sa.y - sb.y)) < 0.12 && Math.abs(a.x - b.x) < 0.2) return { label: "Help", confidence: 0.78 };
    }
  }
  if (target === "Nice / Clean") {
    for (const dominant of ["left", "right"] as const) {
      const support = dominant === "left" ? "right" : "left";
      const match = (f: PairedFrame) => supportFlat(f[support]) && f[dominant].shape === "open" && distance(f[dominant].palm, f[support].palm) / f[dominant].body.sw < 0.55 && Math.abs(f[dominant].palm.y - f[support].palm.y) / f[dominant].body.sw < 0.18;
      const supportPoints = fs.map((f) => relative(f[support]));
      const sweep = fs.map((f) => (f[dominant].palm.x - f[support].palm.x) / f[dominant].body.sw);
      if (portion(fs, match) > 0.85 && Math.max(...sweep) - Math.min(...sweep) > 0.35 && Math.max(...supportPoints.map((p) => p.x)) - Math.min(...supportPoints.map((p) => p.x)) < 0.12 && Math.max(...supportPoints.map((p) => p.y)) - Math.min(...supportPoints.map((p) => p.y)) < 0.12) return { label: "Nice / Clean", confidence: 0.76 };
    }
  }
  if (target === "Meet") {
    const match = (f: PairedFrame) => f.left.shape === "index" && f.right.shape === "index" && f.left.indexTip.y < f.left.palm.y - 0.12 * f.left.body.sw && f.right.indexTip.y < f.right.palm.y - 0.12 * f.right.body.sw;
    const startGap = distance(first.left.palm, first.right.palm) / first.left.body.sw;
    const endGap = distance(last.left.palm, last.right.palm) / sw;
    const l0 = relative(first.left), l1 = relative(last.left), r0 = relative(first.right), r1 = relative(last.right);
    if (portion(fs, match) > 0.9 && startGap - endGap > 0.3 && endGap < 0.3 && Math.abs(l1.x - l0.x) > 0.1 && Math.abs(r1.x - r0.x) > 0.1 && (l1.x - l0.x) * (r1.x - r0.x) < 0 && Math.abs(l1.y - r1.y) < 0.2) return { label: "Meet", confidence: 0.78 };
  }
  return null;
}