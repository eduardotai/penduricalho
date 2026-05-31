import { useEffect, useState } from "react";
import { useGameStore } from "../state/store";
import { FormattedNumber } from "./FormattedNumber";
import { useT } from "../i18n";

const VISIBLE_MS = 6000;

/** Compact human duration for the away span, e.g. "2h 13m", "45s". */
function humanizeDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

/**
 * "While you were away" banner. Surfaces the Momentum the idle engine banked
 * while the tab was hidden / the page was closed. Driven by the store's
 * transient `lastIdleReport` (its `seq` re-triggers the banner on each award).
 */
export default function IdleToast() {
  const report = useGameStore((s) => s.lastIdleReport);
  const t = useT();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!report) return;
    setShown(true);
    const id = window.setTimeout(() => setShown(false), VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [report?.seq]);

  if (!report || !shown) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="pointer-events-auto rounded-xl border border-amber-300/40 bg-slate-900/90 px-4 py-2 text-center shadow-lg backdrop-blur-sm">
        <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-amber-300/80">
          {t.idle.whileAway}
        </div>
        <div className="mt-0.5 text-lg font-bold text-amber-200">
          <FormattedNumber value={report.momentum} prefix="+" /> {t.idle.momentumWord}
        </div>
        <div className="text-[0.7rem] text-slate-400">
          {t.idle.overIdle(humanizeDuration(report.ms))}
        </div>
      </div>
    </div>
  );
}
