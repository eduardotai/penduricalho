import { useGameStore } from "../state/store";

export default function StatsPanel() {
  const stats = useGameStore((s) => s.stats);
  const momentum = useGameStore((s) => s.momentum);
  const owned = useGameStore((s) => s.owned);
  const reset = useGameStore((s) => s.reset);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Stats
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Momentum" value={momentum.toLocaleString()} />
          <Stat label="All Time" value={stats.totalMomentum.toLocaleString()} />
          <Stat label="Swings" value={stats.totalSwings.toLocaleString()} />
          <Stat label="Hits" value={stats.totalHits.toLocaleString()} />
          <Stat label="Best Combo" value={`x${stats.bestCombo}`} />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Collection
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Pendulums" value={`${owned.pendulums.length}`} />
          <Stat label="Attachments" value={`${owned.attachments.length}`} />
          <Stat label="Sites" value={`${owned.sites.length}`} />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Danger Zone
        </h3>
        <button
          onClick={() => {
            if (confirm("Reset all progress? This cannot be undone.")) reset();
          }}
          className="w-full rounded-lg border border-red-700/40 bg-red-900/30 px-3 py-2 text-sm font-semibold text-red-200 transition-colors hover:bg-red-900/50"
        >
          Reset Save
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">
        {label}
      </div>
      <div className="font-display text-sm font-semibold text-slate-100">
        {value}
      </div>
    </div>
  );
}
