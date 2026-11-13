import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { ICON_STROKE, type IconComponent } from "./icons";
import { playUiClick } from "../../audio/soundMap";

export interface WindowTab<T extends string> {
  id: T;
  label: string;
  icon?: IconComponent;
}

interface WindowProps<T extends string> {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  icon?: IconComponent;
  /** Short catalogue code shown on the lid, e.g. "03". */
  code?: string;
  closeLabel: string;
  /** Right side of the header (e.g. a Momentum readout). */
  headerExtra?: ReactNode;
  tabs?: WindowTab<T>[];
  activeTab?: T;
  onTab?: (id: T) => void;
  footer?: ReactNode;
  /** Tailwind max-width / height classes for the panel on sm+. */
  sizeClass?: string;
  testId?: string;
  children: ReactNode;
}

/**
 * Shared shell for every game window (Shop, Settings, Achievements, Prestige,
 * How to Play): a scrim, a drawer that rises from the bench, a lid with a
 * ruler strip, catalogue code, title and close key, optional index tabs and
 * footer. Esc and a click on the scrim close it.
 */
export default function Window<T extends string>({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  code,
  closeLabel,
  headerExtra,
  tabs,
  activeTab,
  onTab,
  footer,
  sizeClass = "sm:h-[min(720px,90vh)] sm:max-w-3xl",
  testId,
  children,
}: WindowProps<T>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="scrim-in fixed inset-0 z-50 flex items-end justify-center bg-[rgb(var(--c-slate-950)/0.72)] sm:items-center sm:p-4"
      style={{ backgroundImage: "radial-gradient(ellipse at 50% 120%, rgb(var(--c-brand-500) / 0.10), transparent 60%)" }}
      data-no-camera-zoom
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        className={`plate plate-screws win-rise relative flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-col overflow-hidden rounded-none outline-none sm:rounded-2xl ${sizeClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ruler mx-4 mt-[max(0.4rem,env(safe-area-inset-top))] shrink-0 sm:mt-2" aria-hidden />
        <header className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-2 sm:px-5">
          {Icon && (
            <div className="well flex h-11 w-11 shrink-0 items-center justify-center text-brand-300">
              <Icon size={22} strokeWidth={ICON_STROKE} aria-hidden />
            </div>
          )}
          <div className="min-w-0 flex-1">
            {code && <div className="silk silk-tick text-brand-400/90">{code}</div>}
            <h2 className="truncate font-display text-xl font-extrabold uppercase leading-tight tracking-wide text-slate-50 sm:text-2xl">
              {title}
            </h2>
            {subtitle && <div className="mt-0.5 text-xs leading-snug text-slate-400">{subtitle}</div>}
          </div>
          {headerExtra}
          <button
            type="button"
            onClick={() => {
              playUiClick();
              onClose();
            }}
            aria-label={closeLabel}
            title={closeLabel}
            className="key key-ghost key-icon h-11 w-11 shrink-0"
          >
            <X size={20} strokeWidth={2} aria-hidden />
          </button>
        </header>
        {tabs && tabs.length > 0 && (
          <nav className="tabbar shrink-0 px-3 sm:px-4" role="tablist">
            {tabs.map((tb) => {
              const TabIcon = tb.icon;
              return (
                <button
                  key={tb.id}
                  type="button"
                  role="tab"
                  aria-selected={tb.id === activeTab}
                  onClick={() => {
                    playUiClick();
                    onTab?.(tb.id);
                  }}
                  className="tab flex items-center gap-1.5"
                  aria-label={tb.label}
                >
                  {TabIcon && <TabIcon size={14} strokeWidth={2} aria-hidden />}
                  {tb.label}
                </button>
              );
            })}
          </nav>
        )}
        <div className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4">
          <div key={activeTab ?? "body"} className="stagger">
            {children}
          </div>
        </div>
        {footer && (
          <footer className="shrink-0 border-t border-slate-800/80 bg-slate-950/40 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
