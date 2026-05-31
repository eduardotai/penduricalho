import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useGameStore, modifierDurationCapMs } from "../state/store";
import { MODIFIER_MAP } from "../data/modifiers";
import {
  getRemainingMs,
  getPersistentRemainingMs,
  sumPersistentRemainingMs,
} from "../game/modifiers";
import { FormattedNumber, FormattedNumberInline } from "./FormattedNumber";

export function HUDStats() {
  const momentum = useGameStore((s) => s.momentum);
  const runMomentum = useGameStore((s) => s.runMomentum);
  const isRunning = useGameStore((s) => s.isRunning);
  const totalRuns = useGameStore((s) => s.totalRuns);
  const bestRunMomentum = useGameStore((s) => s.bestRunMomentum);
  const activeModifiers = useGameStore((s) => s.activeModifiers);
  const totalGoldenTokens = useGameStore((s) => s.totalGoldenTokens);
  const goldenTokenBonusMs = useGameStore((s) => s.goldenTokenBonusMs);
  const pendingGoldenTokens = useGameStore((s) => s.pendingGoldenTokens);

  const showRunCard = isRunning || runMomentum > 0;
  const goldenActive = activeModifiers.find((m) => m.defId === "token-bonus");
  const tokenReady = pendingGoldenTokens > 0;
  const showTokenCard = totalGoldenTokens > 0 || !!goldenActive || tokenReady;

  return (
    <div className="pointer-events-none space-y-3">
      <div className="rounded-2xl bg-slate-900/70 px-5 py-3 backdrop-blur">
        <div className="text-xs uppercase tracking-widest text-slate-400">Momentum</div>
        <FormattedNumber
          value={momentum}
          className="font-display text-3xl font-bold text-brand-300"
        />
      </div>

      {showRunCard && (
        <div
          className={`rounded-xl border px-4 py-2 backdrop-blur ${
            isRunning
              ? "border-amber-500/40 bg-amber-500/15"
              : "border-slate-700/60 bg-slate-900/70"
          }`}
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-400">
            {isRunning ? (
              <>
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-300" />
                Run in progress
              </>
            ) : (
              "Last run"
            )}
          </div>
          <FormattedNumber
            value={runMomentum}
            prefix="+"
            className="font-display text-xl font-semibold text-amber-200"
          />
          <div className="mt-0.5 text-[10px] text-slate-500">
            Best <FormattedNumberInline value={bestRunMomentum} /> · Runs{" "}
            {totalRuns}
          </div>
        </div>
      )}

      {showTokenCard && (
        <div
          className={`rounded-xl border px-4 py-2 backdrop-blur ${
            tokenReady
              ? "border-yellow-300 bg-yellow-400/25 shadow-[0_0_30px_-3px_rgba(250,204,21,0.9)]"
              : goldenActive
                ? "border-yellow-300/70 bg-yellow-400/15 shadow-[0_0_25px_-5px_rgba(250,204,21,0.7)]"
                : "border-yellow-700/40 bg-slate-900/70"
          }`}
          title="Golden Tokens go into your ready slot. Press Use Token (or G) mid-run to re-launch the Bob and gain x3 points."
        >
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-yellow-300/90">
            <span
              className={`inline-block h-2 w-2 rounded-full bg-yellow-300 ${
                tokenReady ? "animate-pulse" : ""
              }`}
            />
            {tokenReady
              ? `${pendingGoldenTokens} READY — press G`
              : goldenActive
                ? "Token Bonus active"
                : "Golden Tokens"}
          </div>
          <div className="font-display text-xl font-semibold text-yellow-200">
            {tokenReady ? (
              <>
                <span className="text-3xl">{pendingGoldenTokens}</span>
                <span className="ml-2 text-xs text-yellow-200/80">
                  / {totalGoldenTokens} caught
                </span>
              </>
            ) : (
              totalGoldenTokens
            )}
          </div>
          <div className="mt-0.5 text-[10px] text-slate-500">
            Bonus duration +{(goldenTokenBonusMs / 1000).toFixed(1)}s
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
const BUFF_ROW_HEIGHT_PX = 48;
const BUFF_ROW_GAP_PX = 8;

function ActiveBuffsPanel() {
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
      className="scrollbar-thin flex w-80 max-w-[min(20rem,calc(100vw-2.5rem))] flex-col items-stretch gap-2 overflow-y-auto overscroll-contain"
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

        return (
          <div
            key={row.key}
            className={`relative h-12 shrink-0 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950/88 backdrop-blur ${buffRowClass(row.phase)}`}
            style={
              {
                "--buff-glow": `${def.color}99`,
              } as CSSProperties
            }
            title={
              isPersistent
                ? `${def.description} Stacks for ${(remaining / 1000).toFixed(1)}s (max ${(modifierDurationCapMs(row.defId) / 1000).toFixed(0)}s).`
                : def.description
            }
          >
            <div className="flex h-full items-center gap-3 px-4 pb-1.5">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{
                  background: def.color,
                  boxShadow:
                    row.phase === "expiring"
                      ? `0 0 10px ${def.color}`
                      : `0 0 6px ${def.color}88`,
                }}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">
                {def.name}
              </span>
              <span className="shrink-0 text-sm tabular-nums font-medium text-slate-300">
                {(remaining / 1000).toFixed(1)}s
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-slate-800/90">
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

export default function HUD() {
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
      <div className="pointer-events-none flex items-start justify-end p-5 pr-[max(1.25rem,env(safe-area-inset-right))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        {comboActive && (
          <div className="rounded-2xl bg-amber-500/20 px-5 py-3 text-right backdrop-blur">
            <div className="text-xs uppercase tracking-widest text-amber-200/80">
              Combo
            </div>
            <div className="font-display text-3xl font-bold text-amber-200">
              x{combo.count}
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded bg-amber-900/50">
              <div
                className="h-full bg-amber-300 transition-[width] duration-100 ease-linear"
                style={{ width: `${comboDecayPct * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="pointer-events-none flex flex-1 items-end justify-end p-5 pr-[max(1.25rem,env(safe-area-inset-right))] pb-44 md:pb-5">
        <ActiveBuffsPanel />
      </div>

      <Hint />
    </div>
  );
}

function Hint() {
  const totalRuns = useGameStore((s) => s.totalRuns);
  const isRunning = useGameStore((s) => s.isRunning);
  if (totalRuns > 0 || isRunning) return null;
  return (
    <div className="pointer-events-none absolute bottom-56 left-1/2 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 rounded-xl bg-slate-900/80 px-4 py-2 text-center text-sm text-slate-300 backdrop-blur md:bottom-44 md:w-auto">
      Tap <span className="font-semibold text-brand-300">Start Run</span> to launch the Bob. Hit the glowing orbs to earn momentum.
    </div>
  );
}
