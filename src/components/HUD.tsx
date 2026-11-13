import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useGameStore, modifierDurationCapMs } from "../state/store";
import { MODIFIER_MAP } from "../data/modifiers";
import {
  getRemainingMs,
  getPersistentRemainingMs,
  sumPersistentRemainingMs,
} from "../game/modifiers";
import { FormattedNumber, FormattedNumberInline } from "./FormattedNumber";
import { useT, useLang, locName, locDesc } from "../i18n";
import { WORKSHOP_CLICKER_ENABLED } from "../config/features";
import { incomeBreakdown, PRESTIGE_TUNING } from "../game/prestige";
import { getAchievementMomentumMult } from "../data/achievements";

const fmtMult = (m: number) => (m >= 10 ? m.toFixed(1) : m.toFixed(2)).replace(/\.?0+$/, "");

/** Prestige Cogs (+X% permanent) and the total income multiplier on hits. */
function IncomeMultLine() {
  const t = useT();
  const cogs = useGameStore((s) => s.prestigeCogs);
  const owned = useGameStore((s) => s.globalUpgrades);
  const achCount = useGameStore((s) => Object.keys(s.unlockedAchievements || {}).length);
  const b = incomeBreakdown({
    prestigeCogs: cogs,
    globalUpgrades: owned,
    achievementMult: getAchievementMomentumMult(achCount),
  });
  if (cogs <= 0 && b.total < 1.005) return null;
  const pct = Math.round(cogs * PRESTIGE_TUNING.multPerCog * 100).toString();
  return (
    <div
      data-testid="hud-income-mult"
      className="pointer-events-auto mt-1 flex flex-wrap items-center gap-x-1.5 font-mono text-[9px] font-semibold sm:text-[10px]"
      title={t.hud.incomeMultTitle(
        fmtMult(b.prestige),
        fmtMult(b.boosts),
        fmtMult(b.achievements),
        fmtMult(b.total)
      )}
    >
      {cogs > 0 && <span className="text-amber-300">{t.hud.cogsHud(cogs, pct)}</span>}
      {cogs > 0 && <span className="text-slate-600">·</span>}
      <span className="text-brand-200">{t.hud.incomeMultHud(fmtMult(b.total))}</span>
    </div>
  );
}
import { Coins } from "lucide-react";

