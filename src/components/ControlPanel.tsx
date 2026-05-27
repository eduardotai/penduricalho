import { useGameStore } from "../state/store";
import { useEquippedAttachment, useEquippedPendulum, useEquippedSite } from "../state/selectors";

interface ControlPanelProps {
  onOpenCustomize: () => void;
}

export default function ControlPanel({ onOpenCustomize }: ControlPanelProps) {
  const isRunning = useGameStore((s) => s.isRunning);
  const startRun = useGameStore((s) => s.startRun);
  const pendulum = useEquippedPendulum();
  const attachment = useEquippedAttachment();
  const site = useEquippedSite();

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center p-6">
      <div className="pointer-events-auto flex flex-col items-stretch gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/85 p-3 shadow-xl backdrop-blur">
        <div className="px-2 pt-1 pb-2 text-center">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Loadout</div>
          <div className="text-xs text-slate-300">
            {pendulum.name}
            <span className="text-slate-600"> · </span>
            {attachment.name}
            <span className="text-slate-600"> · </span>
            {site.name}
          </div>
        </div>

        <button
          onClick={() => {
            if (isRunning) return;
            startRun();
          }}
          disabled={isRunning}
          className={`group relative w-72 overflow-hidden rounded-xl px-6 py-4 font-display text-lg font-bold uppercase tracking-wider transition-all ${
            isRunning
              ? "cursor-not-allowed bg-slate-800 text-slate-500"
              : "bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg hover:shadow-brand-500/30 active:scale-[0.98]"
          }`}
        >
          {isRunning ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-300" />
              Running...
            </span>
          ) : (
            "Start Run"
          )}
        </button>

        <button
          onClick={onOpenCustomize}
          className="w-72 rounded-xl border border-slate-700 bg-slate-900/70 px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800"
        >
          Customize
        </button>
      </div>
    </div>
  );
}
