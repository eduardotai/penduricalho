import { ComboBadges, ComboTab } from "./RigCombos";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { drawBobSkin } from "../game/render";
import { bobRadius } from "../game/pendulum";
import { FormattedNumber } from "./FormattedNumber";
import ThemeShop from "./ThemeShop";
import Window, { type WindowTab } from "./ui/Window";
import {
  Cable,
  ChartColumn,
  Check,
  CircleDot,
  Lock,
  Map as MapIcon,
  Palette,
  Rocket,
  Shapes,
  ShoppingBag,
  SwatchBook,
  Link2,
} from "lucide-react";
import GlobalUpgradeShop from "./GlobalUpgradeShop";
import { formatDecimal, formatNumber } from "../lib/formatNumber";
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
import { meetsUnlock } from "../game/clickerEconomy";
import {
  bulkLevelUpCost,
  itemScoreMult,
  nextMilestone,
} from "../game/levels";
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

type Tab = "pendulum" | "attachment" | "combo" | "site" | "skin" | "shape" | "boost" | "theme" | "stats";

/** Gear shop tabs only — workshop items use WorkshopPanel. */
type GearItemKind = Exclude<ItemKind, "generator" | "clickUpgrade">;

interface CustomizeProps {
  open: boolean;
  onClose: () => void;
}

const BUY_AMOUNTS = [1, 10, 50, 100] as const;
type BuyAmount = (typeof BUY_AMOUNTS)[number];

export default function Customize({ open, onClose }: CustomizeProps) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("pendulum");
  // Cookie-Clicker-style buy multiplier: level up 1/10/50/100 at once. Shared
  // across the bob & rope tabs and reset to 1 each time the shop opens.
  const [buyAmount, setBuyAmount] = useState<BuyAmount>(1);

  const tabs: WindowTab<Tab>[] = [
    { id: "pendulum", label: t.customize.tabPendulum, icon: CircleDot },
    { id: "attachment", label: t.customize.tabAttachment, icon: Cable },
    { id: "combo", label: t.customize.tabCombos, icon: Link2 },
    { id: "site", label: t.customize.tabSite, icon: MapIcon },
    { id: "skin", label: t.customize.tabSkin, icon: Palette },
    { id: "shape", label: t.customize.tabShape, icon: Shapes },
    { id: "boost", label: t.customize.tabBoost, icon: Rocket },
    { id: "theme", label: t.customize.tabTheme, icon: SwatchBook },
    { id: "stats", label: t.customize.tabStats, icon: ChartColumn },
  ];

  return (
    <Window
      open={open}
      onClose={onClose}
      title={t.customize.shopTitle}
      subtitle={t.customize.shopSubtitle}
      icon={ShoppingBag}
      code="01 / SHOP"
      closeLabel={t.customize.close}
      headerExtra={<MomentumBadge />}
      tabs={tabs}
      activeTab={tab}
      onTab={setTab}
      testId="shop-window"
    >
      {tab === "pendulum" && (
        <ItemList kind="pendulum" buyAmount={buyAmount} setBuyAmount={setBuyAmount} />
      )}
      {tab === "attachment" && (
        <ItemList kind="attachment" buyAmount={buyAmount} setBuyAmount={setBuyAmount} />
      )}
      {tab === "combo" && <ComboTab />}
      {tab === "site" && <ItemList kind="site" />}
      {tab === "skin" && <ItemList kind="skin" />}
      {tab === "shape" && <ItemList kind="shape" />}
      {tab === "boost" && <GlobalUpgradeShop />}
      {tab === "theme" && <ThemeShop />}
      {tab === "stats" && <StatsTab />}
    </Window>
  );
}

function MomentumBadge() {
  const t = useT();
  const momentum = useGameStore((s) => s.momentum);
  return (
    <div className="readout hidden px-3 py-1 text-right sm:block">
      <div className="silk text-[9px]">{t.customize.momentum}</div>
      <FormattedNumber value={momentum} className="readout-digits text-base" />
    </div>
  );
}

