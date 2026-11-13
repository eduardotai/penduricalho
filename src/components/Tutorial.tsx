import { playUiClick } from "../audio/soundMap";
import { useT } from "../i18n";
import Window from "./ui/Window";
import { PendulumGlyph } from "./ui/icons";
import { Play } from "lucide-react";

interface TutorialProps {
  open: boolean;
  onClose: () => void;
}

/** How to Play: the bench's operating procedure, one numbered step per card. */
export default function Tutorial({ open, onClose }: TutorialProps) {
  const t = useT();

  return (
    <Window
      open={open}
      onClose={onClose}
      title={t.tutorial.title}
      subtitle={t.tutorial.subtitle}
      icon={PendulumGlyph as never}
      code="00 / MANUAL"
      closeLabel={t.settings.close}
      sizeClass="sm:h-[min(680px,90vh)] sm:max-w-xl"
      testId="tutorial-window"
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              playUiClick();
              onClose();
            }}
            className="key key-primary min-h-[52px] w-full px-6 text-base"
          >
            <Play size={18} strokeWidth={2.25} fill="currentColor" aria-hidden />
            {t.tutorial.start}
          </button>
          <p className="mt-2 text-center font-mono text-[10px] text-slate-500">{t.tutorial.reopenHint}</p>
        </>
      }
    >
      <ol className="space-y-2">
        {t.tutorial.steps.map((step, i) => (
          <li key={step.title} className="card flex gap-3 p-3">
            <span
              className="readout flex h-10 w-10 shrink-0 items-center justify-center font-mono text-lg font-bold text-brand-300"
              aria-hidden
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="font-display text-sm font-bold uppercase tracking-wide text-slate-50">{step.title}</div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Window>
  );
}
