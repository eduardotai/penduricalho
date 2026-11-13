import { useState } from "react";
import { GENERATORS } from "../data/generators";
import { CLICK_UPGRADES } from "../data/clickUpgrades";
import { useGameStore } from "../state/store";
import {
  clickUpgradeCost,
  generatorCost,
  meetsUnlock,
} from "../game/clickerEconomy";
import { FormattedNumberInline } from "./FormattedNumber";
import { playUiClick } from "../audio/soundMap";
import { useT } from "../i18n";
import { Hand, Lock, Wrench, Zap } from "lucide-react";
import { ContentIcon, ICON_STROKE } from "./ui/icons";

type Tab = "build" | "upgrades";

export default function WorkshopPanel() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("build");
  const momentum = useGameStore((s) => s.momentum);
  const stats = useGameStore((s) => s.stats);
  const generatorCounts = useGameStore((s) => s.generatorCounts);
  const clickUpgradeLevels = useGameStore((s) => s.clickUpgradeLevels);
  const cachedTotalCps = useGameStore((s) => s.cachedTotalCps);
  const buyGenerator = useGameStore((s) => s.buyGenerator);
  const buyClickUpgrade = useGameStore((s) => s.buyClickUpgrade);
  const arcSurgeUntil = useGameStore((s) => s.arcSurgeUntil);
  const surgeActive = arcSurgeUntil > Date.now();
  const surgeLeft = surgeActive
    ? Math.max(0, Math.ceil((arcSurgeUntil - Date.now()) / 1000))
    : 0;

  const clickCombo = useGameStore((s) => s.clickCombo);
  const runCharge = useGameStore((s) => s.runCharge);
  const cookiePump = useGameStore((s) => s.cookiePump);
  const lastCookieGain = useGameStore((s) => s.lastCookieGain);

  const clickStreak = clickCombo.count;
  const runChargePct = Math.floor((runCharge / 100) * 100); // runChargeMax is 100 in tuning

  function handlePump() {
    const gain = cookiePump();
    if (gain > 0) {
      playUiClick();
    }
  }

  const ringR = 46;
  const ringC = 2 * Math.PI * ringR;
  const chargeFrac = Math.max(0, Math.min(1, runChargePct / 100));

  return (
    <div className="plate plate-screws pointer-events-auto flex h-full max-h-[min(70dvh,34rem)] flex-col gap-3 overflow-hidden p-3 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:p-4" data-testid="workshop-panel">
      <div className="flex items-start gap-2.5">
        <div className="well flex h-9 w-9 shrink-0 items-center justify-center text-brand-300">
          <Wrench size={18} strokeWidth={ICON_STROKE} aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-base font-extrabold uppercase leading-tight tracking-wide text-slate-50">
            {t.workshop.title}
          </h2>
          <p className="text-[10px] leading-snug text-slate-400">{t.workshop.subtitle}</p>
        </div>
      </div>

      {surgeActive && (
        <div className="hazard flex items-center justify-center gap-2 rounded-lg border border-amber-400/60 px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-amber-100">
          <Zap size={13} strokeWidth={2.25} aria-hidden />
          {t.workshop.arcSurgeActive(surgeLeft)}
        </div>
      )}

      {/* Pump: a round plunger key ringed by the Run Charge gauge. */}
      <div className="well flex items-center gap-3 p-2 sm:p-2.5">
        <div className="relative h-[84px] w-[84px] shrink-0 sm:h-[104px] sm:w-[104px]">
          <svg viewBox="0 0 104 104" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="52" cy="52" r={ringR} fill="none" stroke="rgb(var(--c-slate-800))" strokeWidth="5" />
            <circle
              cx="52"
              cy="52"
              r={ringR}
              fill="none"
              stroke="rgb(var(--c-brand-400))"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${ringC * chargeFrac} ${ringC}`}
              style={{ transition: "stroke-dasharray 200ms ease-out", filter: "drop-shadow(0 0 4px rgb(var(--c-brand-400) / 0.7))" }}
            />
          </svg>
          <button
            type="button"
            onClick={handlePump}
            aria-label={t.workshop.pumpLabel}
            className={`key ${surgeActive ? "key-gold" : "key-primary"} absolute inset-[11%] flex-col gap-0.5 rounded-full text-[10px] sm:text-[11px]`}
          >
            <Hand size={22} strokeWidth={2} aria-hidden />
            <span className="leading-none">{t.workshop.pumpLabel}</span>
          </button>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5 font-mono">
          <div>
            <div className="silk text-[9px]">{t.workshop.cpsLabel}</div>
            <div className="readout-digits text-base">
              <FormattedNumberInline value={Math.floor(cachedTotalCps * 10) / 10} />
              <span className="text-[10px] text-slate-400">/s</span>
            </div>
          </div>
          <div>
            <div className="silk text-[9px]">{t.workshop.runCharge}</div>
            <div className="text-sm font-bold text-slate-100">{runCharge.toFixed(0)}%</div>
          </div>
          <div className="flex items-baseline justify-between text-[10px] text-slate-400">
            <span>
              {t.workshop.clickStreak} <span className="font-bold text-slate-200">{clickStreak}</span>
            </span>
            {lastCookieGain > 0 && (
              <span className="font-bold text-brand-300" key={stats.totalClicks}>
                +<FormattedNumberInline value={lastCookieGain} />
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="tabbar" role="tablist">
        {(["build", "upgrades"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              playUiClick();
              setTab(id);
            }}
            className="tab flex-1"
          >
            {id === "build" ? t.workshop.tabBuild : t.workshop.tabUpgrades}
          </button>
        ))}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
        {tab === "build" &&
          GENERATORS.map((g) => {
            const owned = generatorCounts[g.id] ?? 0;
            const cost = generatorCost(g.baseCost, g.costMult, owned);
            const locked = !meetsUnlock(g.unlock, stats);
            const canBuy = !locked && momentum >= cost;
            return (
              <button
                key={g.id}
                type="button"
                disabled={locked || !canBuy}
                onClick={() => {
                  if (buyGenerator(g.id)) playUiClick();
                }}
                className="card flex w-full items-center gap-2.5 px-2 py-1.5 text-left enabled:hover:border-brand-500/50 enabled:active:translate-y-px disabled:opacity-45"
              >
                <span className="well flex h-9 w-9 shrink-0 items-center justify-center text-brand-300">
                  {locked ? <Lock size={16} strokeWidth={ICON_STROKE} aria-hidden /> : <ContentIcon kind="generator" id={g.id} size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-slate-100">{g.name}</span>
                  <span className="font-mono text-[9px] text-slate-500">
                    {locked ? t.workshop.locked : `${t.workshop.buy}`}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="font-mono text-[11px] font-bold text-brand-300">
                    <FormattedNumberInline value={cost} interactive={false} />
                  </span>
                  <span className="font-mono text-[9px] text-slate-400">×{owned}</span>
                </span>
              </button>
            );
          })}

        {tab === "upgrades" &&
          CLICK_UPGRADES.map((u) => {
            const level = clickUpgradeLevels[u.id] ?? 0;
            const cost = clickUpgradeCost(u.baseCost, u.costMult, level);
            const locked = !meetsUnlock(u.unlock, stats);
            const canBuy = !locked && momentum >= cost;
            return (
              <button
                key={u.id}
                type="button"
                disabled={locked || !canBuy}
                onClick={() => {
                  if (buyClickUpgrade(u.id)) playUiClick();
                }}
                className="card flex w-full items-center gap-2.5 px-2 py-1.5 text-left enabled:hover:border-brand-500/50 enabled:active:translate-y-px disabled:opacity-45"
              >
                <span className="well flex h-9 w-9 shrink-0 items-center justify-center text-brand-300">
                  {locked ? <Lock size={16} strokeWidth={ICON_STROKE} aria-hidden /> : <ContentIcon kind="clickUpgrade" id={u.id} size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-slate-100">{u.name}</span>
                  <span className="line-clamp-2 text-[9px] leading-snug text-slate-500">{u.description}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="font-mono text-[11px] font-bold text-brand-300">
                    <FormattedNumberInline value={cost} interactive={false} />
                  </span>
                  <span className="font-mono text-[9px] text-slate-400">
                    {t.workshop.level} {level}
                  </span>
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