function ItemList({
  kind,
  buyAmount = 1,
  setBuyAmount,
}: {
  kind: GearItemKind;
  buyAmount?: BuyAmount;
  setBuyAmount?: (n: BuyAmount) => void;
}) {
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
        buyAmount={buyAmount}
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

  const buySelector =
    setBuyAmount != null ? (
      <BuyAmountSelector value={buyAmount} onChange={setBuyAmount} />
    ) : null;

  if (kind === "attachment") {
    return (
      <div className="flex flex-col gap-4">
        {buySelector}
        <section>
          <h3 className="silk silk-tick mb-2">
            {t.customize.ropesShortToLong}
          </h3>
          <div className="flex flex-col gap-2">{renderRows(ropeList)}</div>
        </section>
        <section>
          <h3 className="silk silk-tick mb-2">
            {t.customize.rodsChainsElastic}
          </h3>
          <div className="flex flex-col gap-2">{renderRows(otherAttachments)}</div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {buySelector}
      {renderRows(list)}
    </div>
  );
}

function BuyAmountSelector({
  value,
  onChange,
}: {
  value: BuyAmount;
  onChange: (n: BuyAmount) => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-2">
      <span className="silk">{t.customize.buyQty}</span>
      <div className="well flex gap-1 p-1">
        {BUY_AMOUNTS.map((n) => (
          <button
            key={n}
            onClick={() => {
              playUiClick();
              onChange(n);
            }}
            aria-pressed={value === n}
            className={`min-w-[40px] rounded-md px-2.5 py-1 font-mono text-xs font-bold transition-colors ${
              value === n
                ? "bg-brand-500 text-slate-950 shadow-[0_0_12px_-2px_rgb(var(--c-brand-400)/0.8)]"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            ×{n}
          </button>
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  kind: GearItemKind;
  item: PendulumDef | AttachmentDef | SiteDef | BobSkinDef | BobShapeDef;
  previewSkin: BobSkinDef;
  stats: StatsT;
  isOwned: boolean;
  isEquipped: boolean;
  momentum: number;
  buyAmount?: BuyAmount;
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
  buyAmount = 1,
  onBuy,
  onEquip,
}: RowProps) {
  const t = useT();
  const lang = useLang();
  const itemLevels = useGameStore((s) => s.itemLevels);
  const locked = !meetsUnlock(item.unlock, stats);
  const canAfford = momentum >= item.cost;
  const name = locName(lang, kind, item.id, item.name);
  const description = locDesc(lang, kind, item.id, item.description);
  const levelable = kind === "pendulum" || kind === "attachment";
  const level = itemLevels[item.id] ?? 0;

  return (
    <div
      className={`card p-2.5 sm:p-3 ${isEquipped ? "card-lit" : locked ? "opacity-60" : ""}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
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
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-slate-50">{name}</h3>
            {"rarity" in item && (
              <span
                className={`tag ${rarityClass(item.rarity)}`}
              >
                {t.rarity[item.rarity] ?? item.rarity}
              </span>
            )}
            {isEquipped && (
              <span className="tag text-brand-300">
                <Check size={10} strokeWidth={3} aria-hidden />
                {t.customize.equipped}
              </span>
            )}
            {levelable && isOwned && level > 0 && (
              <span className="tag text-emerald-300">
                {t.customize.level} {level}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">{description}</p>
          <ItemStats kind={kind} item={item} />
          {(kind === "pendulum" || kind === "attachment") && (
            <ComboBadges kind={kind} itemId={item.id} />
          )}
          </div>
        </div>
        <div className="flex w-full flex-row items-center justify-end gap-2 sm:w-32 sm:flex-col sm:items-end sm:gap-1.5">
          {isOwned ? (
            isEquipped ? (
              <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-300">
                <span className="led led-on" aria-hidden />
                {t.customize.inUse}
              </span>
            ) : (
              <button
                onClick={onEquip}
                className="key min-h-[44px] w-32 px-3 text-xs sm:w-full"
              >
                {t.customize.equip}
              </button>
            )
          ) : locked ? (
            <span className="flex items-start gap-1 text-right font-mono text-[10px] leading-snug text-slate-500">
              <Lock size={12} className="mt-px shrink-0" aria-hidden />
              {unlockText(t, lang, item.unlock!)}
            </span>
          ) : (
            <>
              <div className="silk hidden text-[9px] sm:block">{t.customize.cost}</div>
              <FormattedNumber value={item.cost} className="font-mono text-sm font-bold text-brand-300" />
              <button
                onClick={onBuy}
                disabled={!canAfford}
                className={`key ${canAfford ? "key-primary" : ""} min-h-[44px] w-32 px-3 text-xs sm:w-full`}
              >
                {t.customize.buy}
              </button>
            </>
          )}
        </div>
      </div>
      {levelable && isOwned && (
        <LevelControl
          kind={kind}
          cost={item.cost}
          level={level}
          momentum={momentum}
          itemId={item.id}
          buyAmount={buyAmount}
        />
      )}
    </div>
  );
}

function LevelControl({
  kind,
  cost,
  level,
  momentum,
  itemId,
  buyAmount,
}: {
  kind: "pendulum" | "attachment";
  cost: number;
  level: number;
  momentum: number;
  itemId: string;
  buyAmount: BuyAmount;
}) {
  const t = useT();
  const levelUp = useGameStore((s) => s.levelUp);
  const batchCost = bulkLevelUpCost(cost, level, buyAmount);
  const canAfford = momentum >= batchCost;
  const bonusPct = Math.round((itemScoreMult(level) - 1) * 100);
  const next = nextMilestone(level);
  // A milestone is hit when buying this batch crosses one of the milestone levels.
  const milestoneReady = next != null && level + buyAmount >= next;

  return (
    <div className="mt-2 flex items-center justify-between gap-3 border-t border-dashed border-slate-700/70 pt-2">
      <div className="flex flex-col font-mono text-[10px] leading-tight">
        <span className="font-semibold text-emerald-300">
          {t.customize.level} {level} · {t.customize.levelBonus(bonusPct)}
        </span>
        <span className={milestoneReady ? "text-amber-300" : "text-slate-500"}>
          {milestoneReady
            ? t.customize.milestoneReady
            : next != null
              ? t.customize.nextMilestone(next)
              : t.customize.milestoneMaxed}
        </span>
      </div>
      <button
        onClick={() => {
          playUiClick();
          const ok = levelUp(kind, itemId, buyAmount);
          playGameSound(ok ? "ui-buy" : "ui-error");
        }}
        disabled={!canAfford}
        className={`key ${canAfford ? "key-go" : ""} min-h-[38px] shrink-0 px-3 text-[11px]`}
      >
        <span>
          {t.customize.levelUp}
          {buyAmount > 1 ? ` ×${buyAmount}` : ""}
        </span>
        <FormattedNumber value={batchCost} className="font-mono" />
      </button>
    </div>
  );
}

function ItemStats({
  kind,
  item,
}: {
  kind: GearItemKind;
  item: PendulumDef | AttachmentDef | SiteDef | BobSkinDef | BobShapeDef;
}) {
  const t = useT();
  const lang = useLang();
  const dec = (n: number, digits?: number) => formatDecimal(n, lang, digits);
  const c = t.customize;
  if (kind === "skin") {
    const skin = item as BobSkinDef;
    return (
      <div className="mt-1.5 flex flex-wrap gap-1 font-mono text-[10px] text-slate-200">
        <Stat label={c.statFinish} value={t.pattern[skin.pattern] ?? skin.pattern} />
        <Stat label={c.statCosmetic} value={c.bobOnly} />
      </div>
    );
  }
  if (kind === "shape") {
    const shape = item as BobShapeDef;
    return (
      <div className="mt-1.5 flex flex-wrap gap-1 font-mono text-[10px] text-slate-200">
        <Stat label={c.statSilhouette} value={t.shape[shape.shape] ?? shape.shape} />
        <Stat label={c.statCosmetic} value={c.bobOnly} />
      </div>
    );
  }
  if (kind === "pendulum") {
    const p = item as PendulumDef;
    return (
      <div className="mt-1.5 flex flex-wrap gap-1 font-mono text-[10px] text-slate-200">
        <Stat label={c.statWeight} value={dec(p.weight, 1)} />
        <Stat label={c.statSize} value={`${p.bobRadius}px`} />
        <Stat label={c.statBobs} value={p.bobCount.toString()} />
        <Stat label={c.statMult} value={`x${dec(p.basePointMultiplier, 2)}`} />
        <Stat label={c.statSpinCap} value={dec(p.maxAngularVelocity, 2)} />
      </div>
    );
  }
  if (kind === "attachment") {
    const a = item as AttachmentDef;
    const profile = getMaterialProfile(a);
    return (
      <div className="mt-1.5 flex flex-wrap gap-1 font-mono text-[10px] text-slate-200">
        <Stat label={c.statType} value={t.attachType[a.type] ?? a.type} />
        <Stat label={c.statLength} value={a.length.toString()} />
        <Stat label={c.statStretch} value={formatStretchBudget(profile)} />
        <Stat label={c.statDamp} value={dec(profile.dampingRatio, 2)} />
        {a.bonuses.momentumMult && (
          <Stat label={c.statPts} value={`x${dec(a.bonuses.momentumMult, 2)}`} />
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
    <div className="mt-1.5 flex flex-wrap gap-1 font-mono text-[10px] text-slate-200">
      <Stat label={c.statGravity} value={dec(s.gravity, 2)} />
      <Stat label={c.statZones} value={s.hitZoneCount.toString()} />
      <Stat label={c.statWalls} value={wallsLabel} />
      {s.walls && s.walls !== "none" && <Stat label={c.statCage} value={cageLabel} />}
      {s.mechanic?.kind === "springWalls" && (
        <Stat label={c.statWalls} value={`${c.springWalls} ×${dec(s.mechanic.boost)}`} />
      )}
      {s.mechanic?.kind === "tides" && (
        <Stat
          label={c.statTides}
          value={c.tideRange(Math.round(s.mechanic.minGravity * 100), Math.round(s.mechanic.maxGravity * 100))}
        />
      )}
      {s.mechanic?.kind === "conveyor" && (
        <Stat label={c.statConveyor} value={c.conveyorFlips(dec(s.mechanic.flipMs / 1000))} />
      )}
      {s.mechanic?.kind === "magnetPulses" && (
        <Stat label={c.statPulses} value={c.pulseEvery(dec((s.mechanic.calmMs + s.mechanic.pulseMs) / 1000))} />
      )}
      {s.mechanic?.kind === "bumpers" && (
        <Stat label={c.statBumpers} value={c.bumpersOrbiting(s.mechanic.count)} />
      )}
      {s.mechanic?.kind === "gusts" ? (
        <Stat label={c.statWind} value={c.windGusts} />
      ) : (
        s.ambient && <Stat label={c.statWind} value={c.yes} />
      )}
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
        <h3 className="silk silk-tick mb-2">
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
        <h3 className="silk silk-tick mb-2">
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
        <h3 className="silk silk-tick mb-2">
          {c.statDangerZone}
        </h3>
        <button
          onClick={() => {
            if (confirm(c.resetConfirm)) reset();
          }}
          className="key key-danger min-h-[44px] w-full text-sm"
        >
          {c.resetSave}
        </button>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded border border-slate-800 bg-slate-950/50 px-1.5 py-0.5">
      <span className="text-slate-500">{label}</span> {value}
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
    <div className="readout px-3 py-2">
      <div className="silk text-[9px]">{label}</div>
      <div className="readout-digits text-base">{value}</div>
    </div>
  );
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
      className="well relative mt-0.5 h-14 w-14 shrink-0 rounded-full p-1"
      title={title ?? skin.name}
      aria-hidden
    />
  );
}

function rarityClass(r: PendulumDef["rarity"] | BobSkinDef["rarity"] | BobShapeDef["rarity"]): string {
  switch (r) {
    case "common":
      return "text-slate-400";
    case "rare":
      return "text-sky-300";
    case "epic":
      return "text-fuchsia-300";
    case "legendary":
      return "text-amber-300";
  }
}
