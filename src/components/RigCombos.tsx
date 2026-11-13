import { formatDecimal } from "../lib/formatNumber";
import { useGameStore } from "../state/store";
import { useT, useLang, locName, locDesc } from "../i18n";
import { RIG_COMBOS, activeRigCombo, combosForItem } from "../data/combos";
import { PENDULUM_MAP } from "../data/pendulums";
import { ATTACHMENT_MAP } from "../data/attachments";
import type { RigComboDef } from "../types";
import { Check, Link2, X } from "lucide-react";
import { ICON_STROKE } from "./ui/icons";

function pct(mult: number): number {
  return Math.round(Math.abs(mult - 1) * 100);
}

/** Short bonus chips, e.g. "+25% points · −40% wear". */
export function comboBonusParts(c: RigComboDef, t: ReturnType<typeof useT>): string[] {
  const parts = [t.customize.comboPoints(pct(c.pointMult))];
  if (c.drainMult !== undefined) parts.push(t.customize.comboWear(pct(c.drainMult)));
  if (c.kickMult !== undefined) parts.push(t.customize.comboKick(pct(c.kickMult)));
  if (c.pullMult !== undefined) parts.push(t.customize.comboPull(pct(c.pullMult)));
  return parts;
}

/** On a bob/line card: which combo(s) this item belongs to and with what. */
export function ComboBadges({ kind, itemId }: { kind: "pendulum" | "attachment"; itemId: string }) {
  const t = useT();
  const lang = useLang();
  const equipped = useGameStore((s) => s.equipped);
  const combos = combosForItem(kind, itemId);
  if (combos.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {combos.map((c) => {
        const active = equipped.pendulumId === c.pendulumId && equipped.attachmentId === c.attachmentId;
        const partner =
          kind === "pendulum"
            ? locName(lang, "attachment", c.attachmentId, ATTACHMENT_MAP.get(c.attachmentId)?.name ?? c.attachmentId)
            : locName(lang, "pendulum", c.pendulumId, PENDULUM_MAP.get(c.pendulumId)?.name ?? c.pendulumId);
        return (
          <span
            key={c.id}
            data-testid={`combo-badge-${c.id}`}
            className={`tag inline-flex items-center gap-1 normal-case tracking-normal ${
              active ? "border-amber-400/60 text-amber-200" : "text-slate-400"
            }`}
          >
            <Link2 size={11} strokeWidth={ICON_STROKE} aria-hidden /> {t.customize.comboWith(locName(lang, "combo", c.id, c.name), partner)} · ×{formatDecimal(c.pointMult, lang)}
            {active ? ` · ${t.customize.comboActive}` : ""}
          </span>
        );
      })}
    </div>
  );
}

/** Shop › Combos: every set, its status and a one-tap "equip both". */
export function ComboTab() {
  const t = useT();
  const lang = useLang();
  const owned = useGameStore((s) => s.owned);
  const equipped = useGameStore((s) => s.equipped);
  const equip = useGameStore((s) => s.equip);
  return (
    <div className="space-y-2">
      <p className="px-1 text-xs text-slate-400">{t.customize.combosIntro}</p>
      {RIG_COMBOS.map((c) => {
        const hasBob = owned.pendulums.includes(c.pendulumId);
        const hasRope = owned.attachments.includes(c.attachmentId);
        const active = equipped.pendulumId === c.pendulumId && equipped.attachmentId === c.attachmentId;
        const bobName = locName(lang, "pendulum", c.pendulumId, PENDULUM_MAP.get(c.pendulumId)?.name ?? c.pendulumId);
        const ropeName = locName(lang, "attachment", c.attachmentId, ATTACHMENT_MAP.get(c.attachmentId)?.name ?? c.attachmentId);
        return (
          <div
            key={c.id}
            data-testid={`combo-row-${c.id}`}
            className={`card flex items-center gap-3 p-3 ${active ? "card-lit" : ""}`}
          >
            <div
              className={`well flex h-11 w-11 shrink-0 items-center justify-center ${active ? "text-amber-300" : "text-slate-400"}`}
              aria-hidden
            >
              <Link2 size={22} strokeWidth={ICON_STROKE} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-sm font-bold uppercase tracking-wide text-slate-100">
                  {locName(lang, "combo", c.id, c.name)}
                </span>
                <span
                  className={`tag ${
                    active
                      ? "border-amber-400/60 text-amber-200"
                      : hasBob && hasRope
                        ? "border-emerald-400/50 text-emerald-200"
                        : "text-slate-400"
                  }`}
                >
                  {active ? t.customize.comboActive : hasBob && hasRope ? t.customize.comboOwned : t.customize.comboMissing}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">{locDesc(lang, "combo", c.id, c.description)}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-1 font-mono text-[10.5px] text-slate-300">
                <span className={hasBob ? "text-emerald-300" : "text-slate-500"}>{hasBob ? <Check size={11} className="inline" aria-hidden /> : <X size={11} className="inline" aria-hidden />} {bobName}</span>
                <span className="text-slate-600"> + </span>
                <span className={hasRope ? "text-emerald-300" : "text-slate-500"}>{hasRope ? <Check size={11} className="inline" aria-hidden /> : <X size={11} className="inline" aria-hidden />} {ropeName}</span>
                <span className="text-slate-600"> · </span>
                <span className="text-amber-200">{comboBonusParts(c, t).join(" · ")}</span>
              </p>
            </div>
            {hasBob && hasRope && !active && (
              <button
                onClick={() => {
                  equip("pendulum", c.pendulumId);
                  equip("attachment", c.attachmentId);
                }}
                className="key key-primary min-h-[44px] shrink-0 px-3 text-xs"
              >
                {t.customize.comboEquip}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Loadout line suffix: the active combo, if any. */
export function ActiveComboLine({ pendulumId, attachmentId }: { pendulumId: string; attachmentId: string }) {
  const lang = useLang();
  const c = activeRigCombo(pendulumId, attachmentId);
  if (!c) return null;
  return (
    <div data-testid="active-combo" className="mt-0.5 flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300">
      <Link2 size={11} strokeWidth={ICON_STROKE} aria-hidden /> COMBO {locName(lang, "combo", c.id, c.name)} ×{formatDecimal(c.pointMult, lang)}
    </div>
  );
}
