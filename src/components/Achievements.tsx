import { useMemo, useState } from "react";
import { useGameStore } from "../state/store";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  getAchievementMomentumMult,
  getAllAchievementProgress,
} from "../data/achievements";
import type { AchievementCategory } from "../types";
import { useT, useLang } from "../i18n";
import { FormattedNumber } from "./FormattedNumber";
import Window from "./ui/Window";
import { Check, Trophy } from "lucide-react";
import { ContentIcon } from "./ui/icons";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Filter = "all" | "unlocked" | "locked" | AchievementCategory;

export default function Achievements({ open, onClose }: Props) {
  const t = useT();
  const lang = useLang();

  const unlocked = useGameStore((s) => s.unlockedAchievements);
  const stats = useGameStore((s) => s.stats);
  const owned = useGameStore((s) => s.owned);
  const totalRuns = useGameStore((s) => s.totalRuns);
  const bestRunMomentum = useGameStore((s) => s.bestRunMomentum);
  const totalGoldenTokens = useGameStore((s) => s.totalGoldenTokens);
  const totalGoldenSpent = useGameStore((s) => s.totalGoldenSpent);
  const blackHoleCaptures = useGameStore((s) => s.blackHoleCaptures);
  const cachedTotalCps = useGameStore((s) => s.cachedTotalCps);
  const totalArcSurges = useGameStore((s) => s.totalArcSurges);

  const [filter, setFilter] = useState<Filter>("all");

  const snapshot = useMemo(
    () => ({
      stats,
      owned,
      totalGoldenSpent,
      blackHoleCaptures,
      totalRuns,
      bestRunMomentum,
      totalGoldenTokens,
      cachedTotalCps,
      totalArcSurges,
      unlocked,
    }),
    [
      stats,
      owned,
      totalGoldenSpent,
      blackHoleCaptures,
      totalRuns,
      bestRunMomentum,
      totalGoldenTokens,
      cachedTotalCps,
      totalArcSurges,
      unlocked,
    ]
  );

  const progressMap = useMemo(() => getAllAchievementProgress(snapshot), [snapshot]);

  const visibleDefs = useMemo(() => {
    return ACHIEVEMENTS.filter((def) => {
      const p = progressMap[def.id];
      if (!p) return false;
      if (def.hidden && !p.unlocked) return false; // shadow until earned

      if (filter === "all") return true;
      if (filter === "unlocked") return p.unlocked;
      if (filter === "locked") return !p.unlocked;
      return def.category === filter;
    }).sort((a, b) => {
      const pa = progressMap[a.id];
      const pb = progressMap[b.id];
      // Unlocked first, then by category order, then by id
      if (pa.unlocked !== pb.unlocked) return pa.unlocked ? -1 : 1;
      const ca = ACHIEVEMENT_CATEGORIES.indexOf(a.category);
      const cb = ACHIEVEMENT_CATEGORIES.indexOf(b.category);
      if (ca !== cb) return ca - cb;
      return a.id.localeCompare(b.id);
    });
  }, [progressMap, filter]);

  const unlockedCount = Object.keys(unlocked).filter((id) =>
    ACHIEVEMENTS.some((a) => a.id === id)
  ).length;
  const totalVisible = ACHIEVEMENTS.filter((a) => !a.hidden || !!unlocked[a.id]).length;

  // Small global bonus (recomputed live)
  const bonusMult = getAchievementMomentumMult(unlockedCount);

  const bonusPct = Math.round((bonusMult - 1) * 1000) / 10;

  const pct = totalVisible > 0 ? unlockedCount / totalVisible : 0;
  const pt = lang === "pt";

  return (
    <Window
      open={open}
      onClose={onClose}
      title={(t as any).achievements?.title ?? "Achievements"}
      subtitle={
        <span className="font-mono">
          {unlockedCount} / {totalVisible} · <span className="text-amber-300">+{bonusPct}% Momentum</span>
        </span>
      }
      icon={Trophy}
      code="02 / LOG"
      closeLabel={t.settings.close}
      sizeClass="sm:h-[min(720px,92vh)] sm:max-w-4xl"
      testId="achievements-window"
      headerExtra={
        <div className="hidden w-36 sm:block" aria-hidden>
          <div className="meter">
            <span style={{ width: `${pct * 100}%`, background: "linear-gradient(90deg, rgb(var(--c-amber-500)), rgb(var(--c-yellow-300)))" }} />
          </div>
          <div className="mt-1 text-right font-mono text-[10px] text-slate-400">{Math.round(pct * 100)}%</div>
        </div>
      }
      footer={
        <p className="text-center font-mono text-[10px] text-slate-500">
          {pt ? "Conquistas dão um bônus permanente de " : "Achievements grant a permanent "}
          <span className="text-amber-300/90">+{bonusPct}% Momentum</span>
          {pt ? " global." : " global bonus."}
        </p>
      }
    >
      <div className="sticky -top-3 z-10 -mx-3 mb-3 flex flex-wrap gap-1.5 border-b border-slate-800/80 bg-slate-950/90 px-3 pb-2 pt-1 backdrop-blur sm:-top-4 sm:-mx-5 sm:px-5">
        {(["all", "unlocked", "locked"] as const).map((f) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {(t as any).achievements?.filters?.[f] ?? f}
          </Chip>
        ))}
        <div className="mx-1 h-5 w-px self-center bg-slate-700" />
        {ACHIEVEMENT_CATEGORIES.map((cat) => (
          <Chip key={cat} active={filter === cat} onClick={() => setFilter(cat)}>
            {(t as any).achievements?.categories?.[cat] ?? cat}
          </Chip>
        ))}
      </div>

      {visibleDefs.length === 0 && (
        <div className="py-12 text-center font-mono text-sm text-slate-400">
          {pt ? "Nenhuma conquista neste filtro ainda." : "No achievements match this filter yet. Keep swinging!"}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {visibleDefs.map((def) => {
          const p = progressMap[def.id];
          const strings = (t as any).achievements?.[def.id] ?? {};
          const name = strings.name ?? def.id;
          const desc = strings.description ?? "";

          return (
            <div
              key={def.id}
              data-achievement={def.id}
              className={`card relative overflow-hidden p-3 ${p.unlocked ? "border-amber-400/45" : ""}`}
              style={
                p.unlocked
                  ? { backgroundImage: "linear-gradient(135deg, rgb(var(--c-amber-500) / 0.14), transparent 55%)" }
                  : undefined
              }
            >
              <div className="flex items-start gap-3">
                <div
                  className={`well flex h-12 w-12 shrink-0 items-center justify-center ${
                    p.unlocked ? "text-amber-300 shadow-[0_0_18px_-6px_rgb(var(--c-amber-400)/0.9)]" : "text-slate-500"
                  }`}
                  aria-hidden
                >
                  <ContentIcon kind="achievement" id={def.id} size={p.unlocked ? 24 : 20} className={p.unlocked ? undefined : "opacity-60"} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[13px] font-bold uppercase tracking-wide text-slate-50">{name}</div>
                  <div className="mt-0.5 text-xs leading-snug text-slate-400">{desc}</div>

                  {!p.unlocked && p.target > 0 && (
                    <div className="mt-2">
                      <div className="mb-1 flex justify-between font-mono text-[10px] text-slate-400">
                        <span>
                          <FormattedNumber value={p.progress} /> / <FormattedNumber value={p.target} />
                        </span>
                        <span>{Math.round(p.percent * 100)}%</span>
                      </div>
                      <div className="meter">
                        <span
                          style={{
                            width: `${Math.min(100, p.percent * 100)}%`,
                            background: "linear-gradient(90deg, rgb(var(--c-amber-500)), rgb(var(--c-yellow-300)))",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {p.unlocked && (
                    <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-amber-300/80">
                      <span className="tag text-amber-300">
                        <Check size={10} strokeWidth={3} aria-hidden />
                        {(t as any).achievements?.unlockedBadge ?? "UNLOCKED"}
                      </span>
                      {new Date(unlocked[def.id]).toLocaleDateString(pt ? "pt-BR" : "en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Window>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider transition ${
        active
          ? "border-amber-300 bg-amber-400 text-slate-950 shadow-[0_0_12px_-3px_rgb(var(--c-amber-400)/0.9)]"
          : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-slate-100"
      }`}
    >
      {children}
    </button>
  );
}
