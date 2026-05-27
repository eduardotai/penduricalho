import { useEffect, useState } from "react";
import { useGameStore } from "../state/store";
import { MODIFIER_MAP } from "../data/modifiers";
import { getRemainingMs } from "../game/modifiers";

function formatNumber(n: number): string {
  if (n < 1000) return n.toFixed(0);
  if (n < 1_000_000) return (n / 1000).toFixed(2) + "K";
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(2) + "M";
  return (n / 1_000_000_000).toFixed(2) + "B";
}

export default function HUD() {
  const momentum = useGameStore((s) => s.momentum);
  const activeModifiers = useGameStore((s) => s.activeModifiers);
  const combo = useGameStore((s) => s.combo);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const comboWindow = 1800;
  const sinceHit = now - combo.lastHitAt;
  const comboActive = combo.count > 1 && sinceHit < comboWindow;
  const comboDecayPct = Math.max(0, Math.min(1, 1 - sinceHit / comboWindow));

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <div className="pointer-events-none flex items-start justify-between p-5">
        <div className="rounded-2xl bg-slate-900/70 px-5 py-3 backdrop-blur">
          <div className="text-xs uppercase tracking-widest text-slate-400">Momentum</div>
          <div className="font-display text-3xl font-bold text-brand-300">
            {formatNumber(momentum)}
          </div>
        </div>

        {comboActive && (
          <div className="rounded-2xl bg-amber-500/20 px-5 py-3 text-right backdrop-blur">
            <div className="text-xs uppercase tracking-widest text-amber-200/80">Combo</div>
            <div className="font-display text-3xl font-bold text-amber-200">
              x{combo.count}
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded bg-amber-900/50">
              <div
                className="h-full bg-amber-300 transition-[width] duration-100 ease-linear"
                style={{ width: `${comboDecayPct * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-none flex flex-1 items-end justify-start p-5">
        <div className="flex flex-wrap gap-2">
          {activeModifiers.map((m) => {
            const def = MODIFIER_MAP.get(m.defId);
            if (!def) return null;
            const remaining = getRemainingMs(m, now);
            const pct = Math.max(0, Math.min(1, remaining / def.durationMs));
            return (
              <div
                key={m.defId}
                className="flex items-center gap-2 rounded-lg bg-slate-900/80 px-3 py-2 text-sm backdrop-blur"
                title={def.description}
              >
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: def.color }}
                />
                <span className="font-medium text-slate-100">{def.name}</span>
                <div className="relative h-1.5 w-16 overflow-hidden rounded bg-slate-700">
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{ width: `${pct * 100}%`, background: def.color }}
                  />
                </div>
                <span className="text-xs text-slate-400">
                  {(remaining / 1000).toFixed(1)}s
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Hint />
    </div>
  );
}

function Hint() {
  const stats = useGameStore((s) => s.stats);
  if (stats.totalSwings > 4) return null;
  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-slate-900/80 px-4 py-2 text-sm text-slate-300 backdrop-blur">
      Drag the bob to twist it. Click for a tangential nudge. Land hits on the blue zones.
    </div>
  );
}
