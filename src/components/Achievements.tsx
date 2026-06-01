import { useMemo, useState } from "react";
import { useGameStore } from "../state/store";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_MAP,
  getAllAchievementProgress,
} from "../data/achievements";
import type { AchievementCategory } from "../types";
import { useT, useLang } from "../i18n";
import { FormattedNumber } from "./FormattedNumber";
import type { Stats, Owned } from "../types";

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
      unlocked,
    }),
    [stats, owned, totalGoldenSpent, blackHoleCaptures, totalRuns, bestRunMomentum, totalGoldenTokens, unlocked]
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
  const bonusMult = useMemo(() => {
    // We import the pure fn via a small re-export in selectors, but to avoid
    // circular import noise we just compute here the same way.
    const per = 0.0025;
    const max = 0.12;
    return 1 + Math.min(unlockedCount * per, max);
  }, [unlockedCount]);

  const bonusPct = Math.round((bonusMult - 1) * 1000) / 10;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4">
      <div className="relative flex h-full max-h-[100dvh] w-full flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/95 shadow-2xl sm:h-[min(720px,92vh)] sm:max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700/60 px-4 py-3 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏆</span>
              <h2 className="font-display text-xl font-semibold tracking-tight text-slate-100">
                {(t as any).achievements?.title ?? "Achievements"}
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              {unlockedCount} / {totalVisible} unlocked
              <span className="ml-2 text-amber-300/80">+{bonusPct}% Momentum</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-600 bg-slate-900/70 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-700/60 bg-slate-900/40 px-4 py-2 sm:px-6">
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

        {/* Grid */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {visibleDefs.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">
              No achievements match this filter yet. Keep swinging!
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleDefs.map((def) => {
              const p = progressMap[def.id];
              const strings = (t as any).achievements?.[def.id] ?? {};
              const name = strings.name ?? def.id;
              const desc = strings.description ?? "";

              return (
                <div
                  key={def.id}
                  className={`group rounded-2xl border p-4 transition-all ${
                    p.unlocked
                      ? "border-amber-400/40 bg-amber-900/10"
                      : "border-slate-700/60 bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-3xl opacity-90" aria-hidden>
                      {def.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-semibold text-slate-100">{name}</div>
                        {p.unlocked && (
                          <span className="rounded bg-amber-400/20 px-1.5 py-px text-[10px] font-medium text-amber-300">
                            {(t as any).achievements?.unlockedBadge ?? "UNLOCKED"}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs leading-snug text-slate-400">
                        {desc}
                      </div>

                      {!p.unlocked && p.target > 0 && (
                        <div className="mt-2.5">
                          <div className="mb-1 flex justify-between text-[10px] text-slate-400">
                            <span>
                              <FormattedNumber value={p.progress} /> /{" "}
                              <FormattedNumber value={p.target} />
                            </span>
                            <span>{Math.round(p.percent * 100)}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded bg-slate-800">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-all"
                              style={{ width: `${Math.min(100, p.percent * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {p.unlocked && (
                        <div className="mt-2 text-[10px] text-amber-300/70">
                          {new Date(unlocked[def.id]).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", {
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
        </div>

        <div className="border-t border-slate-700/60 bg-slate-900/60 px-4 py-2 text-center text-[10px] text-slate-500 sm:px-6">
          Achievements grant a permanent <span className="text-amber-300/80">+{bonusPct}% Momentum</span> global bonus. More coming as the roster grows.
        </div>
      </div>
    </div>
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
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider transition ${
        active
          ? "bg-amber-400 text-slate-950"
          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
