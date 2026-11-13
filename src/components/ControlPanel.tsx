import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../state/store";
import { useEquippedAttachment, useEquippedPendulum, useEquippedSite } from "../state/selectors";
import { playUiClick } from "../audio/soundMap";
import { AudioManager } from "../audio/AudioManager";
import { useT, useLang, locName } from "../i18n";
import { WORKSHOP_CLICKER_ENABLED } from "../config/features";
import { ActiveComboLine } from "./RigCombos";
import {
  ChevronDown,
  Coins,
  Play,
  RotateCcw,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trophy,
} from "lucide-react";
import { ICON_STROKE, PendulumGlyph, type IconComponent } from "./ui/icons";

const AUTO_RUN_DELAY_MS = 1500;

interface ControlPanelProps {
  onOpenCustomize: () => void;
  onOpenSettings: () => void;
  onOpenTutorial?: () => void; // still passed from App, but button moved into Settings
  onOpenAchievements: () => void;
  onOpenPrestige: () => void;
}

export default function ControlPanel({ onOpenCustomize, onOpenSettings, onOpenAchievements, onOpenPrestige }: ControlPanelProps) {
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

  const navKeys: {
    label: string;
    icon: IconComponent;
    onClick: () => void;
    accent?: boolean;
    testId: string;
  }[] = [
    { label: t.controls.shop, icon: ShoppingBag, onClick: onOpenCustomize, testId: "nav-shop" },
    { label: t.controls.achievements ?? "Achievements", icon: Trophy, onClick: onOpenAchievements, accent: true, testId: "nav-achievements" },
    { label: t.prestige.button, icon: Sparkles, onClick: onOpenPrestige, testId: "nav-prestige" },
    { label: t.controls.settings, icon: SlidersHorizontal, onClick: onOpenSettings, testId: "nav-settings" },
  ];
  const running = isRunning && !runStalled;

  return (
    <div className="pointer-events-auto w-full min-w-0">
      <div className="plate plate-screws flex w-full flex-col items-stretch gap-2 p-2.5 sm:gap-2.5 sm:p-3.5">
        <div className="hidden items-center gap-2.5 px-1 pt-0.5 md:flex">
          <div className="well flex h-9 w-9 shrink-0 items-center justify-center text-brand-300">
            <PendulumGlyph size={20} className={running ? "swing" : undefined} />
          </div>
          <div className="min-w-0">
            <div className="silk">{t.controls.loadout}</div>
            <div className="truncate text-[11px] leading-snug text-slate-300">
              {locName(lang, "pendulum", pendulum.id, pendulum.name)}
              <span className="text-slate-600"> / </span>
              {locName(lang, "attachment", attachment.id, attachment.name)}
              <span className="text-slate-600"> / </span>
              {locName(lang, "site", site.id, site.name)}
            </div>
          </div>
          <ActiveComboLine pendulumId={pendulum.id} attachmentId={attachment.id} />
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
            className={`key key-gold min-h-[48px] w-full justify-between px-3 text-sm ${canSpendToken ? "" : "opacity-60"}`}
            title={canSpendToken ? t.controls.tokenSpendTitle : t.controls.tokenIdleTitle}
          >
            <span className="flex items-center gap-2">
              <Coins size={18} strokeWidth={ICON_STROKE} aria-hidden />
              {t.controls.useToken}
              <span className="rounded bg-slate-950/25 px-1.5 font-mono text-xs">{pendingGoldenTokens}</span>
            </span>
            <kbd className="rounded border border-slate-950/30 bg-slate-950/15 px-1.5 font-mono text-[10px]">G</kbd>
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
          data-testid="launch"
          className={`key ${canLaunch ? "key-primary" : ""} min-h-[56px] w-full whitespace-nowrap px-3 sm:min-h-[64px] ${running ? "text-sm" : "text-base"}`}
        >
          {running ? (
            <>
              <PendulumGlyph size={22} className="swing" />
              {t.controls.running}
            </>
          ) : (
            <>
              {hasRunBefore ? (
                <RotateCcw size={20} strokeWidth={2.25} aria-hidden />
              ) : (
                <Play size={20} strokeWidth={2.25} fill="currentColor" aria-hidden />
              )}
              {buttonLabel}
            </>
          )}
        </button>

        {WORKSHOP_CLICKER_ENABLED && running && (
          <p className="text-center font-mono text-[10px] leading-snug text-brand-300/80">
            Workshop power multiplies arena payouts. Watch the spectacle.
          </p>
        )}

        {autoRun && canLaunch && countdown > 0 && (
          <div className="flex items-center gap-2 px-1">
            <span className="silk shrink-0">{t.controls.nextRunIn}</span>
            <div className="meter flex-1">
              <span style={{ width: `${(1 - countdown / AUTO_RUN_DELAY_MS) * 100}%` }} />
            </div>
            <span className="font-mono text-xs font-semibold text-brand-300">
              {(countdown / 1000).toFixed(1)}s
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            playUiClick();
            setMoreOpen((v) => !v);
          }}
          className="key key-ghost min-h-[36px] w-full text-[11px] md:hidden"
          aria-expanded={moreOpen}
        >
          {moreOpen ? t.controls.less : t.controls.more}
          <ChevronDown size={14} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} aria-hidden />
        </button>

        <div className={`${moreOpen ? "flex" : "hidden"} flex-col gap-2 sm:gap-2.5 md:flex`}>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                playUiClick();
                toggleAutoRun();
              }}
              role="switch"
              aria-checked={autoRun}
              className="switch min-h-[40px] text-left"
            >
              <span className={`led ${autoRun ? "led-on" : ""}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase leading-tight tracking-wide">
                  {t.controls.autoRun}
                </span>
                <span className={`font-mono text-[9px] ${autoRun ? "text-brand-300" : "text-slate-500"}`}>
                  {autoRun ? t.controls.on : t.controls.off}
                </span>
              </span>
            </button>
            <button
              onClick={() => {
                playUiClick();
                toggleAutoToken();
              }}
              role="switch"
              aria-checked={autoToken}
              className="switch min-h-[40px] text-left"
            >
              <span className={`led ${autoToken ? "led-gold" : ""}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase leading-tight tracking-wide">
                  {t.controls.autoToken}
                </span>
                <span className={`font-mono text-[9px] ${autoToken ? "text-yellow-300" : "text-slate-500"}`}>
                  {autoToken ? t.controls.on : t.controls.off}
                </span>
              </span>
            </button>
          </div>

          {/* Primary navigation: four keycaps. */}
          <div className="well grid grid-cols-4 gap-1.5 p-1.5 md:grid-cols-2">
            {navKeys.map((k) => {
              const I = k.icon;
              return (
                <button
                  key={k.testId}
                  data-testid={k.testId}
                  onClick={() => {
                    AudioManager.unlock();
                    playUiClick();
                    k.onClick();
                  }}
                  aria-label={k.label}
                  title={k.label}
                  className={`key ${k.accent ? "key-gold" : ""} min-h-[52px] min-w-0 flex-col gap-1 px-1 py-1.5 text-[9px] sm:text-[10px] md:min-h-[58px]`}
                >
                  <I size={19} strokeWidth={ICON_STROKE} aria-hidden />
                  <span className="max-w-full truncate leading-none">{k.label}</span>
                </button>
              );
            })}
          </div>

          {hardEndConfirmOpen ? (
            <div className="hazard w-full rounded-xl border border-rose-500/50 p-3">
              <p className="mb-3 rounded-md bg-slate-950/80 p-2 text-xs leading-relaxed text-rose-100/90">
                {isRunning ? t.controls.hardEndConfirmRunning : t.controls.hardEndConfirmIdle}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playUiClick();
                    setHardEndConfirmOpen(false);
                  }}
                  className="key key-ghost min-h-[40px] text-xs"
                >
                  {t.controls.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playUiClick();
                    hardEndRun();
                    setHardEndConfirmOpen(false);
                  }}
                  className="key key-danger min-h-[40px] text-xs"
                >
                  {t.controls.endRun}
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
              className="key key-ghost min-h-[36px] w-full text-[10px] text-rose-300 sm:text-[11px]"
            >
              <Square size={12} strokeWidth={2.5} fill="currentColor" aria-hidden />
              {t.controls.hardEndRun}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
