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

  return (
    <div className="pointer-events-auto flex max-h-[min(70dvh,32rem)] flex-col gap-3 overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/85 p-3 backdrop-blur-md sm:max-h-none sm:p-4">
      <div>
        <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-brand-300">
          {t.workshop.title}
        </h2>
        <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
          {t.workshop.subtitle}
        </p>
        <p className="mt-1 text-[10px] text-slate-500">
          {t.workshop.cpsLabel}{" "}
          <FormattedNumberInline value={Math.floor(cachedTotalCps * 10) / 10} />
          /s
        </p>
      </div>

      {surgeActive && (
        <div className="rounded-lg border border-amber-400/50 bg-amber-500/20 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-amber-100">
          {t.workshop.arcSurgeActive(surgeLeft)}
        </div>
      )}

      {/* Dedicated Workshop Pump (Plan C separation — primary high-frequency earner) */}
      <button
        type="button"
        onClick={handlePump}
        className="group w-full rounded-2xl border border-brand-500/60 bg-gradient-to-b from-brand-600/90 to-brand-700 px-4 py-3 text-center font-display text-lg font-bold uppercase tracking-[2px] text-white shadow-lg transition active:scale-[0.985] active:shadow-brand-500/40 hover:from-brand-500 hover:to-brand-600"
      >
        <div className="flex items-center justify-center gap-2">
          <span>🖐️</span>
          <span>{t.workshop.pumpLabel}</span>
        </div>
        {lastCookieGain > 0 && (
          <div className="mt-0.5 text-[10px] font-semibold tracking-normal text-brand-200/90">
            +<FormattedNumberInline value={lastCookieGain} />
          </div>
        )}
      </button>

      {/* Workshop power summary (feeds arena runs) */}
      <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/60 px-2 py-1 text-[10px] text-slate-400">
        <div>
          {t.workshop.clickStreak}: <span className="font-semibold text-slate-200">{clickStreak}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>{t.workshop.runCharge}</span>
          <div className="h-1.5 w-12 overflow-hidden rounded bg-slate-700">
            <div
              className="h-1.5 rounded bg-brand-400 transition-all"
              style={{ width: `${Math.max(4, runChargePct)}%` }}
            />
          </div>
          <span className="tabular-nums text-slate-300">{runCharge.toFixed(0)}</span>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-800/80 p-0.5">
        {(["build", "upgrades"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              playUiClick();
              setTab(id);
            }}
            className={`flex-1 rounded-md py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
              tab === id
                ? "bg-brand-600/80 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {id === "build" ? t.workshop.tabBuild : t.workshop.tabUpgrades}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5">
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
                className="flex w-full items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/50 px-2 py-2 text-left transition enabled:hover:border-brand-500/40 enabled:hover:bg-slate-800 disabled:opacity-45"
              >
                <span className="text-xl" aria-hidden>
                  {g.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-100">
                    {g.name}
                  </span>
                  <span className="text-[9px] text-slate-500">
                    {locked
                      ? t.workshop.locked
                      : `${owned} · ${t.workshop.buy}`}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] font-semibold text-brand-300">
                  <FormattedNumberInline value={cost} />
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
                className="flex w-full items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-800/50 px-2 py-2 text-left transition enabled:hover:border-brand-500/40 enabled:hover:bg-slate-800 disabled:opacity-45"
              >
                <span className="text-xl" aria-hidden>
                  {u.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-100">
                    {u.name}
                  </span>
                  <span className="line-clamp-2 text-[9px] text-slate-500">
                    {u.description}
                  </span>
                  <span className="text-[9px] text-slate-600">
                    {t.workshop.level} {level}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] font-semibold text-brand-300">
                  <FormattedNumberInline value={cost} />
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}