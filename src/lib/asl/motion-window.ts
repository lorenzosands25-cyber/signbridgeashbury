// Discard evidence from a different handshape immediately, rather than waiting
// for the previous movement to age out of the rolling video window.
export function updateMotionWindow<T extends { t: number }>(frames: T[], next: T, shapeKey: (frame: T) => string): T[] {
  const previous = frames[frames.length - 1];
  if (!previous || !Number.isFinite(next.t) || next.t <= previous.t || next.t - previous.t > 500 || shapeKey(previous) !== shapeKey(next)) return [next];
  return [...frames.filter((frame) => next.t - frame.t < 1200), next];
}