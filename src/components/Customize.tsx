import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { drawBobSkin } from "../game/render";
import { bobRadius } from "../game/pendulum";
import { FormattedNumber } from "./FormattedNumber";
import { formatNumber } from "../lib/formatNumber";
import { useGameStore } from "../state/store";
import { playGameSound, playUiClick } from "../audio/soundMap";
import { PENDULUMS } from "../data/pendulums";
import { ATTACHMENTS, ROPE_ATTACHMENTS } from "../data/attachments";
import { SITES } from "../data/sites";
import { BOB_SKINS, SKIN_MAP, STARTER_SKIN_ID } from "../data/bobSkins";
import { BOB_SHAPES, STARTER_SHAPE_ID } from "../data/bobShapes";
import {
  formatStretchBudget,
  getMaterialProfile,
} from "../game/attachmentPhysics";
import type {
  AttachmentDef,
  BobShapeDef,
  BobSkinDef,
  ItemKind,
  PendulumDef,
  SiteDef,
  Stats as StatsT,
  UnlockGate,
} from "../types";

type Tab = "pendulum" | "attachment" | "site" | "skin" | "shape" | "stats";

const TABS: { id: Tab; label: string }[] = [
  { id: "pendulum", label: "Pendulums" },
  { id: "attachment", label: "Attachments" },
  { id: "site", label: "Sites" },
  { id: "skin", label: "Bob Skins" },
  { id: "shape", label: "Bob Shapes" },
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
      data-no-camera-zoom
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
          {tab === "skin" && <ItemList kind="skin" />}
          {tab === "shape" && <ItemList kind="shape" />}
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
        <FormattedNumber
          value={momentum}
          className="font-display text-sm font-semibold text-brand-300"
        />
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

  const equippedSkin = useGameStore((s) => s.equipped.skinId);

  const list = useMemo(() => {
    if (kind === "pendulum") return PENDULUMS;
    if (kind === "attachment") return ATTACHMENTS;
    if (kind === "site") return SITES;
    if (kind === "shape") return BOB_SHAPES;
    return BOB_SKINS;
  }, [kind]);

  const ropeList = useMemo(() => ROPE_ATTACHMENTS, []);
  const otherAttachments = useMemo(
    () => ATTACHMENTS.filter((a) => a.type !== "rope"),
    []
  );

  const ownedList =
    kind === "pendulum"
      ? owned.pendulums
      : kind === "attachment"
        ? owned.attachments
        : kind === "site"
          ? owned.sites
          : kind === "skin"
            ? (owned.skins ?? [STARTER_SKIN_ID])
            : (owned.shapes ?? [STARTER_SHAPE_ID]);

  const equippedId =
    kind === "pendulum"
      ? equipped.pendulumId
      : kind === "attachment"
        ? equipped.attachmentId
        : kind === "site"
          ? equipped.siteId
          : kind === "skin"
            ? equipped.skinId
            : equipped.shapeId;

  const previewSkin =
    SKIN_MAP.get(equippedSkin) ??
    BOB_SKINS.find((s) => s.id === STARTER_SKIN_ID) ??
    BOB_SKINS[0];

  const renderRows = (items: typeof list) =>
    items.map((item) => (
      <Row
        key={item.id}
        kind={kind}
        item={item}
        previewSkin={previewSkin}
        stats={stats}
        isOwned={ownedList.includes(item.id)}
        isEquipped={item.id === equippedId}
        momentum={momentum}
        onBuy={() => {
          playUiClick();
          const ok = buy(kind, item.id);
          playGameSound(ok ? "ui-buy" : "ui-error");
        }}
        onEquip={() => {
          playUiClick();
          equip(kind, item.id);
          playGameSound("ui-equip");
        }}
      />
    ));

  if (kind === "attachment") {
    return (
      <div className="flex flex-col gap-4">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Ropes — short to long
          </h3>
          <div className="flex flex-col gap-2">{renderRows(ropeList)}</div>
        </section>
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Rods, chains &amp; elastic
          </h3>
          <div className="flex flex-col gap-2">{renderRows(otherAttachments)}</div>
        </section>
      </div>
    );
  }

  return <div className="flex flex-col gap-2">{renderRows(list)}</div>;
}