export function HUDStats() {
  const t = useT();
  const momentum = useGameStore((s) => s.momentum);
  const runMomentum = useGameStore((s) => s.runMomentum);
  const isRunning = useGameStore((s) => s.isRunning);
  const totalRuns = useGameStore((s) => s.totalRuns);
  const bestRunMomentum = useGameStore((s) => s.bestRunMomentum);
  const activeModifiers = useGameStore((s) => s.activeModifiers);
  const totalGoldenTokens = useGameStore((s) => s.totalGoldenTokens);
  const goldenTokenBonusMs = useGameStore((s) => s.goldenTokenBonusMs);
  const pendingGoldenTokens = useGameStore((s) => s.pendingGoldenTokens);
  const cachedTotalCps = useGameStore((s) => s.cachedTotalCps);
  const clickCombo = useGameStore((s) => s.clickCombo);
  const arcSurgeUntil = useGameStore((s) => s.arcSurgeUntil);
  const surgeActive = arcSurgeUntil > Date.now();

  const showRunCard = isRunning || runMomentum > 0;
  const goldenActive = activeModifiers.find((m) => m.defId === "token-bonus");
  const tokenReady = pendingGoldenTokens > 0;
  const showTokenCard = totalGoldenTokens > 0 || !!goldenActive || tokenReady;

  return (
    <div className="pointer-events-none space-y-2">
      <div className="plate inline-block px-2.5 pb-2 pt-1.5 sm:px-3.5 sm:pb-3 sm:pt-2.5" data-testid="hud-momentum">
        <div className="flex items-center justify-between gap-3">
          <div className="silk silk-tick text-[8.5px] sm:text-[10px]">{t.hud.momentum}</div>
          {WORKSHOP_CLICKER_ENABLED && cachedTotalCps > 0 && (
            <div className="font-mono text-[9px] text-slate-400 sm:text-[10px]">
              +<FormattedNumberInline value={Math.floor(cachedTotalCps * 10) / 10} />
              /s
            </div>
          )}
        </div>
        <div className="readout mt-1 px-2 py-0.5 sm:mt-1.5 sm:px-3 sm:py-1">
          <FormattedNumber
            value={momentum}
            className="readout-digits text-xl sm:text-[2rem] sm:leading-tight"
          />
        </div>
        <IncomeMultLine />
      </div>

      {WORKSHOP_CLICKER_ENABLED && surgeActive && (
        <div className="plate flex items-center gap-2 border-amber-400/60 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-100 sm:text-[10px]">
          <span className="led led-gold blink-soft" aria-hidden />
          {t.workshop.arcSurgeHud}
        </div>
      )}

      {WORKSHOP_CLICKER_ENABLED && clickCombo.count > 2 && !isRunning && (
        <div className="plate inline-flex items-center gap-2 px-3 py-1 font-mono text-[9px] text-brand-200 sm:text-[10px]">
          {t.workshop.clickStreak} <span className="font-bold text-brand-300">{clickCombo.count}</span>
        </div>
      )}

      {showRunCard && (
        <div className={`plate px-3 py-2 ${isRunning ? "border-amber-400/50" : ""}`}>
          <div className="silk flex items-center gap-2 text-[9px]">
            {isRunning ? (
              <>
                <span className="led led-gold blink-soft" aria-hidden />
                <span className="text-amber-200">{t.hud.runInProgress}</span>
              </>
            ) : (
              t.hud.lastRun
            )}
          </div>
          <FormattedNumber
            value={runMomentum}
            prefix="+"
            className="font-mono text-lg font-bold text-amber-200 sm:text-xl"
          />
          <div className="mt-0.5 font-mono text-[9px] text-slate-500">
            {t.hud.best} <FormattedNumberInline value={bestRunMomentum} /> · {t.hud.runs} {totalRuns}
          </div>
        </div>
      )}

      {showTokenCard && (
        <div
          className={`plate px-3 py-2 ${
            tokenReady
              ? "border-yellow-300/90 shadow-[0_0_30px_-6px_rgb(var(--c-yellow-400)/0.9)]"
              : goldenActive
                ? "border-yellow-300/60"
                : ""
          }`}
          title={t.hud.goldenTokensTitle}
        >
          <div className="silk flex items-center gap-2 text-[9px] text-yellow-300/90">
            <Coins size={12} strokeWidth={2} aria-hidden />
            <span className="truncate">
              {tokenReady
                ? t.hud.tokensReady(pendingGoldenTokens)
                : goldenActive
                  ? t.hud.tokenBonusActive
                  : t.hud.goldenTokens}
            </span>
          </div>
          <div className="font-mono text-lg font-bold text-yellow-200 sm:text-xl">
            {tokenReady ? (
              <>
                <span className="text-2xl sm:text-3xl">{pendingGoldenTokens}</span>
                <span className="ml-2 text-[10px] text-yellow-200/80">
                  {t.hud.tokensCaught(totalGoldenTokens)}
                </span>
              </>
            ) : (
              totalGoldenTokens
            )}
          </div>
          <div className="mt-0.5 font-mono text-[9px] text-slate-500">
            {t.hud.bonusDuration((goldenTokenBonusMs / 1000).toFixed(1))}
          </div>
        </div>
      )}
    </div>
  );
}

const EXPIRE_WARN_MS = 2500;
const FADE_OUT_MS = 480;
const ENTER_MS = 320;

type BuffPhase = "enter" | "active" | "expiring" | "exit";

type BuffRow = {
  key: string;
  defId: string;
  expiresAt?: number;
  persistentRemainingMs?: number;
  maxDurationMs?: number;
  phase: BuffPhase;
};

function timedKey(defId: string, expiresAt: number) {
  return `t:${defId}:${expiresAt}`;
}

function persistentKey(defId: string) {
  return `p:${defId}`;
}

function buffRowClass(phase: BuffPhase) {
  if (phase === "enter") return "buff-enter";
  if (phase === "expiring") return "buff-expiring";
  if (phase === "exit") return "buff-exit";
  return "";
}

const VISIBLE_BUFF_SLOTS = 5;
const BUFF_ROW_HEIGHT_PX = 44;
const BUFF_ROW_GAP_PX = 6;

