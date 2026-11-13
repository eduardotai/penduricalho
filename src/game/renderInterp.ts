/**
 * Render interpolation for high-refresh screens.
 *
 * Physics runs on Matter.Runner's fixed 60 Hz step (its own time accumulator).
 * On a 120/144 Hz screen most animation frames land between two steps, so
 * drawing the raw body positions makes motion advance in uneven jumps (1, 0,
 * 1, 1, 0 ... steps per frame). Here we draw each moving body at
 * `prev + (cur - prev) * alpha`, with alpha being how far the runner's leftover
 * time buffer reaches into the next step.
 *
 * Physics is never changed: positions are written only for the draw calls and
 * restored bit-for-bit right after (`restoreBodies`), before any other code
 * runs. Matter's integrator state (positionPrev, velocity, vertices) is never
 * touched.
 */

export interface InterpBody {
  position: { x: number; y: number };
  angle: number;
  isStatic: boolean;
}

interface Pose {
  x: number;
  y: number;
  angle: number;
}

/** Pose of every moving body just before the latest physics step. */
export type InterpSnapshot = Map<InterpBody, Pose>;

export function createInterpSnapshot(): InterpSnapshot {
  return new Map();
}

/** Call from the engine's `beforeUpdate` so it holds the pre-step poses. */
export function snapshotBodies(bodies: readonly InterpBody[], snap: InterpSnapshot): void {
  snap.clear();
  for (const b of bodies) {
    if (b.isStatic) continue;
    snap.set(b, { x: b.position.x, y: b.position.y, angle: b.angle });
  }
}

/**
 * Matter's Runner (0.20) steps while `timeBuffer >= delta * margin` (margin
 * 1.5), so the leftover buffer after a tick sits in [ (margin-1)·delta,
 * margin·delta ). Map that window onto [0, 1].
 */
export function interpolationAlpha(timeBuffer: number, delta: number, margin = 1.5): number {
  if (!(delta > 0) || !Number.isFinite(timeBuffer)) return 1;
  const a = (timeBuffer - (margin - 1) * delta) / delta;
  return a <= 0 ? 0 : a >= 1 ? 1 : a;
}

/**
 * Alpha straight from a Matter 0.20 Runner (`timeBuffer` and `delta` are
 * missing from the 0.19 typings). Falls back to 1 (no interpolation, raw
 * poses) if the runner doesn't expose them.
 */
export function runnerAlpha(runner: object): number {
  const r = runner as { timeBuffer?: unknown; delta?: unknown };
  if (typeof r.timeBuffer !== "number" || typeof r.delta !== "number") return 1;
  return interpolationAlpha(r.timeBuffer, r.delta);
}

interface Saved {
  body: InterpBody;
  x: number;
  y: number;
  angle: number;
}

/**
 * Move each snapshotted body to its interpolated pose for drawing. Returns what
 * to hand back to `restoreBodies`. Bodies that jumped further than `maxJump`
 * since the snapshot (teleports: token re-launch, rest-pose pin, world reset)
 * are drawn where they are.
 */
export function applyInterpolation(
  snap: InterpSnapshot,
  alpha: number,
  maxJump: number
): Saved[] {
  const saved: Saved[] = [];
  if (alpha >= 1) return saved;
  const maxJump2 = maxJump * maxJump;
  for (const [body, prev] of snap) {
    const cx = body.position.x;
    const cy = body.position.y;
    const ca = body.angle;
    const dx = cx - prev.x;
    const dy = cy - prev.y;
    if (dx === 0 && dy === 0 && ca === prev.angle) continue;
    if (dx * dx + dy * dy > maxJump2) continue;
    saved.push({ body, x: cx, y: cy, angle: ca });
    body.position.x = prev.x + dx * alpha;
    body.position.y = prev.y + dy * alpha;
    body.angle = prev.angle + (ca - prev.angle) * alpha;
  }
  return saved;
}

/** Put the real physics poses back exactly (call in a `finally`). */
export function restoreBodies(saved: readonly Saved[]): void {
  for (let i = saved.length - 1; i >= 0; i--) {
    const s = saved[i];
    s.body.position.x = s.x;
    s.body.position.y = s.y;
    s.body.angle = s.angle;
  }
}
