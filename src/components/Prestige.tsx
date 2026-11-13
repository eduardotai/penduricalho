import { useEffect, useState } from "react";
import { useGameStore } from "../state/store";
import { playGameSound, playUiClick } from "../audio/soundMap";
import { formatNumber } from "../lib/formatNumber";
import {
  PRESTIGE_TUNING,
  allTimeMomentum,
  canPrestige,
  momentumForTotalCogs,
  prestigeGain,
  prestigeMult,
  totalCogsFor,
} from "../game/prestige";
import { useLang, useT } from "../i18n";

interface Props {
  open: boolean;
  onClose: () => void;
}

function fmtMult(m: number): string {
  return `×${m.toFixed(2)}`;
}

/** Prestige panel: shows the gain before resetting, with a confirm step. */
export default function Prestige({ open, onClose }: Props) {
  const t = useT();
  const p = t.prestige;
  const lang = useLang();
  const cogs = useGameStore((s) => s.prestigeCogs);
  const count = useGameStore((s) => s.prestigeCount);
  const lifetime = useGameStore((s) => s.prestigeLifetimeMomentum);
  const cycle = useGameStore((s) => s.stats.totalMomentum);
  const isRunning = useGameStore((s) => s.isRunning);
  const prestige = useGameStore((s) => s.prestige);
  const [confirming, setConfirming] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirming(false);
      setDoneMsg(null);
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const allTime = allTimeMomentum(lifetime, cycle);
  const gain = prestigeGain(allTime, cogs);
  const allowed = canPrestige(allTime, cogs) && !isRunning;
  const nowMult = prestigeMult(cogs);
  const afterMult = prestigeMult(cogs + gain);
  const nextAt = momentumForTotalCogs(totalCogsFor(allTime) + 1);
  const fmt = (n: number) => formatNumber(n, "short", lang);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4"
      data-no-camera-zoom
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={p.title}
        data-testid="prestige-dialog"
        className="relative flex max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-100">🌟 {p.title}</h2>
            <p className="text-xs text-slate-400">{p.subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-slate-700 px-4 text-sm text-slate-300 hover:bg-slate-800"
          >
            {p.close}
          </button>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label={p.cogs} value={cogs.toString()} accent />
            <Stat label={p.currentBonus} value={fmtMult(nowMult)} accent />
            <Stat label={p.resets} value={count.toString()} />
            <Stat label={p.allTime} value={fmt(allTime)} />
            <Stat label={p.gainNow} value={`+${gain}`} accent={gain > 0} />
            <Stat label={p.newBonus} value={fmtMult(afterMult)} accent={gain > 0} />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{p.nextCogAt(fmt(nextAt))}</p>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ListBox title={p.resetsTitle} items={p.resetsList} tone="reset" />
            <ListBox title={p.keepsTitle} items={p.keepsList} tone="keep" />
          </div>

          {doneMsg && (
            <p className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-3 text-sm text-emerald-200">
              {doneMsg}
            </p>
          )}

          {!allowed && !doneMsg && (
            <p className="mt-3 text-xs text-slate-400">
              {isRunning
                ? p.lockedRun
                : p.lockedMin(fmt(Math.max(PRESTIGE_TUNING.minAllTimeMomentum, nextAt)))}
            </p>
          )}

          {confirming ? (
            <div className="mt-3 rounded-xl border border-amber-500/50 bg-amber-950/30 p-4" data-testid="prestige-confirm">
              <p className="text-sm font-semibold text-amber-200">{p.confirmTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                {p.confirmBody(gain, fmtMult(afterMult))}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    playUiClick();
                    const got = prestige();
                    setConfirming(false);
                    if (got > 0) {
                      playGameSound("ui-buy");
                      setDoneMsg(p.done(got));
                    } else {
                      playGameSound("ui-error");
                    }
                  }}
                  disabled={!allowed}
                  className="min-h-[44px] flex-1 rounded-md bg-amber-500 px-4 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  {p.confirm}
                </button>
                <button
                  onClick={() => {
                    playUiClick();
                    setConfirming(false);
                  }}
                  className="min-h-[44px] flex-1 rounded-md border border-slate-700 px-4 text-sm text-slate-300 hover:bg-slate-800"
                >
                  {p.cancel}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                playUiClick();
                setDoneMsg(null);
                setConfirming(true);
              }}
              disabled={!allowed}
              className={`mt-3 min-h-[48px] w-full rounded-xl px-4 text-sm font-bold uppercase tracking-wide transition-colors ${
                allowed
                  ? "bg-brand-600 text-white hover:bg-brand-500"
                  : "cursor-not-allowed bg-slate-800 text-slate-500"
              }`}
            >
              {p.action(gain)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`font-display text-lg font-semibold ${accent ? "text-brand-300" : "text-slate-100"}`}>
        {value}
      </div>
    </div>
  );
}

function ListBox({ title, items, tone }: { title: string; items: string[]; tone: "reset" | "keep" }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        tone === "reset" ? "border-rose-500/30 bg-rose-950/20" : "border-emerald-500/30 bg-emerald-950/20"
      }`}
    >
      <h3 className={`mb-1 text-xs font-semibold uppercase tracking-widest ${tone === "reset" ? "text-rose-300" : "text-emerald-300"}`}>
        {title}
      </h3>
      <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-300">
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
