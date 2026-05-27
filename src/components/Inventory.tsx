import { useGameStore } from "../state/store";
import { PENDULUM_MAP } from "../data/pendulums";
import { ATTACHMENT_MAP } from "../data/attachments";
import { SITE_MAP } from "../data/sites";
import type { ItemKind } from "../types";

export default function Inventory() {
  const owned = useGameStore((s) => s.owned);
  const equipped = useGameStore((s) => s.equipped);
  const equip = useGameStore((s) => s.equip);

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="Pendulum"
        kind="pendulum"
        ids={owned.pendulums}
        equippedId={equipped.pendulumId}
        getName={(id) => PENDULUM_MAP.get(id)?.name ?? id}
        onEquip={(id) => equip("pendulum", id)}
      />
      <Section
        title="Attachment"
        kind="attachment"
        ids={owned.attachments}
        equippedId={equipped.attachmentId}
        getName={(id) => ATTACHMENT_MAP.get(id)?.name ?? id}
        onEquip={(id) => equip("attachment", id)}
      />
      <Section
        title="Site"
        kind="site"
        ids={owned.sites}
        equippedId={equipped.siteId}
        getName={(id) => SITE_MAP.get(id)?.name ?? id}
        onEquip={(id) => equip("site", id)}
      />
    </div>
  );
}

interface SectionProps {
  title: string;
  kind: ItemKind;
  ids: string[];
  equippedId: string;
  getName: (id: string) => string;
  onEquip: (id: string) => void;
}

function Section({ title, ids, equippedId, getName, onEquip }: SectionProps) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
        {title}
      </h3>
      <div className="flex flex-col gap-1.5">
        {ids.map((id) => {
          const isEquipped = id === equippedId;
          return (
            <button
              key={id}
              onClick={() => onEquip(id)}
              disabled={isEquipped}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors ${
                isEquipped
                  ? "border-brand-500/60 bg-brand-500/15 text-brand-200"
                  : "border-slate-800 bg-slate-900/50 text-slate-200 hover:border-slate-700"
              }`}
            >
              <span>{getName(id)}</span>
              <span className="text-[11px] uppercase tracking-wide">
                {isEquipped ? "Equipped" : "Equip"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
