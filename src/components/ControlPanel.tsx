import { useEffect, useState } from "react";
import { useGameStore } from "../state/store";
import { useEquippedAttachment, useEquippedPendulum, useEquippedSite } from "../state/selectors";
import { playUiClick } from "../audio/soundMap";
import { AudioManager } from "../audio/AudioManager";

interface ControlPanelProps {
  onOpenCustomize: () => void;
  onOpenSettings: () => void;
}

export default function ControlPanel({ onOpenCustomize, onOpenSettings }: ControlPanelProps) {
  const isRunning = useGameStore((s) => s.isRunning);
  const runStalled = useGameStore((s) => s.runStalled);
  const totalRuns = useGameStore((s) => s.totalRuns);
  const startRun = useGameStore((s) => s.startRun);
  const hardEndAndRestartRun = useGameStore((s) => s.hardEndAndRestartRun);
  const [hardEndConfirmOpen, setHardEndConfirmOpen] = useState(false);
  const pendingGoldenTokens = useGameStore((s) => s.pendingGoldenTokens);
  const spendGoldenToken = useGameStore((s) => s.spendGoldenToken);
  const pendulum = useEquippedPendulum();
  const attachment = useEquippedAttachment();
  const site = useEquippedSite();

  const hasRunBefore = totalRuns > 0 || isRunning;
  const buttonLabel = hasRunBefore ? "Run Again" : "Start Run";
  const canLaunch = !isRunning || runStalled;

  const hasToken = pendingGoldenTokens > 0;
  const canSpendToken = hasToken && isRunning;

  useEffect(() => {
    if (!hardEndConfirmOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setHardEndConfirmOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hardEndConfirmOpen]);

  useEffect(() => {
    if (!canSpendToken) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.repeat) return;
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        spendGoldenToken();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSpendToken, spendGoldenToken]);

  return (
    <div className="pointer-events-auto w-full min-w-0">
      <div className="flex w-full flex-col items-stretch gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/85 p-3 shadow-xl backdrop-blur">
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

        {hasToken && (
          <button
            onClick={() => {
              if (!canSpendToken) return;
              AudioManager.unlock();
              playUiClick();
              spendGoldenToken();
            }}
            disabled={!canSpendToken}
            className={`group relative w-full overflow-hidden rounded-xl px-6 py-3 font-display text-base font-extrabold uppercase tracking-wider transition-all ${
              canSpendToken
                ? "animate-pulse bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 text-slate-900 shadow-[0_0_25px_-3px_rgba(250,204,21,0.85)] hover:shadow-[0_0_35px_-3px_rgba(250,204,21,1)] active:scale-[0.98]"
                : "cursor-not-allowed bg-yellow-900/40 text-yellow-200/60"
            }`}
            title={
              canSpendToken
                ? "Re-launch the pendulum with x3 points (G)"
                : "Use during a run to re-launch"
            }
          >
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/40 text-xs">
                  {pendingGoldenTokens}
                </span>
                Use Token
              </span>
              <span className="rounded bg-slate-900/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider">
                G
              </span>
            </span>
          </button>
        )}

        <button
          onClick={() => {
            if (!canLaunch) return;
            AudioManager.unlock();
            playUiClick();
            startRun();
          }}
          disabled={!canLaunch}
          className={`group relative w-full overflow-hidden rounded-xl px-6 py-4 font-display text-lg font-bold uppercase tracking-wider transition-all ${
            canLaunch
              ? "bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg hover:shadow-brand-500/30 active:scale-[0.98]"
              : "cursor-not-allowed bg-slate-800 text-slate-500"
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {isRunning && !runStalled && (
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-300" />
            )}
            {isRunning && !runStalled ? "Running..." : buttonLabel}
          </span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              AudioManager.unlock();
              playUiClick();
              onOpenCustomize();
            }}
            className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800"
          >
            Customize
          </button>
          <button
            onClick={() => {
              AudioManager.unlock();
              playUiClick();
              onOpenSettings();
            }}
            className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800"
          >
            Settings
          </button>
        </div>

        {hardEndConfirmOpen ? (
          <div className="w-full rounded-xl border border-rose-500/50 bg-rose-950/40 p-4">
            <p className="mb-3 text-xs leading-relaxed text-rose-100/90">
              {isRunning
                ? "End this run immediately and start fresh? Progress from the current swing is lost."
                : "Start a new run now? Any ready golden tokens will stay unless you spend them first."}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  hardEndAndRestartRun();
                  setHardEndConfirmOpen(false);
                }}
                className="w-full rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-rose-500"
              >
                End & Restart
              </button>
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  setHardEndConfirmOpen(false);
                }}
                className="w-full rounded-lg border border-slate-600 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              playUiClick();
              setHardEndConfirmOpen(true);
            }}
            className="w-full rounded-xl border border-rose-900/60 bg-rose-950/30 px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-rose-200 transition-colors hover:border-rose-600/60 hover:bg-rose-950/50"
          >
            Hard End Run
          </button>
        )}
      </div>
    </div>
  );
}
