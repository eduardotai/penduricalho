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
    <div className="pointer-events-none space-y-3">
      <div className="inline-block rounded-2xl bg-slate-900/70 px-3 py-1.5 backdrop-blur sm:px-5 sm:py-3">
        <div className="text-[9px] uppercase tracking-widest text-slate-400 sm:text-xs">
          {t.hud.momentum}
        </div>
        <FormattedNumber
          value={momentum}
          className="font-display text-xl font-bold text-brand-300 sm:text-3xl"
        />
        {cachedTotalCps > 0 && (
          <div className="mt-0.5 text-[9px] text-slate-500 sm:text-[10px]">
            {t.workshop.cpsShort}{" "}
            <FormattedNumberInline value={Math.floor(cachedTotalCps * 10) / 10} />
            /s
          </div>
        )}
      </div>

      {surgeActive && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-500/20 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-amber-100">
          {t.workshop.arcSurgeHud}
        </div>
      )}

      {clickCombo.count > 2 && !isRunning && (
        <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-[9px] text-brand-200">
          {t.workshop.clickStreak} {clickCombo.count}
        </div>
      )}

      {showRunCard && (
        <div
          className={`rounded-xl border px-3 py-1.5 backdrop-blur ${
            isRunning
              ? "border-amber-500/40 bg-amber-500/15"
              : "border-slate-700/60 bg-slate-900/70"
          }`}
        >
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-slate-400">
            {isRunning ? (
              <>
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
                {t.hud.runInProgress}
              </>
            ) : (
              t.hud.lastRun
            )}
          </div>
          <FormattedNumber
            value={runMomentum}
            prefix="+"
            className="font-display text-lg font-semibold text-amber-200 sm:text-xl"
          />
          <div className="mt-0.5 text-[9px] text-slate-500">
            {t.hud.best} <FormattedNumberInline value={bestRunMomentum} /> ·{" "}
            {t.hud.runs} {totalRuns}
          </div>
        </div>
      )}

      {showTokenCard && (
        <div
          className={`rounded-xl border px-3 py-1.5 backdrop-blur ${
            tokenReady
              ? "border-yellow-300 bg-yellow-400/25 shadow-[0_0_30px_-3px_rgba(250,204,21,0.9)]"
              : goldenActive
                ? "border-yellow-300/70 bg-yellow-400/15 shadow-[0_0_25px_-5px_rgba(250,204,21,0.7)]"
                : "border-yellow-700/40 bg-slate-900/70"
          }`}
          title={t.hud.goldenTokensTitle}
        >
          <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-yellow-300/90">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full bg-yellow-300 ${
                tokenReady ? "animate-pulse" : ""
              }`}
            />
            {tokenReady
              ? t.hud.tokensReady(pendingGoldenTokens)
              : goldenActive
                ? t.hud.tokenBonusActive
                : t.hud.goldenTokens}
          </div>
          <div className="font-display text-lg font-semibold text-yellow-200 sm:text-xl">
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
          <div className="mt-0.5 text-[9px] text-slate-500">
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

  if (rows.length === 0) return null;

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
      {rows.map((row) => {
        const def = MODIFIER_MAP.get(row.defId);
        if (!def) return null;
        const remaining =
          row.expiresAt !== undefined
            ? getRemainingMs({ defId: row.defId, expiresAt: row.expiresAt }, now)
            : row.persistentRemainingMs ?? 0;
        const maxDuration = row.maxDurationMs ?? modifierDurationCapMs(row.defId);
        const pct = Math.max(0, Math.min(1, remaining / maxDuration));
        const isPersistent = row.persistentRemainingMs !== undefined;
        const defName = locName(lang, "modifier", row.defId, def.name);
        const defDescription = locDesc(lang, "modifier", row.defId, def.description);

        return (
          <div
            key={row.key}
            className={`relative shrink-0 overflow-hidden border border-slate-700/60 bg-slate-950/88 backdrop-blur ${buffRowClass(row.phase)}
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
              <span className="min-w-0 flex-1 truncate font-semibold text-slate-100">
                {defName}
              </span>
              <span className="shrink-0 tabular-nums font-medium text-slate-300">
                {(remaining / 1000).toFixed(1)}s
              </span>
            </div>

            {/* Progress bar (only on sm+) */}
            <div className="hidden sm:block absolute inset-x-0 bottom-0 h-1 bg-slate-800/90">
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
          <div className="rounded-2xl bg-amber-500/20 px-2.5 py-1.5 text-right backdrop-blur sm:px-5 sm:py-3">
            <div className="text-[9px] uppercase tracking-widest text-amber-200/80 sm:text-xs">
              {t.hud.combo}
            </div>
            <div className="font-display text-xl font-bold text-amber-200 sm:text-3xl">
              x{combo.count}
            </div>
            <div className="mt-1 h-0.5 w-full overflow-hidden rounded bg-amber-900/50">
              <div
                className="h-full bg-amber-300 transition-[width] duration-100 ease-linear"
                style={{ width: `${comboDecayPct * 100}%` }}
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
    <div className="pointer-events-none absolute bottom-48 left-1/2 w-[min(20rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl bg-slate-900/80 px-3 py-1.5 text-center text-xs text-slate-300 backdrop-blur sm:bottom-52 sm:w-[min(22rem,calc(100%-2rem))] sm:px-4 sm:py-2 sm:text-sm md:bottom-44 md:w-auto">
      {t.hud.hintBefore}
      <span className="font-semibold text-brand-300">{t.controls.startRun}</span>
      {t.hud.hintAfter}
    </div>
  );
}
