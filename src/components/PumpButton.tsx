import { useCallback, useRef, useState } from "react";
import { useGameStore } from "../state/store";
import { playUiClick } from "../audio/soundMap";
import { FormattedNumberInline } from "./FormattedNumber";
import { useT } from "../i18n";
import { CLICKER_TUNING } from "../game/clickerEconomy";

interface FloatText {
  id: number;
  value: number;
  x: number;
  y: number;
}

export default function PumpButton() {
  const t = useT();
  const registerClick = useGameStore((s) => s.registerClick);
  const runCharge = useGameStore((s) => s.runCharge);
  const clickCombo = useGameStore((s) => s.clickCombo);
  const arcSurgeUntil = useGameStore((s) => s.arcSurgeUntil);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const nextId = useRef(0);
  const surgeActive = arcSurgeUntil > Date.now();

  const onPump = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const gain = registerClick(Date.now());
      playUiClick();
      const id = nextId.current++;
      setFloats((prev) => [...prev.slice(-8), { id, value: gain, x, y }]);
      window.setTimeout(() => {
        setFloats((prev) => prev.filter((f) => f.id !== id));
      }, 700);
      try {
        navigator.vibrate?.(1);
      } catch {
        /* unsupported */
      }
    },
    [registerClick]
  );

  const chargePct = Math.round(
    (runCharge / CLICKER_TUNING.runChargeMax) * 100
  );

  return (
    <div className="relative">
      <button
        type="button"
        onPointerDown={onPump}
        className={`relative flex h-28 w-full select-none flex-col items-center justify-center rounded-2xl border-2 font-display text-lg font-bold transition-transform active:scale-95 sm:h-32 ${
          surgeActive
            ? "border-amber-300 bg-gradient-to-b from-amber-500/40 to-orange-600/30 text-amber-100 shadow-[0_0_40px_-5px_rgba(251,191,36,0.8)]"
            : "border-brand-400/60 bg-gradient-to-b from-brand-500/25 to-slate-800/80 text-brand-200 shadow-lg"
        }`}
        aria-label={t.workshop.pumpLabel}
      >
        <span className="text-4xl sm:text-5xl" aria-hidden>
          🪀
        </span>
        <span className="mt-1 text-xs uppercase tracking-widest text-slate-300">
          {t.workshop.pumpLabel}
        </span>
        {clickCombo.count > 1 && (
          <span className="absolute right-2 top-2 rounded-full bg-brand-500/80 px-2 py-0.5 text-[10px] font-semibold text-white">
            {t.workshop.clickStreak} {clickCombo.count}
          </span>
        )}
      </button>
      {floats.map((f) => (
        <span
          key={f.id}
          className="pointer-events-none absolute z-20 animate-[float-up_0.7s_ease-out_forwards] text-sm font-bold text-brand-200"
          style={{ left: f.x, top: f.y }}
        >
          +<FormattedNumberInline value={f.value} />
        </span>
      ))}
      <div className="mt-2">
        <div className="mb-0.5 flex justify-between text-[9px] uppercase tracking-wider text-slate-500">
          <span>{t.workshop.runCharge}</span>
          <span>{chargePct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-amber-400/90 transition-all duration-150"
            style={{ width: `${chargePct}%` }}
          />
        </div>
      </div>
    </div>
  );
}