function ActiveBuffsPanel() {
  const t = useT();
  const lang = useLang();
  const activeModifiers = useGameStore((s) => s.activeModifiers);
  const persistentBonuses = useGameStore((s) => s.persistentBonuses);
  const [rows, setRows] = useState<BuffRow[]>([]);
  const [now, setNow] = useState(() => performance.now());
  const exitTimers = useRef(new Map<string, number>());
  const enterTimers = useRef(new Map<string, number>());

  const persistentGrouped = useMemo(() => {
    const totals = new Map<string, number>();
    const t = performance.now();
    const seen = new Set<string>();
    for (const bonus of persistentBonuses) {
      if (seen.has(bonus.defId)) continue;
      seen.add(bonus.defId);
      const total = sumPersistentRemainingMs(persistentBonuses, bonus.defId, t);
      if (total <= 0) continue;
      totals.set(bonus.defId, total);
    }
    return [...totals.entries()];
  }, [persistentBonuses]);

  const removeRow = useCallback((key: string) => {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }, []);

  const queueEnter = useCallback((key: string) => {
    if (enterTimers.current.has(key)) return;
    const id = window.setTimeout(() => {
      enterTimers.current.delete(key);
      setRows((prev) =>
        prev.map((row) =>
          row.key === key && row.phase === "enter" ? { ...row, phase: "active" } : row
        )
      );
    }, ENTER_MS);
    enterTimers.current.set(key, id);
  }, []);

  useEffect(() => {
    const liveTimed = new Set(
      activeModifiers.map((m) => timedKey(m.defId, m.expiresAt))
    );
    const livePersistent = new Map(persistentGrouped);

    setRows((prev) => {
      const next = [...prev];
      let changed = false;

      for (const m of activeModifiers) {
        const key = timedKey(m.defId, m.expiresAt);
        if (next.some((row) => row.key === key)) continue;
        next.push({
          key,
          defId: m.defId,
          expiresAt: m.expiresAt,
          maxDurationMs: modifierDurationCapMs(m.defId),
          phase: "enter",
        });
        queueEnter(key);
        changed = true;
      }

      for (const [defId, persistentRemainingMs] of persistentGrouped) {
        const key = persistentKey(defId);
        const capMs = modifierDurationCapMs(defId);
        const existing = next.find((row) => row.key === key);
        if (existing) {
          if (
            (existing.persistentRemainingMs !== persistentRemainingMs ||
              existing.maxDurationMs !== capMs) &&
            existing.phase !== "exit"
          ) {
            existing.persistentRemainingMs = persistentRemainingMs;
            existing.maxDurationMs = capMs;
            existing.phase = "active";
            changed = true;
          }
          continue;
        }
        next.push({
          key,
          defId,
          persistentRemainingMs,
          maxDurationMs: capMs,
          phase: "enter",
        });
        queueEnter(key);
        changed = true;
      }

      for (const row of next) {
        if (row.phase === "exit") continue;
        if (row.expiresAt !== undefined) {
          if (!liveTimed.has(row.key)) {
            row.phase = "exit";
            changed = true;
          }
        } else if (!livePersistent.has(row.defId)) {
          row.phase = "exit";
          changed = true;
        }
      }

      if (!changed) return prev;
      return next;
    });
  }, [activeModifiers, persistentGrouped, queueEnter]);

  useEffect(() => {
    for (const row of rows) {
      if (row.phase !== "exit" || exitTimers.current.has(row.key)) continue;
      const id = window.setTimeout(() => {
        exitTimers.current.delete(row.key);
        removeRow(row.key);
      }, FADE_OUT_MS);
      exitTimers.current.set(row.key, id);
    }
  }, [rows, removeRow]);

  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    const needsTick =
      activeModifiers.length > 0 ||
      persistentBonuses.length > 0 ||
      rowsRef.current.some(
        (row) =>
          (row.expiresAt !== undefined || row.persistentRemainingMs !== undefined) &&
          row.phase !== "exit"
      );
    if (!needsTick) return;

    let raf = 0;
    const tick = () => {
      const t = performance.now();
      setNow(t);

      const livePersistent = new Map<string, number>();
      const bonuses = useGameStore.getState().persistentBonuses;
      const seen = new Set<string>();
      for (const bonus of bonuses) {
        if (seen.has(bonus.defId)) continue;
        seen.add(bonus.defId);
        const total = sumPersistentRemainingMs(bonuses, bonus.defId, t);
        if (total <= 0) continue;
        livePersistent.set(bonus.defId, total);
      }

      setRows((prev) => {
        let changed = false;
        const next = prev.map((row) => {
          if (row.phase === "exit") return row;

          if (row.expiresAt !== undefined) {
            const remaining = row.expiresAt - t;
            if (remaining <= 0) {
              changed = true;
              return { ...row, phase: "exit" as const };
            }
            if (
              remaining <= EXPIRE_WARN_MS &&
              (row.phase === "active" || row.phase === "enter")
            ) {
              changed = true;
              return { ...row, phase: "expiring" as const };
            }
            return row;
          }

          if (row.persistentRemainingMs !== undefined) {
            const remaining = livePersistent.get(row.defId) ?? 0;
            if (remaining <= 0) {
              changed = true;
              return { ...row, phase: "exit" as const };
            }
            if (remaining !== row.persistentRemainingMs) {
              changed = true;
              const nextPhase =
                remaining <= EXPIRE_WARN_MS &&
                (row.phase === "active" || row.phase === "enter")
                  ? ("expiring" as const)
                  : row.phase;
              return {
                ...row,
                persistentRemainingMs: remaining,
                phase: nextPhase,
              };
            }
          }

          return row;
        });
        return changed ? next : prev;
      });

      const stillNeeds =
        useGameStore.getState().activeModifiers.length > 0 ||
        useGameStore.getState().persistentBonuses.some(
          (b) => getPersistentRemainingMs(b, t) > 0
        ) ||
        rowsRef.current.some(
          (row) =>
            (row.expiresAt !== undefined || row.persistentRemainingMs !== undefined) &&
            row.phase !== "exit"
        );
      if (stillNeeds) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activeModifiers.length, persistentBonuses.length, rows.length]);

  useEffect(() => {
    const exit = exitTimers.current;
    const enter = enterTimers.current;
    return () => {
      for (const id of exit.values()) window.clearTimeout(id);
      for (const id of enter.values()) window.clearTimeout(id);
      exit.clear();
      enter.clear();
    };
  }, []);

  // A pickup adds the same buff twice: a timed modifier and a cross-run
  // persistent stack. Show one row per buff: the persistent row stays hidden
  // while its timed twin is live and takes over when that one expires.
  const liveTimedIds = new Set(
    rows.filter((r) => r.expiresAt !== undefined && r.phase !== "exit").map((r) => r.defId)
  );
  const visibleRows = rows.filter(
    (r) => r.persistentRemainingMs === undefined || !liveTimedIds.has(r.defId)
  );
  if (visibleRows.length === 0) return null;

  return (
    <div
      className="scrollbar-thin flex gap-1.5 overflow-x-auto overscroll-contain pb-1
        flex-row items-center
        sm:flex-col sm:items-stretch sm:gap-1.5 sm:pb-0 sm:w-52 sm:max-w-[min(18rem,calc(100vw-2rem))] md:w-80"
      style={{
        maxHeight:
          BUFF_ROW_HEIGHT_PX * VISIBLE_BUFF_SLOTS +
          BUFF_ROW_GAP_PX * (VISIBLE_BUFF_SLOTS - 1),
      }}
    >
      {visibleRows.map((row) => {
        const def = MODIFIER_MAP.get(row.defId);
        if (!def) return null;
        const remaining =
          row.expiresAt !== undefined
            ? getRemainingMs({ defId: row.defId, expiresAt: row.expiresAt }, now)
            : row.persistentRemainingMs ?? 0;
        const maxDuration = row.maxDurationMs ?? modifierDurationCapMs(row.defId);
        const pct = Math.max(0, Math.min(1, remaining / maxDuration));
        const isPersistent = row.persistentRemainingMs !== undefined;
        // Trade-off modifiers (Glass Cannon) carry a warning mark so the
        // downside is visible at a glance, not only in the tooltip.
        const defName = `${def.risky ? "⚠ " : ""}${locName(lang, "modifier", row.defId, def.name)}`;
        const defDescription = locDesc(lang, "modifier", row.defId, def.description);

        return (
          <div
            key={row.key}
            className={`plate relative shrink-0 overflow-hidden ${buffRowClass(row.phase)}
              /* Mobile: compact horizontal pills with name + time */
              h-8 rounded-md text-[9px] px-1.5
              /* sm+: original taller cards */
              sm:h-10 sm:rounded-xl sm:text-xs sm:px-0 sm:w-full md:h-12`}
            style={
              {
                "--buff-glow": `${def.color}99`,
              } as CSSProperties
            }
            title={
              isPersistent
                ? t.hud.buffStacksTitle(
                    defDescription,
                    (remaining / 1000).toFixed(1),
                    (modifierDurationCapMs(row.defId) / 1000).toFixed(0)
                  )
                : defDescription
            }
          >
            {/* Mobile compact version: dot + truncated name + time (single line for minimal height) */}
            <div className="sm:hidden flex h-full items-center gap-1">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{
                  background: def.color,
                  boxShadow:
                    row.phase === "expiring"
                      ? `0 0 8px ${def.color}`
                      : `0 0 4px ${def.color}99`,
                }}
              />
              <span className="min-w-0 max-w-[72px] truncate text-[8px] font-medium leading-none text-slate-100">
                {defName}
              </span>
              <span className="shrink-0 tabular-nums text-[9px] font-medium text-slate-200">
                {(remaining / 1000).toFixed(0)}s
              </span>
            </div>

            {/* Desktop / larger screens: full card with name + progress */}
            <div className="hidden sm:flex sm:h-full sm:items-center sm:gap-2 sm:px-3 sm:pb-1">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full sm:h-3 sm:w-3"
                style={{
                  background: def.color,
                  boxShadow:
                    row.phase === "expiring"
                      ? `0 0 10px ${def.color}`
                      : `0 0 6px ${def.color}88`,
                }}
              />
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wide text-slate-100">
                {defName}
              </span>
              <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-slate-300">
                {(remaining / 1000).toFixed(1)}s
              </span>
            </div>

            {/* Progress bar (only on sm+) */}
            <div className="hidden sm:block absolute inset-x-2 bottom-1 h-[3px] overflow-hidden rounded-full bg-slate-950/90">
              <div
                className="h-full transition-[width] duration-100 ease-linear"
                style={{ width: `${pct * 100}%`, background: def.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function HUD({
  buffsBottomOffset,
}: {
  buffsBottomOffset?: number;
}) {
  const t = useT();
  const combo = useGameStore((s) => s.combo);
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const comboWindow = 1800;
  const sinceHit = now - combo.lastHitAt;
  const comboActive = combo.count > 1 && sinceHit < comboWindow;
  const comboDecayPct = Math.max(0, Math.min(1, 1 - sinceHit / comboWindow));

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <div className="pointer-events-none flex items-start justify-end p-3 pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] sm:p-5 sm:pr-[max(1.25rem,env(safe-area-inset-right))] sm:pt-[max(1.25rem,env(safe-area-inset-top))]">
        {comboActive && (
          <div className="plate toast-pop border-amber-400/50 px-3 py-1.5 text-right sm:px-4 sm:py-2.5" key={Math.min(combo.count, 999)}>
            <div className="silk text-[9px] text-amber-200/80 sm:text-[10px]">
              {t.hud.combo}
            </div>
            <div className="font-display text-2xl font-black italic leading-none text-amber-200 sm:text-4xl">
              ×{combo.count}
            </div>
            <div className="meter mt-1.5 h-1 w-full">
              <span
                className="transition-[width] duration-100 ease-linear"
                style={{ width: `${comboDecayPct * 100}%`, background: "rgb(var(--c-amber-300))" }}
              />
            </div>
          </div>
        )}
      </div>

      <div
        className="pointer-events-none flex flex-1 items-end justify-end p-3 pr-[max(1rem,env(safe-area-inset-right))] sm:p-5 sm:pr-[max(1.25rem,env(safe-area-inset-right))] md:pb-5"
        style={
          buffsBottomOffset != null ? { paddingBottom: buffsBottomOffset } : undefined
        }
      >
        <ActiveBuffsPanel />
      </div>

      <Hint />
    </div>
  );
}

function Hint() {
  const t = useT();
  const totalRuns = useGameStore((s) => s.totalRuns);
  const isRunning = useGameStore((s) => s.isRunning);
  if (totalRuns > 0 || isRunning) return null;
  return (
    <div className="plate pointer-events-none absolute bottom-48 left-1/2 w-[min(20rem,calc(100%-1.5rem))] -translate-x-1/2 px-3 py-1.5 text-center font-mono text-[11px] text-slate-300 sm:bottom-52 sm:w-[min(22rem,calc(100%-2rem))] sm:px-4 sm:py-2 sm:text-xs md:bottom-44 md:w-auto">
      {t.hud.hintBefore}
      <span className="font-semibold text-brand-300">{t.controls.startRun}</span>
      {t.hud.hintAfter}
    </div>
  );
}
