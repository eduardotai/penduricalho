import { useEffect, useRef } from "react";
import { Play, SlidersHorizontal, CircleHelp } from "lucide-react";
import { useGameStore } from "../state/store";
import { useLang, useT } from "../i18n";
import { formatNumber } from "../lib/formatNumber";
import { PendulumGlyph } from "./ui/icons";

interface Props {
  open: boolean;
  onEnter: () => void;
  onHowTo: () => void;
  onSettings: () => void;
}

/**
 * Title card shown once per page load, over the live (blurred) arena. It is
 * also the audio gate: the first click/key here unlocks Web Audio, so the
 * menu theme can start on a real user gesture.
 */
export default function TitleScreen({ open, onEnter, onHowTo, onSettings }: Props) {
  const t = useT();
  const lang = useLang();
  const momentum = useGameStore((s) => s.momentum);
  const enterRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    enterRef.current?.focus({ preventScroll: true });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        onEnter();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onEnter]);

  if (!open) return null;

  const word = "PENDURICALHO";

  return (
    <div
      className="scrim-in fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden px-6 text-center"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, rgb(var(--c-slate-900) / 0.55), rgb(var(--c-slate-950) / 0.92) 70%)",
        WebkitBackdropFilter: "blur(6px)",
        backdropFilter: "blur(6px)",
      }}
      data-testid="title-screen"
      data-no-camera-zoom
    >
      {/* Big swinging mark */}
      <div className="relative mb-6 h-32 w-24" aria-hidden>
        <div className="absolute left-1/2 top-0 h-2 w-20 -translate-x-1/2 rounded-sm bg-slate-500 shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]" />
        <div className="swing absolute left-1/2 top-1 h-28 w-px origin-top -translate-x-1/2" style={{ animationDuration: "2.8s" }}>
          <div className="mx-auto h-24 w-px bg-gradient-to-b from-slate-400 to-slate-500" />
          <div className="-ml-[11px] h-6 w-6 rounded-full bg-gradient-to-br from-brand-300 to-brand-600 shadow-[0_0_30px_rgb(var(--c-brand-500)/0.8)]" />
        </div>
      </div>

      <div className="silk silk-tick mb-2 text-brand-300">{t.title.kicker}</div>
      <h1
        className="font-display text-[clamp(2.2rem,9vw,6.5rem)] font-black uppercase leading-[0.9] text-slate-50"
        style={{ fontStretch: "125%", letterSpacing: "-0.01em", animation: "title-in 900ms var(--ease-out) both" }}
        aria-label={word}
      >
        {word}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">{t.title.tagline}</p>

      {momentum > 0 && (
        <div className="readout mt-5 px-4 py-1.5">
          <span className="readout-digits text-sm">{t.title.continueAs(formatNumber(momentum, "short", lang))}</span>
        </div>
      )}

      <div className="mt-7 flex w-full max-w-sm flex-col gap-2.5">
        <button
          ref={enterRef}
          type="button"
          data-testid="title-enter"
          onClick={onEnter}
          className="key key-primary min-h-[60px] w-full text-lg"
        >
          <Play size={20} strokeWidth={2.25} fill="currentColor" aria-hidden />
          {t.title.enter}
        </button>
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onHowTo} className="key key-ghost min-h-[44px] text-xs">
            <CircleHelp size={16} aria-hidden />
            {t.controls.howToPlay}
          </button>
          <button type="button" onClick={onSettings} className="key key-ghost min-h-[44px] text-xs">
            <SlidersHorizontal size={16} aria-hidden />
            {t.controls.settings}
          </button>
        </div>
      </div>
      <p className="blink-soft mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{t.title.pressAnyKey}</p>

      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">
        <PendulumGlyph size={12} />
        redesign · test build
      </div>
    </div>
  );
}
