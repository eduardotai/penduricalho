import { useGameStore } from "../state/store";
import { useT } from "../i18n";

/** Prompts the player to click the arena bob after arming a run. */
export default function ArenaClickHint() {
  const t = useT();
  const isRunning = useGameStore((s) => s.isRunning);
  const runStalled = useGameStore((s) => s.runStalled);
  const cookiePumpEpoch = useGameStore((s) => s.cookiePumpEpoch);

  if (!isRunning || runStalled) return null;
  if (cookiePumpEpoch > 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center p-4 md:pr-72 md:pl-80">
      <div className="max-w-xs rounded-2xl border border-brand-400/40 bg-slate-950/75 px-4 py-3 text-center shadow-xl backdrop-blur-md">
        <p className="font-display text-sm font-semibold text-brand-200">
          {t.workshop.clickBobTitle}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-slate-400">
          {t.workshop.clickBobHint}
        </p>
      </div>
    </div>
  );
}