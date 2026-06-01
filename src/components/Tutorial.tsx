import { useEffect } from "react";
import { playUiClick } from "../audio/soundMap";
import { useT } from "../i18n";

interface TutorialProps {
  open: boolean;
  onClose: () => void;
}

export default function Tutorial({ open, onClose }: TutorialProps) {
  const t = useT();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4"
      data-no-camera-zoom
      onClick={onClose}
    >
      <div
        className="relative flex h-full max-h-[100dvh] w-full flex-col overflow-hidden border border-slate-700/60 bg-slate-950/95 shadow-2xl sm:h-[min(640px,88vh)] sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-100">
              🪀 {t.tutorial.title}
            </h2>
            <p className="text-xs text-slate-400">{t.tutorial.subtitle}</p>
          </div>
          <button
            onClick={() => {
              playUiClick();
              onClose();
            }}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md border border-slate-700 px-4 text-sm text-slate-300 hover:bg-slate-800"
          >
            {t.settings.close}
          </button>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">
          <ol className="space-y-3">
            {t.tutorial.steps.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 font-display text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {step.title}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <footer className="border-t border-slate-800 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => {
              playUiClick();
              onClose();
            }}
            className="w-full rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-3 font-display text-base font-bold uppercase tracking-wider text-white shadow-lg transition-all hover:shadow-brand-500/30 active:scale-[0.98]"
          >
            {t.tutorial.start}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-600">
            {t.tutorial.reopenHint}
          </p>
        </footer>
      </div>
    </div>
  );
}
