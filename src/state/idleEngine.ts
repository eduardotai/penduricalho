import { useGameStore } from "./store";

// ---------------------------------------------------------------------------
// Idle / background accrual engine
//
// Browsers freeze `requestAnimationFrame` (and throttle main-thread timers to
// ~1/min) when a tab is hidden, so the live physics + scoring loop in
// GameCanvas stops the moment the player tabs away. Faithfully *simulating* a
// pendulum at that cadence is pointless (a swing stepped at 1s intervals just
// explodes), so instead we keep the *core idle gameplay* going: the pendulum
// keeps banking Momentum at the rate it was recently earning.
//
// Three timing sources cover every "away" case:
//   1. A Web Worker heartbeat — its timer keeps firing in a backgrounded tab
//      where main-thread setInterval is throttled/paused, so Momentum visibly
//      ticks up while hidden.
//   2. The `visibilitychange` event — anchors the clock on hide and credits the
//      final partial stretch (with a toast) on return.
//   3. A wall-clock reconcile on load — grants offline earnings for time the
//      page was fully closed (e.g. the machine slept). Uncapped by design.
//
// Earnings are credited only for time genuinely spent away, and only when the
// session is "live": a run is in progress, or Auto-Run is on (the pendulum is
// meant to keep launching). Foreground time is never idle-credited — the real
// simulation already scores it.
// ---------------------------------------------------------------------------

const HEARTBEAT_MS = 1000;
// While visible and running, resample the live earn rate this often.
const SAMPLE_MS = 1500;
// EMA weight for each fresh rate sample (higher = more reactive, less smooth).
const RATE_EMA_ALPHA = 0.25;
// Minimum away span worth surfacing a "while you were away" toast.
const MIN_REPORT_MS = 10_000;

function now(): number {
  return Date.now();
}

/**
 * Spin up a heartbeat that fires `onTick` roughly every HEARTBEAT_MS, even when
 * the tab is backgrounded. A Web Worker is preferred because its timers survive
 * background throttling far better than the main thread's; we fall back to
 * setInterval if Workers or blob URLs are unavailable.
 */
function makeHeartbeat(onTick: () => void): () => void {
  try {
    const src = `let id=setInterval(function(){postMessage(0)},${HEARTBEAT_MS});onmessage=function(e){if(e.data==='stop'){clearInterval(id);close();}}`;
    const blob = new Blob([src], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    worker.onmessage = () => onTick();
    return () => {
      try {
        worker.postMessage("stop");
      } catch {
        /* worker may already be gone */
      }
      worker.terminate();
      URL.revokeObjectURL(url);
    };
  } catch {
    const handle = window.setInterval(onTick, HEARTBEAT_MS);
    return () => window.clearInterval(handle);
  }
}

/**
 * Start the idle engine. Returns a cleanup function. Safe to call repeatedly
 * (e.g. under React StrictMode's double-mount): each call owns its own state
 * and heartbeat, and crediting is idempotent against `lastActiveAt`.
 */
export function startIdleEngine(): () => void {
  const store = useGameStore;

  // When the tab went hidden (null while foreground), and how much of that
  // hidden span we've already credited — so heartbeat ticks credit only the
  // *new* slice each time.
  let hiddenAt: number | null = null;
  let creditedMs = 0;
  // Carries the sub-1 Momentum remainder between credits so a low earn rate
  // (e.g. 0.4/s) still accumulates instead of flooring to zero every tick.
  let earnAcc = 0;

  // Foreground rate-sampling state.
  let sampleAt = 0;
  let sampleTotal = 0;

  function resetSample() {
    sampleAt = 0;
    sampleTotal = 0;
  }

  function sampleRate(t: number) {
    const s = store.getState();
    // Only measure from live, foreground play; otherwise the rate would decay
    // toward zero during menus / between runs.
    if (document.hidden || !s.isRunning) {
      resetSample();
      return;
    }
    const total = s.stats.totalMomentum;
    if (sampleAt === 0) {
      sampleAt = t;
      sampleTotal = total;
      return;
    }
    const dt = t - sampleAt;
    if (dt < SAMPLE_MS) return;
    const inst = Math.max(0, (total - sampleTotal) / (dt / 1000));
    const prev = s.idleRatePerSec;
    const next =
      prev <= 0 ? inst : prev * (1 - RATE_EMA_ALPHA) + inst * RATE_EMA_ALPHA;
    s.setIdleRate(next);
    sampleAt = t;
    sampleTotal = total;
  }

  function eligible(): boolean {
    const s = store.getState();
    return s.idleRatePerSec > 0 && (s.isRunning || s.autoRun);
  }

  // Credit `ms` of away time at the current rate. `reportMs` (>0) raises the
  // toast for that total span.
  function creditAway(ms: number, reportMs: number) {
    if (ms <= 0) return;
    const s = store.getState();
    if (!eligible()) return;
    earnAcc += s.idleRatePerSec * (ms / 1000);
    const gain = Math.floor(earnAcc);
    earnAcc -= gain;
    s.applyIdleEarnings(gain, reportMs >= MIN_REPORT_MS ? reportMs : 0);
  }

  function tick() {
    const t = now();
    sampleRate(t);
    if (hiddenAt != null) {
      const total = t - hiddenAt;
      const fresh = total - creditedMs;
      if (fresh > 0) {
        creditAway(fresh, 0); // incremental — never toasts
        creditedMs = total;
      }
    } else {
      // Foreground: keep the persisted offline clock fresh so a later reload
      // measures away-time from "just now", not from minutes ago.
      store.getState().touchActive(t);
    }
  }

  function onHide() {
    hiddenAt = now();
    creditedMs = 0;
  }

  function onShow() {
    if (hiddenAt != null) {
      const total = now() - hiddenAt;
      creditAway(total - creditedMs, total);
      hiddenAt = null;
      creditedMs = 0;
    }
    store.getState().touchActive(now());
  }

  function onVisibility() {
    if (document.hidden) onHide();
    else onShow();
  }

  // Persist a fresh clock (and credit any pending hidden tail) right before the
  // page unloads, so offline reconcile on next load measures from here.
  function flush() {
    if (hiddenAt != null) {
      const total = now() - hiddenAt;
      creditAway(total - creditedMs, 0);
      creditedMs = total;
    }
    store.getState().touchActive(now());
  }

  // --- Offline-on-load reconcile --------------------------------------------
  // The page was closed; nothing ran. If Auto-Run was left on and we have a
  // measured rate, grant earnings for the whole gap. isRunning is never
  // persisted, so Auto-Run is the standing signal that the pendulum should have
  // kept going.
  function reconcileOnLoad() {
    const t = now();
    const s = store.getState();
    const last = s.lastActiveAt;
    if (last && s.autoRun && s.idleRatePerSec > 0) {
      const elapsed = t - last;
      if (elapsed > 0) {
        const amount = s.idleRatePerSec * (elapsed / 1000);
        s.applyIdleEarnings(amount, elapsed >= MIN_REPORT_MS ? elapsed : 0);
        return;
      }
    }
    s.touchActive(t);
  }

  reconcileOnLoad();
  if (document.hidden) onHide();

  const stopHeartbeat = makeHeartbeat(tick);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);

  return () => {
    stopHeartbeat();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", flush);
    window.removeEventListener("beforeunload", flush);
    flush();
  };
}
