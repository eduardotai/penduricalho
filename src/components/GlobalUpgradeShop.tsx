import { FormattedNumber } from "./FormattedNumber";
import { useGameStore } from "../state/store";
import { playGameSound, playUiClick } from "../audio/soundMap";
import { GLOBAL_UPGRADES, GLOBAL_UPGRADE_MAP, globalUpgradeMult } from "../data/globalUpgrades";
import { getAchievementMomentumMult } from "../data/achievements";
import { prestigeMult } from "../game/prestige";
import { useLang, useT } from "../i18n";
import { Lock } from "lucide-react";
import { ContentIcon } from "./ui/icons";

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
      <p className="text-xs leading-relaxed text-slate-400">{c.boostsIntro}</p>
      <div className="readout p-3">
        <div className="silk mb-1.5">{c.incomeBreakdown}</div>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-xs text-slate-300">
          <span>
            {c.incomePrestige} <b className="text-slate-100">{fmtMult(pMult)}</b>
          </span>
          <span>
            {c.incomeBoosts} <b className="text-slate-100">{fmtMult(bMult)}</b>
          </span>
          <span>
            {c.incomeAchievements} <b className="text-slate-100">{fmtMult(aMult)}</b>
          </span>
          <span className="readout-digits ml-auto text-lg">
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
            className={`card flex items-center gap-3 p-3 ${isOwned ? "card-lit" : locked ? "opacity-60" : ""}`}
          >
            <span className="well flex h-12 w-12 shrink-0 items-center justify-center text-brand-300">
              <ContentIcon kind="globalUpgrade" id={u.id} size={24} />
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-50">{u.name[lang]}</h3>
                <span className="tag text-brand-300">
                  ×{u.mult}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">{u.description[lang]}</p>
            </div>
            <div className="flex w-32 flex-col items-end gap-1.5">
              {isOwned ? (
                <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-300"><span className="led led-on" aria-hidden />{c.boostOwned}</span>
              ) : locked ? (
                <span className="flex items-start gap-1 text-right font-mono text-[10px] text-slate-500"><Lock size={12} className="mt-px shrink-0" aria-hidden />{c.boostRequires(req!.name[lang])}</span>
              ) : (
                <>
                  <FormattedNumber value={u.cost} className="font-mono text-sm font-bold text-brand-300" />
                  <button
                    onClick={() => {
                      playUiClick();
                      const ok = buy(u.id);
                      playGameSound(ok ? "ui-buy" : "ui-error");
                    }}
                    disabled={!canAfford}
                    className={`key ${canAfford ? "key-primary" : ""} min-h-[44px] w-full px-3 text-xs`}
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
