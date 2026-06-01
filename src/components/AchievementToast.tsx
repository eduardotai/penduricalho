import { useEffect, useState } from "react";
import { useGameStore } from "../state/store";
import { ACHIEVEMENT_MAP } from "../data/achievements";
import { useT } from "../i18n";

const VISIBLE_MS = 5200;

/**
 * Achievement unlock toast. Driven by the transient `lastAchievementUnlock`
 * (its `seq` forces a fresh show even for rapid unlocks). Looks up the
 * localized name from the achievement roster + i18n strings.
 */
export default function AchievementToast() {
  const last = useGameStore((s) => s.lastAchievementUnlock);
  const t = useT();
  const [shown, setShown] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    if (!last) return;
    setCurrentId(last.id);
    setShown(true);
    const id = window.setTimeout(() => setShown(false), VISIBLE_MS);
    return () => window.clearTimeout(id);
  }, [last?.seq]);

  if (!shown || !currentId) return null;

  const def = ACHIEVEMENT_MAP.get(currentId);
  // Fallback to id if strings not yet populated (during early dev).
  const name =
    (t as any).achievements?.[currentId]?.name ??
    def?.id ??
    currentId;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-40 flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-amber-300/40 bg-slate-900/95 px-4 py-2.5 shadow-2xl backdrop-blur-md">
        <div className="text-2xl leading-none" aria-hidden>
          {def?.icon ?? "🏆"}
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[1.5px] text-amber-300/80">
            {(t as any).achievements?.toastTitle ?? "ACHIEVEMENT UNLOCKED"}
          </div>
          <div className="text-base font-bold text-amber-100 -mt-0.5">
            {name}
          </div>
        </div>
      </div>
    </div>
  );
}
