import { useMemo, useState } from "react";
import { useGameStore } from "../state/store";
import { PENDULUMS } from "../data/pendulums";
import { ATTACHMENTS } from "../data/attachments";
import { SITES } from "../data/sites";
import type {
  AttachmentDef,
  ItemKind,
  PendulumDef,
  SiteDef,
  Stats,
  UnlockGate,
} from "../types";

type ShopTab = "pendulum" | "attachment" | "site";

const TABS: { id: ShopTab; label: string }[] = [
  { id: "pendulum", label: "Pendulums" },
  { id: "attachment", label: "Attachments" },
  { id: "site", label: "Sites" },
];

export default function Shop() {
  const [tab, setTab] = useState<ShopTab>("pendulum");
  const stats = useGameStore((s) => s.stats);
  const owned = useGameStore((s) => s.owned);
  const momentum = useGameStore((s) => s.momentum);
  const buy = useGameStore((s) => s.buy);

  const items = useMemo(() => {
    if (tab === "pendulum") return PENDULUMS;
    if (tab === "attachment") return ATTACHMENTS;
    return SITES;
  }, [tab]);

  const ownedList =
    tab === "pendulum"
      ? owned.pendulums
      : tab === "attachment"
        ? owned.attachments
        : owned.sites;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-lg bg-slate-900/60 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              tab === t.id
                ? "bg-brand-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <ShopRow
            key={item.id}
            kind={tab as ItemKind}
            item={item}
            stats={stats}
            owned={ownedList.includes(item.id)}
            momentum={momentum}
            onBuy={() => buy(tab as ItemKind, item.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface ShopRowProps {
  kind: ItemKind;
  item: PendulumDef | AttachmentDef | SiteDef;
  stats: Stats;
  owned: boolean;
  momentum: number;
  onBuy: () => void;
}

function ShopRow({ kind, item, stats, owned, momentum, onBuy }: ShopRowProps) {
  const locked = item.unlock ? !meetsUnlock(stats, item.unlock) : false;
  const canAfford = momentum >= item.cost;

  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/50 p-3 transition-colors ${
        locked ? "opacity-60" : "hover:border-slate-700"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-100">{item.name}</h3>
            {"rarity" in item && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                  rarityClass(item.rarity)
                }`}
              >
                {item.rarity}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{item.description}</p>
          <ItemStats kind={kind} item={item} />
        </div>
        <div className="text-right">
          {owned ? (
            <span className="rounded-md bg-emerald-700/40 px-2 py-1 text-xs font-medium text-emerald-200">
              Owned
            </span>
          ) : locked ? (
            <span className="block text-[11px] text-slate-500">
              {unlockText(item.unlock!)}
            </span>
          ) : (
            <>
              <div className="text-xs text-slate-400">Cost</div>
              <div className="font-display text-sm font-semibold text-brand-300">
                {item.cost.toLocaleString()}
              </div>
              <button
                onClick={onBuy}
                disabled={!canAfford}
                className={`mt-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  canAfford
                    ? "bg-brand-600 text-white hover:bg-brand-500"
                    : "cursor-not-allowed bg-slate-800 text-slate-500"
                }`}
              >
                Buy
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemStats({
  kind,
  item,
}: {
  kind: ItemKind;
  item: PendulumDef | AttachmentDef | SiteDef;
}) {
  if (kind === "pendulum") {
    const p = item as PendulumDef;
    return (
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-300">
        <Stat label="Weight" value={p.weight.toFixed(1)} />
        <Stat label="Bobs" value={p.bobCount.toString()} />
        <Stat label="Mult" value={`x${p.basePointMultiplier.toFixed(2)}`} />
        <Stat label="MaxVel" value={p.maxAngularVelocity.toFixed(2)} />
      </div>
    );
  }
  if (kind === "attachment") {
    const a = item as AttachmentDef;
    return (
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-300">
        <Stat label="Type" value={a.type} />
        <Stat label="Length" value={a.length.toString()} />
        <Stat label="Stiff" value={a.stiffness.toFixed(2)} />
        {a.bonuses.momentumMult && (
          <Stat label="Pts" value={`x${a.bonuses.momentumMult.toFixed(2)}`} />
        )}
        {a.bonuses.twistPowerBonus && (
          <Stat label="Twist" value={`+${(a.bonuses.twistPowerBonus * 100).toFixed(0)}%`} />
        )}
      </div>
    );
  }
  const s = item as SiteDef;
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-300">
      <Stat label="Gravity" value={s.gravity.toFixed(2)} />
      <Stat label="Zones" value={s.hitZoneCount.toString()} />
      {s.ambient && <Stat label="Wind" value="yes" />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-slate-500">{label}:</span> {value}
    </span>
  );
}

function meetsUnlock(stats: Stats, gate: UnlockGate): boolean {
  return stats[gate.stat] >= gate.gte;
}

function unlockText(gate: UnlockGate): string {
  const labels: Record<keyof Stats, string> = {
    totalMomentum: "Total Momentum",
    totalSwings: "Swings",
    totalHits: "Hits",
    bestCombo: "Best Combo",
  };
  return `Unlocks at ${labels[gate.stat]} >= ${gate.gte.toLocaleString()}`;
}

function rarityClass(r: PendulumDef["rarity"]): string {
  switch (r) {
    case "common":
      return "bg-slate-700/60 text-slate-300";
    case "rare":
      return "bg-sky-600/40 text-sky-200";
    case "epic":
      return "bg-purple-600/40 text-purple-200";
    case "legendary":
      return "bg-amber-500/40 text-amber-100";
  }
}
