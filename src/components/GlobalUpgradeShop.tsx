import { FormattedNumber } from "./FormattedNumber";
import { useGameStore } from "../state/store";
import { playGameSound, playUiClick } from "../audio/soundMap";
import { GLOBAL_UPGRADES, GLOBAL_UPGRADE_MAP, globalUpgradeMult } from "../data/globalUpgrades";
import { getAchievementMomentumMult } from "../data/achievements";
import { prestigeMult } from "../game/prestige";
import { useLang, useT } from "../i18n";

const fmtMult = (m: number) => `×${m.toFixed(m >= 10 ? 1 : 2)}`;

/** Shop tab: one-time global income multipliers (×2, then ×3). */
export default function GlobalUpgradeShop() {
  const t = useT();
  const c = t.customize;
  const lang = useLang();
  const momentum = useGameStore((s) => s.momentum);
  const owned = useGameStore((s) => s.globalUpgrades);
  const cogs = useGameStore((s) => s.prestigeCogs);
  const achCount = useGameStore((s) => Object.keys(s.unlockedAchievements).length);
  const buy = useGameStore((s) => s.buyGlobalUpgrade);

  const pMult = prestigeMult(cogs);
  const bMult = globalUpgradeMult(owned);
  const aMult = getAchievementMomentumMult(achCount);

  return (
    <div className="flex flex-col gap-3" data-testid="boost-shop">
      <p className="text-xs text-slate-400">{c.boostsIntro}</p>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
        <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">{c.incomeBreakdown}</div>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-slate-300">
          <span>
            {c.incomePrestige} <b className="text-slate-100">{fmtMult(pMult)}</b>
          </span>
          <span>
            {c.incomeBoosts} <b className="text-slate-100">{fmtMult(bMult)}</b>
          </span>
          <span>
            {c.incomeAchievements} <b className="text-slate-100">{fmtMult(aMult)}</b>
          </span>
          <span className="ml-auto font-display text-base font-semibold text-brand-300">
            {c.incomeTotal} {fmtMult(pMult * bMult * aMult)}
          </span>
        </div>
      </div>
      {GLOBAL_UPGRADES.map((u) => {
        const isOwned = owned.includes(u.id);
        const req = u.requires ? GLOBAL_UPGRADE_MAP.get(u.requires) : undefined;
        const locked = !!req && !owned.includes(req.id);
        const canAfford = momentum >= u.cost;
        return (
          <div
            key={u.id}
            data-boost-card={u.id}
            className={`flex items-center gap-3 rounded-xl border bg-slate-900/50 p-3 ${
              isOwned ? "border-brand-500/60 bg-brand-500/10" : locked ? "border-slate-800 opacity-60" : "border-slate-800"
            }`}
          >
            <span className="text-3xl leading-none" aria-hidden>
              {u.icon}
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-100">{u.name[lang]}</h3>
                <span className="rounded bg-brand-500/25 px-1.5 py-0.5 text-[11px] font-bold text-brand-200">
                  ×{u.mult}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">{u.description[lang]}</p>
            </div>
            <div className="flex w-32 flex-col items-end gap-1.5">
              {isOwned ? (
                <span className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400">{c.boostOwned}</span>
              ) : locked ? (
                <span className="text-right text-[11px] text-slate-500">{c.boostRequires(req!.name[lang])}</span>
              ) : (
                <>
                  <div className="font-display text-sm font-semibold text-brand-300">
                    <FormattedNumber value={u.cost} className="font-display text-sm font-semibold text-brand-300" />
                  </div>
                  <button
                    onClick={() => {
                      playUiClick();
                      const ok = buy(u.id);
                      playGameSound(ok ? "ui-buy" : "ui-error");
                    }}
                    disabled={!canAfford}
                    className={`flex min-h-[44px] w-full items-center justify-center rounded-md px-3 text-xs font-semibold transition-colors ${
                      canAfford ? "bg-brand-600 text-white hover:bg-brand-500" : "cursor-not-allowed bg-slate-800 text-slate-500"
                    }`}
                  >
                    {c.buy}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
