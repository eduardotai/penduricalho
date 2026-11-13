import { useEffect, useState } from "react";
import { useGameStore } from "../state/store";
import { ACHIEVEMENT_MAP } from "../data/achievements";
import { useT } from "../i18n";
import { ContentIcon } from "./ui/icons";

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
      <div
        key={last?.seq}
        role="status"
        className="plate toast-drop pointer-events-auto flex items-center gap-3 border-amber-300/60 py-2 pl-2 pr-5 shadow-[0_0_40px_-10px_rgb(var(--c-amber-400)/0.8)]"
      >
        <div className="well flex h-11 w-11 items-center justify-center text-amber-300" aria-hidden>
          <ContentIcon kind="achievement" id={def?.id ?? currentId} size={22} />
        </div>
        <div>
          <div className="silk text-[9px] !text-amber-300/90">
            {(t as any).achievements?.toastTitle ?? "ACHIEVEMENT UNLOCKED"}
          </div>
          <div className="font-display text-base font-extrabold uppercase tracking-wide text-amber-100">
            {name}
          </div>
        </div>
      </div>
    </div>
  );
}
