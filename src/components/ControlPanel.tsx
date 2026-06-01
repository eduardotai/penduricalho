import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../state/store";
import { useEquippedAttachment, useEquippedPendulum, useEquippedSite } from "../state/selectors";
import { playUiClick } from "../audio/soundMap";
import { AudioManager } from "../audio/AudioManager";
import { useT, useLang, locName } from "../i18n";

const AUTO_RUN_DELAY_MS = 1500;

interface ControlPanelProps {
  onOpenCustomize: () => void;
  onOpenSettings: () => void;
  onOpenTutorial?: () => void; // still passed from App, but button moved into Settings
  onOpenAchievements: () => void;
}

export default function ControlPanel({ onOpenCustomize, onOpenSettings, onOpenAchievements }: ControlPanelProps) {
  const t = useT();
  const lang = useLang();
  const isRunning = useGameStore((s) => s.isRunning);
  const runStalled = useGameStore((s) => s.runStalled);
  const totalRuns = useGameStore((s) => s.totalRuns);
  const startRun = useGameStore((s) => s.startRun);
  const hardEndRun = useGameStore((s) => s.hardEndRun);
  const [hardEndConfirmOpen, setHardEndConfirmOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pendingGoldenTokens = useGameStore((s) => s.pendingGoldenTokens);
  const spendGoldenToken = useGameStore((s) => s.spendGoldenToken);
  const autoRun = useGameStore((s) => s.autoRun);
  const autoToken = useGameStore((s) => s.autoToken);
  const toggleAutoRun = useGameStore((s) => s.toggleAutoRun);
  const toggleAutoToken = useGameStore((s) => s.toggleAutoToken);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendulum = useEquippedPendulum();
  const attachment = useEquippedAttachment();
  const site = useEquippedSite();

  const hasRunBefore = totalRuns > 0 || isRunning;
  const buttonLabel = hasRunBefore ? t.controls.runAgain : t.controls.startRun;
  const canLaunch = !isRunning || runStalled;

  const hasToken = pendingGoldenTokens > 0;
  const canSpendToken = hasToken && isRunning;

  useEffect(() => {
    if (!hardEndConfirmOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setHardEndConfirmOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hardEndConfirmOpen]);

  useEffect(() => {
    if (!canSpendToken) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.repeat) return;
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        spendGoldenToken();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSpendToken, spendGoldenToken]);

  useEffect(() => {
    if (!autoRun || !canLaunch) {
      if (countdownRef.current !== null) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      setCountdown(0);
      return;
    }
    // Run Again is available with autoRun on — start countdown
    setCountdown(AUTO_RUN_DELAY_MS);
    const start = Date.now();
    countdownRef.current = setInterval(() => {
      const remaining = AUTO_RUN_DELAY_MS - (Date.now() - start);
      if (remaining <= 0) {
        setCountdown(0);
        if (countdownRef.current !== null) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      } else {
        setCountdown(remaining);
      }
    }, 50);
    return () => {
      if (countdownRef.current !== null) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [autoRun, canLaunch]);

  return (
    <div className="pointer-events-auto w-full min-w-0">
      <div className="flex w-full flex-col items-stretch gap-1.5 rounded-2xl border border-slate-700/60 bg-slate-950/85 p-2 shadow-xl backdrop-blur sm:gap-2 sm:p-3">
        <div className="hidden px-2 pt-1 pb-2 text-center md:block">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">{t.controls.loadout}</div>
          <div className="text-xs text-slate-300">
            {locName(lang, "pendulum", pendulum.id, pendulum.name)}
            <span className="text-slate-600"> · </span>
            {locName(lang, "attachment", attachment.id, attachment.name)}
            <span className="text-slate-600"> · </span>
            {locName(lang, "site", site.id, site.name)}
          </div>
        </div>

        {hasToken && (
          <button
            onClick={() => {
              if (!canSpendToken) return;
              AudioManager.unlock();
              playUiClick();
              spendGoldenToken();
            }}
            disabled={!canSpendToken}
            className={`group relative w-full overflow-hidden rounded-xl px-4 py-2.5 font-display text-sm font-extrabold uppercase tracking-wider transition-all sm:px-6 sm:py-3 sm:text-base ${
              canSpendToken
                ? "animate-pulse bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 text-slate-900 shadow-[0_0_25px_-3px_rgba(250,204,21,0.85)] hover:shadow-[0_0_35px_-3px_rgba(250,204,21,1)] active:scale-[0.98]"
                : "cursor-not-allowed bg-yellow-900/40 text-yellow-200/60"
            }`}
            title={
              canSpendToken
                ? t.controls.tokenSpendTitle
                : t.controls.tokenIdleTitle
            }
          >
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/40 text-xs">
                  {pendingGoldenTokens}
                </span>
                {t.controls.useToken}
              </span>
              <span className="rounded bg-slate-900/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider">
                G
              </span>
            </span>
          </button>
        )}

        <button
          onClick={() => {
            if (!canLaunch) return;
            AudioManager.unlock();
            playUiClick();
            startRun();
          }}
          disabled={!canLaunch}
          className={`group relative w-full overflow-hidden rounded-xl px-4 py-3 font-display text-base font-bold uppercase tracking-wider transition-all sm:px-6 sm:py-4 sm:text-lg ${
            canLaunch
              ? "bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg hover:shadow-brand-500/30 active:scale-[0.98]"
              : "cursor-not-allowed bg-slate-800 text-slate-500"
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {isRunning && !runStalled && (
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-300" />
            )}
            {isRunning && !runStalled ? t.controls.clickBobToSwing : buttonLabel}
          </span>
        </button>

        {isRunning && !runStalled && (
          <p className="text-center text-[10px] leading-snug text-brand-300/90">
            {t.controls.clickBobArenaHint}
          </p>
        )}

        {autoRun && canLaunch && countdown > 0 && (
          <div className="text-center text-xs text-slate-400">
            {t.controls.nextRunIn}{" "}
            <span className="font-semibold text-brand-400">
              {(countdown / 1000).toFixed(1)}s
            </span>
            …
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            playUiClick();
            setMoreOpen((v) => !v);
          }}
          className="flex w-full items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-300 transition-colors hover:bg-slate-800 md:hidden"
          aria-expanded={moreOpen}
        >
          {moreOpen ? t.controls.less : t.controls.more}
          <span aria-hidden className={moreOpen ? "rotate-180" : ""}>
            ⌄
          </span>
        </button>

        <div
          className={`${moreOpen ? "flex" : "hidden"} flex-col gap-2 md:flex`}
        >
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => {
              playUiClick();
              toggleAutoRun();
            }}
            className={`rounded-xl border px-2 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors sm:px-3 sm:py-2 sm:text-xs ${
              autoRun
                ? "border-brand-500/60 bg-brand-900/40 text-brand-300 hover:bg-brand-900/60"
                : "border-slate-700 bg-slate-900/70 text-slate-400 hover:border-slate-500 hover:bg-slate-800"
            }`}
          >
            {t.controls.autoRun}{" "}
            <span className={autoRun ? "text-brand-400" : "text-slate-600"}>
              {autoRun ? t.controls.on : t.controls.off}
            </span>
          </button>
          <button
            onClick={() => {
              playUiClick();
              toggleAutoToken();
            }}
            className={`rounded-xl border px-2 py-2 text-[10px] font-semibold uppercase tracking-wide transition-colors sm:px-3 sm:py-2 sm:text-xs ${
              autoToken
                ? "border-yellow-500/60 bg-yellow-900/30 text-yellow-300 hover:bg-yellow-900/50"
                : "border-slate-700 bg-slate-900/70 text-slate-400 hover:border-slate-500 hover:bg-slate-800"
            }`}
          >
            {t.controls.autoToken}{" "}
            <span className={autoToken ? "text-yellow-400" : "text-slate-600"}>
              {autoToken ? t.controls.on : t.controls.off}
            </span>
          </button>
        </div>

        {/* Primary navigation */}
        <div className="grid grid-cols-[1fr_1.35fr_1fr] gap-1 rounded-xl border border-slate-700/70 bg-slate-950/55 p-1 sm:grid-cols-1 sm:gap-1.5 sm:p-1.5">
          <button
            onClick={() => {
              AudioManager.unlock();
              playUiClick();
              onOpenCustomize();
            }}
            className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-bold uppercase text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white sm:justify-start sm:px-4 sm:text-sm"
            aria-label={t.controls.shop}
          >
            <span className="text-base leading-none" aria-hidden>
              🛒
            </span>
            <span className="hidden min-w-0 truncate leading-none sm:inline">{t.controls.shop}</span>
          </button>

          <button
            onClick={() => {
              AudioManager.unlock();
              playUiClick();
              onOpenAchievements();
            }}
            className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-2 py-2 text-[9px] font-extrabold uppercase text-slate-950 shadow-[0_0_18px_-8px_rgba(251,191,36,0.9)] transition-colors hover:bg-amber-300 sm:justify-start sm:px-4 sm:text-sm"
            aria-label={t.controls.achievements ?? "Achievements"}
          >
            <span className="text-base leading-none" aria-hidden>
              🏆
            </span>
            <span className="min-w-0 truncate leading-none">
              {t.controls.achievements ?? "Achievements"}
            </span>
          </button>

          <button
            onClick={() => {
              AudioManager.unlock();
              playUiClick();
              onOpenSettings();
            }}
            className="flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-bold uppercase text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white sm:justify-start sm:px-4 sm:text-sm"
            aria-label={t.controls.settings}
          >
            <span className="text-base leading-none" aria-hidden>
              ⚙️
            </span>
            <span className="hidden min-w-0 truncate leading-none sm:inline">{t.controls.settings}</span>
          </button>
        </div>

        {/* How to Play was moved into Settings (see Controls/Data tab) */}

        {hardEndConfirmOpen ? (
          <div className="w-full rounded-xl border border-rose-500/50 bg-rose-950/40 p-4">
            <p className="mb-3 text-xs leading-relaxed text-rose-100/90">
              {isRunning
                ? t.controls.hardEndConfirmRunning
                : t.controls.hardEndConfirmIdle}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  hardEndRun();
                  setHardEndConfirmOpen(false);
                }}
                className="w-full rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-rose-500 sm:py-2.5"
              >
                {t.controls.endRun}
              </button>
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  setHardEndConfirmOpen(false);
                }}
                className="w-full rounded-lg border border-slate-600 bg-slate-900/80 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 sm:py-2 sm:text-sm"
              >
                {t.controls.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              playUiClick();
              setHardEndConfirmOpen(true);
            }}
            className="w-full rounded-xl border border-rose-900/60 bg-rose-950/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-200 transition-colors hover:border-rose-600/60 hover:bg-rose-950/50 sm:px-6 sm:py-2.5 sm:text-sm"
          >
            {t.controls.hardEndRun}
          </button>
        )}
        </div>
      </div>
    </div>
  );
}
