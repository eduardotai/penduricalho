import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "../state/store";
import { PENDULUMS } from "../data/pendulums";
import { ATTACHMENTS } from "../data/attachments";
import { SITES } from "../data/sites";
import type {
  AttachmentDef,
  ItemKind,
  PendulumDef,
  SiteDef,
  Stats as StatsT,
  UnlockGate,
} from "../types";

type Tab = "pendulum" | "attachment" | "site" | "stats";

const TABS: { id: Tab; label: string }[] = [
  { id: "pendulum", label: "Pendulums" },
  { id: "attachment", label: "Attachments" },
  { id: "site", label: "Sites" },
  { id: "stats", label: "Stats" },
];

interface CustomizeProps {
  open: boolean;
  onClose: () => void;
}

export default function Customize({ open, onClose }: CustomizeProps) {
  const [tab, setTab] = useState<Tab>("pendulum");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex h-[min(720px,90vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-100">Customize</h2>
            <p className="text-xs text-slate-400">
              Equip what you own and unlock more with momentum.
            </p>
          </div>
          <MomentumBadge />
          <button
            onClick={onClose}
            className="ml-3 rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
        </header>

        <nav className="flex gap-1 border-b border-slate-800 px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                tab === t.id
                  ? "bg-brand-600 text-white"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-4 py-3">
          {tab === "pendulum" && <ItemList kind="pendulum" />}
          {tab === "attachment" && <ItemList kind="attachment" />}
          {tab === "site" && <ItemList kind="site" />}
          {tab === "stats" && <StatsTab />}
        </div>
      </div>
    </div>
  );
}

function MomentumBadge() {
  const momentum = useGameStore((s) => s.momentum);
  return (
    <div className="rounded-lg bg-slate-900 px-3 py-1.5 text-right">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">
        Momentum
      </div>
      <div className="font-display text-sm font-semibold text-brand-300">
        {momentum.toLocaleString()}
      </div>
    </div>
  );
}

function ItemList({ kind }: { kind: ItemKind }) {
  const stats = useGameStore((s) => s.stats);
  const owned = useGameStore((s) => s.owned);
  const equipped = useGameStore((s) => s.equipped);
  const momentum = useGameStore((s) => s.momentum);
  const buy = useGameStore((s) => s.buy);
  const equip = useGameStore((s) => s.equip);

  const list = useMemo(() => {
    if (kind === "pendulum") return PENDULUMS;
    if (kind === "attachment") return ATTACHMENTS;
    return SITES;
  }, [kind]);

  const ownedList =
    kind === "pendulum"
      ? owned.pendulums
      : kind === "attachment"
        ? owned.attachments
        : owned.sites;

  const equippedId =
    kind === "pendulum"
      ? equipped.pendulumId
      : kind === "attachment"
        ? equipped.attachmentId
        : equipped.siteId;

  return (
    <div className="flex flex-col gap-2">
      {list.map((item) => (
        <Row
          key={item.id}
          kind={kind}
          item={item}
          stats={stats}
          isOwned={ownedList.includes(item.id)}
          isEquipped={item.id === equippedId}
          momentum={momentum}
          onBuy={() => buy(kind, item.id)}
          onEquip={() => equip(kind, item.id)}
        />
      ))}
    </div>
  );
}

interface RowProps {
  kind: ItemKind;
  item: PendulumDef | AttachmentDef | SiteDef;
  stats: StatsT;
  isOwned: boolean;
  isEquipped: boolean;
  momentum: number;
  onBuy: () => void;
  onEquip: () => void;
}

function Row({
  kind,
  item,
  stats,
  isOwned,
  isEquipped,
  momentum,
  onBuy,
  onEquip,
}: RowProps) {
  const locked = item.unlock ? !meetsUnlock(stats, item.unlock) : false;
  const canAfford = momentum >= item.cost;

  return (
    <div
      className={`rounded-xl border bg-slate-900/50 p-3 transition-colors ${
        isEquipped
          ? "border-brand-500/60 bg-brand-500/10"
          : locked
            ? "border-slate-800 opacity-60"
            : "border-slate-800 hover:border-slate-700"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-100">{item.name}</h3>
            {"rarity" in item && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${rarityClass(
                  item.rarity
                )}`}
              >
                {item.rarity}
              </span>
            )}
            {isEquipped && (
              <span className="rounded bg-brand-500/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-brand-200">
                Equipped
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{item.description}</p>
          <ItemStats kind={kind} item={item} />
        </div>
        <div className="flex w-32 flex-col items-end gap-1.5">
          {isOwned ? (
            isEquipped ? (
              <span className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400">
                In Use
              </span>
            ) : (
              <button
                onClick={onEquip}
                className="w-full rounded-md bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-600"
              >
                Equip
              </button>
            )
          ) : locked ? (
            <span className="text-right text-[11px] text-slate-500">
              {unlockText(item.unlock!)}
            </span>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                Cost
              </div>
              <div className="font-display text-sm font-semibold text-brand-300">
                {item.cost.toLocaleString()}
              </div>
              <button
                onClick={onBuy}
                disabled={!canAfford}
                className={`w-full rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
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
        {a.bonuses.velocityBonus && (
          <Stat label="Vel" value={`+${(a.bonuses.velocityBonus * 100).toFixed(0)}%`} />
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

function StatsTab() {
  const stats = useGameStore((s) => s.stats);
  const momentum = useGameStore((s) => s.momentum);
  const owned = useGameStore((s) => s.owned);
  const totalRuns = useGameStore((s) => s.totalRuns);
  const bestRunMomentum = useGameStore((s) => s.bestRunMomentum);
  const reset = useGameStore((s) => s.reset);

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Lifetime
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatCard label="Momentum" value={momentum.toLocaleString()} />
          <StatCard label="All-Time Momentum" value={stats.totalMomentum.toLocaleString()} />
          <StatCard label="Total Runs" value={totalRuns.toLocaleString()} />
          <StatCard label="Best Run" value={bestRunMomentum.toLocaleString()} />
          <StatCard label="Total Hits" value={stats.totalHits.toLocaleString()} />
          <StatCard label="Best Combo" value={`x${stats.bestCombo}`} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Collection
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Pendulums" value={`${owned.pendulums.length}`} />
          <StatCard label="Attachments" value={`${owned.attachments.length}`} />
          <StatCard label="Sites" value={`${owned.sites.length}`} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Danger Zone
        </h3>
        <button
          onClick={() => {
            if (confirm("Reset all progress? This cannot be undone.")) reset();
          }}
          className="w-full rounded-lg border border-red-700/40 bg-red-900/30 px-3 py-2 text-sm font-semibold text-red-200 transition-colors hover:bg-red-900/50"
        >
          Reset Save
        </button>
      </section>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">
        {label}
      </div>
      <div className="font-display text-sm font-semibold text-slate-100">
        {value}
      </div>
    </div>
  );
}

function meetsUnlock(stats: StatsT, gate: UnlockGate): boolean {
  return stats[gate.stat] >= gate.gte;
}

function unlockText(gate: UnlockGate): string {
  const labels: Record<keyof StatsT, string> = {
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