interface RowProps {
  kind: ItemKind;
  item: PendulumDef | AttachmentDef | SiteDef | BobSkinDef | BobShapeDef;
  previewSkin: BobSkinDef;
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
  previewSkin,
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
        <div className="flex flex-1 items-start gap-3">
          {kind === "skin" && <BobPreview skin={item as BobSkinDef} />}
          {kind === "shape" && (
            <BobPreview
              skin={previewSkin}
              shape={(item as BobShapeDef).shape}
              title={(item as BobShapeDef).name}
            />
          )}
          {kind === "pendulum" && (
            <BobPreview
              skin={previewSkin}
              radius={bobRadius(item as PendulumDef)}
              title={(item as PendulumDef).name}
            />
          )}
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
                <FormattedNumber
                  value={item.cost}
                  className="font-display text-sm font-semibold text-brand-300"
                />
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
  item: PendulumDef | AttachmentDef | SiteDef | BobSkinDef | BobShapeDef;
}) {
  if (kind === "skin") {
    const skin = item as BobSkinDef;
    return (
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-300">
        <Stat label="Finish" value={skin.pattern} />
        <Stat label="Cosmetic" value="bob only" />
      </div>
    );
  }
  if (kind === "shape") {
    const shape = item as BobShapeDef;
    return (
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-300">
        <Stat label="Silhouette" value={shape.shape} />
        <Stat label="Cosmetic" value="bob only" />
      </div>
    );
  }
  if (kind === "pendulum") {
    const p = item as PendulumDef;
    return (
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-300">
        <Stat label="Weight" value={p.weight.toFixed(1)} />
        <Stat label="Size" value={`${p.bobRadius}px`} />
        <Stat label="Bobs" value={p.bobCount.toString()} />
        <Stat label="Mult" value={`x${p.basePointMultiplier.toFixed(2)}`} />
        <Stat label="MaxVel" value={p.maxAngularVelocity.toFixed(2)} />
      </div>
    );
  }
  if (kind === "attachment") {
    const a = item as AttachmentDef;
    const profile = getMaterialProfile(a);
    return (
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-300">
        <Stat label="Type" value={a.type} />
        <Stat label="Length" value={a.length.toString()} />
        <Stat label="Stretch" value={formatStretchBudget(profile)} />
        <Stat label="Damp" value={profile.dampingRatio.toFixed(2)} />
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
          <StatCard
            label="Momentum"
            value={<FormattedNumber value={momentum} />}
          />
          <StatCard
            label="All-Time Momentum"
            value={<FormattedNumber value={stats.totalMomentum} />}
          />
          <StatCard label="Total Runs" value={totalRuns.toLocaleString()} />
          <StatCard
            label="Best Run"
            value={<FormattedNumber value={bestRunMomentum} />}
          />
          <StatCard label="Total Hits" value={stats.totalHits.toLocaleString()} />
          <StatCard label="Best Combo" value={`x${stats.bestCombo}`} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Collection
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="Pendulums" value={`${owned.pendulums.length}`} />
          <StatCard label="Attachments" value={`${owned.attachments.length}`} />
          <StatCard label="Sites" value={`${owned.sites.length}`} />
          <StatCard label="Bob Skins" value={`${owned.skins?.length ?? 1}`} />
          <StatCard label="Bob Shapes" value={`${owned.shapes?.length ?? 1}`} />
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

function StatCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
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
  return `Unlocks at ${labels[gate.stat]} >= ${formatNumber(gate.gte)}`;
}

/** Reference bob radius for shop thumbnails (brass bob, world-scaled). */
const PREVIEW_REF_BOB_RADIUS = bobRadius(
  PENDULUMS.find((p) => p.id === "brass-bob") ?? PENDULUMS[0]!
);

function BobPreview({
  skin,
  shape = "circle",
  radius,
  title,
}: {
  skin: BobSkinDef;
  shape?: BobShapeDef["shape"];
  /** When set, scales the thumbnail to match pendulum bob size. */
  radius?: number;
  title?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    const baseR = size * 0.42;
    const drawR =
      radius === undefined
        ? baseR
        : baseR * Math.max(0.55, Math.min(1.35, radius / PREVIEW_REF_BOB_RADIUS));
    drawBobSkin(ctx, size / 2, size / 2, drawR, skin, shape);
  }, [skin, shape, radius]);

  return (
    <canvas
      ref={canvasRef}
      width={48}
      height={48}
      className="relative mt-0.5 h-12 w-12 shrink-0 rounded-full"
      title={title ?? skin.name}
      aria-hidden
    />
  );
}

function rarityClass(r: PendulumDef["rarity"] | BobSkinDef["rarity"] | BobShapeDef["rarity"]): string {
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
