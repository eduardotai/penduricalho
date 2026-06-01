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
import { useT, useLang, locName, locDesc, type Lang } from "../i18n";
import type { UIStrings } from "../i18n/strings";
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

interface CustomizeProps {
  open: boolean;
  onClose: () => void;
}

export default function Customize({ open, onClose }: CustomizeProps) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("pendulum");

  const tabs: { id: Tab; label: string }[] = [
    { id: "pendulum", label: t.customize.tabPendulum },
    { id: "attachment", label: t.customize.tabAttachment },
    { id: "site", label: t.customize.tabSite },
    { id: "skin", label: t.customize.tabSkin },
    { id: "shape", label: t.customize.tabShape },
    { id: "stats", label: t.customize.tabStats },
  ];

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
      data-no-camera-zoom
      onClick={onClose}
    >
      <div
        className="relative flex h-full max-h-[100dvh] w-full flex-col overflow-hidden border border-slate-700/60 bg-slate-950/95 shadow-2xl sm:h-[min(720px,90vh)] sm:max-w-3xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-100">{t.customize.shopTitle}</h2>
            <p className="text-xs text-slate-400">
              {t.customize.shopSubtitle}
            </p>
          </div>
          <MomentumBadge />
          <button
            onClick={onClose}
            className="ml-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-slate-700 px-4 text-sm text-slate-300 hover:bg-slate-800"
          >
            {t.customize.close}
          </button>
        </header>

        <nav className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-slate-800 px-2 py-1.5 sm:px-3 sm:py-2">
          {tabs.map((tabDef) => (
            <button
              key={tabDef.id}
              onClick={() => setTab(tabDef.id)}
              className={`shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                tab === tabDef.id
                  ? "bg-brand-600 text-white"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              {tabDef.label}
            </button>
          ))}
        </nav>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-3">
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
  const t = useT();
  const momentum = useGameStore((s) => s.momentum);
  return (
    <div className="rounded-lg bg-slate-900 px-3 py-1.5 text-right">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">
        {t.customize.momentum}
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
  const t = useT();
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
            {t.customize.ropesShortToLong}
          </h3>
          <div className="flex flex-col gap-2">{renderRows(ropeList)}</div>
        </section>
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            {t.customize.rodsChainsElastic}
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
  const t = useT();
  const lang = useLang();
  const locked = item.unlock ? !meetsUnlock(stats, item.unlock) : false;
  const canAfford = momentum >= item.cost;
  const name = locName(lang, kind, item.id, item.name);
  const description = locDesc(lang, kind, item.id, item.description);

  return (
    <div
      className={`rounded-xl border bg-slate-900/50 p-2.5 transition-colors sm:p-3 ${
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
            <h3 className="font-semibold text-slate-100">{name}</h3>
            {"rarity" in item && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${rarityClass(
                  item.rarity
                )}`}
              >
                {t.rarity[item.rarity] ?? item.rarity}
              </span>
            )}
            {isEquipped && (
              <span className="rounded bg-brand-500/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-brand-200">
                {t.customize.equipped}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{description}</p>
          <ItemStats kind={kind} item={item} />
          </div>
        </div>
        <div className="flex w-32 flex-col items-end gap-1.5">
          {isOwned ? (
            isEquipped ? (
              <span className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400">
                {t.customize.inUse}
              </span>
            ) : (
              <button
                onClick={onEquip}
                className="flex min-h-[44px] w-full items-center justify-center rounded-md bg-slate-700 px-3 text-xs font-semibold text-white hover:bg-slate-600"
              >
                {t.customize.equip}
              </button>
            )
          ) : locked ? (
            <span className="text-right text-[11px] text-slate-500">
              {unlockText(t, lang, item.unlock!)}
            </span>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                {t.customize.cost}
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
                className={`flex min-h-[44px] w-full items-center justify-center rounded-md px-3 text-xs font-semibold transition-colors ${
                  canAfford
                    ? "bg-brand-600 text-white hover:bg-brand-500"
                    : "cursor-not-allowed bg-slate-800 text-slate-500"
                }`}
              >
                {t.customize.buy}
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
  const t = useT();
  const c = t.customize;
  if (kind === "skin") {
    const skin = item as BobSkinDef;
    return (
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-300">
        <Stat label={c.statFinish} value={t.pattern[skin.pattern] ?? skin.pattern} />
        <Stat label={c.statCosmetic} value={c.bobOnly} />
      </div>
    );
  }
  if (kind === "shape") {
    const shape = item as BobShapeDef;
    return (
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-300">
        <Stat label={c.statSilhouette} value={t.shape[shape.shape] ?? shape.shape} />
        <Stat label={c.statCosmetic} value={c.bobOnly} />
      </div>
    );
  }
  if (kind === "pendulum") {
    const p = item as PendulumDef;
    return (
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-300">
        <Stat label={c.statWeight} value={p.weight.toFixed(1)} />
        <Stat label={c.statSize} value={`${p.bobRadius}px`} />
        <Stat label={c.statBobs} value={p.bobCount.toString()} />
        <Stat label={c.statMult} value={`x${p.basePointMultiplier.toFixed(2)}`} />
        <Stat label={c.statSpinCap} value={p.maxAngularVelocity.toFixed(2)} />
      </div>
    );
  }
  if (kind === "attachment") {
    const a = item as AttachmentDef;
    const profile = getMaterialProfile(a);
    return (
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-300">
        <Stat label={c.statType} value={t.attachType[a.type] ?? a.type} />
        <Stat label={c.statLength} value={a.length.toString()} />
        <Stat label={c.statStretch} value={formatStretchBudget(profile)} />
        <Stat label={c.statDamp} value={profile.dampingRatio.toFixed(2)} />
        {a.bonuses.momentumMult && (
          <Stat label={c.statPts} value={`x${a.bonuses.momentumMult.toFixed(2)}`} />
        )}
        {a.bonuses.twistPowerBonus && (
          <Stat label={c.statTwist} value={`+${(a.bonuses.twistPowerBonus * 100).toFixed(0)}%`} />
        )}
        {a.bonuses.velocityBonus && (
          <Stat label={c.statVel} value={`+${(a.bonuses.velocityBonus * 100).toFixed(0)}%`} />
        )}
      </div>
    );
  }
  const s = item as SiteDef;
  const wallsLabel =
    s.walls === "breakable"
      ? c.wallsBreakable
      : s.walls === "solid"
        ? c.wallsSolid
        : c.wallsOpen;
  const cageScale = s.cageScale ?? 1;
  const cageLabel =
    cageScale >= 1.75 ? c.cageLarge : cageScale >= 1.3 ? c.cageMedium : c.cageSmall;
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-300">
      <Stat label={c.statGravity} value={s.gravity.toFixed(2)} />
      <Stat label={c.statZones} value={s.hitZoneCount.toString()} />
      <Stat label={c.statWalls} value={wallsLabel} />
      {s.walls && s.walls !== "none" && <Stat label={c.statCage} value={cageLabel} />}
      {s.ambient && <Stat label={c.statWind} value={c.yes} />}
    </div>
  );
}

function StatsTab() {
  const t = useT();
  const c = t.customize;
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
          {c.statLifetime}
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatCard
            label={c.momentum}
            value={<FormattedNumber value={momentum} />}
          />
          <StatCard
            label={c.statAllTimeMomentum}
            value={<FormattedNumber value={stats.totalMomentum} />}
          />
          <StatCard label={c.statTotalRuns} value={totalRuns.toLocaleString()} />
          <StatCard
            label={c.statBestRun}
            value={<FormattedNumber value={bestRunMomentum} />}
          />
          <StatCard label={c.statTotalHits} value={stats.totalHits.toLocaleString()} />
          <StatCard label={c.statBestCombo} value={`x${stats.bestCombo}`} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          {c.statCollection}
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label={c.tabPendulum} value={`${owned.pendulums.length}`} />
          <StatCard label={c.tabAttachment} value={`${owned.attachments.length}`} />
          <StatCard label={c.tabSite} value={`${owned.sites.length}`} />
          <StatCard label={c.tabSkin} value={`${owned.skins?.length ?? 1}`} />
          <StatCard label={c.tabShape} value={`${owned.shapes?.length ?? 1}`} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          {c.statDangerZone}
        </h3>
        <button
          onClick={() => {
            if (confirm(c.resetConfirm)) reset();
          }}
          className="w-full rounded-lg border border-red-700/40 bg-red-900/30 px-3 py-2 text-sm font-semibold text-red-200 transition-colors hover:bg-red-900/50"
        >
          {c.resetSave}
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

function unlockText(t: UIStrings, lang: Lang, gate: UnlockGate): string {
  return t.customize.unlockText(t.statKey[gate.stat], formatNumber(gate.gte, "short", lang));
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
