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
import Window from "./ui/Window";
import { Lock, Sparkles } from "lucide-react";

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
    }
  }, [open]);

  if (!open) return null;

  const allTime = allTimeMomentum(lifetime, cycle);
  const gain = prestigeGain(allTime, cogs);
  const allowed = canPrestige(allTime, cogs) && !isRunning;
  const nowMult = prestigeMult(cogs);
  const afterMult = prestigeMult(cogs + gain);
  const nextAt = momentumForTotalCogs(totalCogsFor(allTime) + 1);
  const fmt = (n: number) => formatNumber(n, "short", lang);

  return (
    <Window
      open={open}
      onClose={onClose}
      title={p.title}
      subtitle={p.subtitle}
      icon={Sparkles}
      code="03 / FORGE"
      closeLabel={p.close}
      sizeClass="sm:h-auto sm:max-h-[min(760px,92vh)] sm:max-w-xl"
      testId="prestige-dialog"
    >

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label={p.cogs} value={cogs.toString()} accent />
            <Stat label={p.currentBonus} value={fmtMult(nowMult)} accent />
            <Stat label={p.resets} value={count.toString()} />
            <Stat label={p.allTime} value={fmt(allTime)} />
            <Stat label={p.gainNow} value={`+${gain}`} accent={gain > 0} />
            <Stat label={p.newBonus} value={fmtMult(afterMult)} accent={gain > 0} />
          </div>
          <p className="mt-2 font-mono text-[10px] text-slate-500">{p.nextCogAt(fmt(nextAt))}</p>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ListBox title={p.resetsTitle} items={p.resetsList} tone="reset" />
            <ListBox title={p.keepsTitle} items={p.keepsList} tone="keep" />
          </div>

          {doneMsg && (
            <p className="card mt-3 border-emerald-500/50 p-3 text-sm text-emerald-200">
              {doneMsg}
            </p>
          )}

          {!allowed && !doneMsg && (
            <p className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
              <Lock size={12} aria-hidden />
              {isRunning
                ? p.lockedRun
                : p.lockedMin(fmt(Math.max(PRESTIGE_TUNING.minAllTimeMomentum, nextAt)))}
            </p>
          )}

          {confirming ? (
            <div className="hazard mt-3 rounded-xl border border-amber-500/60 p-3" data-testid="prestige-confirm">
              <div className="rounded-lg bg-slate-950/85 p-3">
              <p className="font-display text-sm font-bold uppercase tracking-wide text-amber-200">{p.confirmTitle}</p>
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
                  className="key key-gold min-h-[44px] flex-1 px-4 text-sm"
                >
                  {p.confirm}
                </button>
                <button
                  onClick={() => {
                    playUiClick();
                    setConfirming(false);
                  }}
                  className="key key-ghost min-h-[44px] flex-1 px-4 text-sm"
                >
                  {p.cancel}
                </button>
              </div>
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
              className={`key ${allowed ? "key-primary" : ""} mt-3 min-h-[52px] w-full px-4 text-sm`}
            >
              {p.action(gain)}
            </button>
          )}
    </Window>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="readout px-3 py-2">
      <div className="silk text-[9px]">{label}</div>
      <div className={`font-mono text-lg font-bold ${accent ? "readout-digits" : "text-slate-100"}`}>
        {value}
      </div>
    </div>
  );
}

function ListBox({ title, items, tone }: { title: string; items: string[]; tone: "reset" | "keep" }) {
  return (
    <div
      className={`card p-3 ${tone === "reset" ? "border-rose-500/35" : "border-emerald-500/35"}`}
    >
      <h3 className={`silk silk-tick mb-1.5 ${tone === "reset" ? "!text-rose-300" : "!text-emerald-300"}`}>
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
