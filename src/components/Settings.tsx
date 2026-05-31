import { useEffect, useState, type ReactNode } from "react";
import {
  useGameStore,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_DEFAULT,
} from "../state/store";
import { playGameSound, playUiClick } from "../audio/soundMap";
import { AudioManager } from "../audio/AudioManager";
import { BACKGROUND_MUSIC_CREDIT } from "../audio/backgroundMusic";
import { useT, LANGUAGES, type Lang } from "../i18n";

type SettingsTab = "audio" | "display" | "controls" | "language";

interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

export default function Settings({ open, onClose }: SettingsProps) {
  const t = useT();
  const [tab, setTab] = useState<SettingsTab>("audio");

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "audio", label: t.settings.tabAudio },
    { id: "display", label: t.settings.tabDisplay },
    { id: "controls", label: t.settings.tabControls },
    { id: "language", label: t.settings.tabLanguage },
  ];

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
            <h2 className="font-display text-xl font-bold text-slate-100">{t.settings.title}</h2>
            <p className="text-xs text-slate-400">
              {t.settings.subtitle}
            </p>
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

        <nav className="flex gap-1 border-b border-slate-800 px-3 py-2">
          {tabs.map((tabDef) => (
            <button
              key={tabDef.id}
              onClick={() => {
                playUiClick();
                setTab(tabDef.id);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                tab === tabDef.id
                  ? "bg-brand-600 text-white"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              {tabDef.label}
            </button>
          ))}
        </nav>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {tab === "audio" && <AudioTab />}
          {tab === "display" && <DisplayTab />}
          {tab === "controls" && <ControlsTab />}
          {tab === "language" && <LanguageTab />}
        </div>
      </div>
    </div>
  );
}

function AudioTab() {
  const t = useT();
  const audio = useGameStore((s) => s.audio);
  const setAudioMasterVolume = useGameStore((s) => s.setAudioMasterVolume);
  const setAudioSfxVolume = useGameStore((s) => s.setAudioSfxVolume);
  const setAudioUiVolume = useGameStore((s) => s.setAudioUiVolume);
  const setAudioMusicVolume = useGameStore((s) => s.setAudioMusicVolume);
  const setAudioMuted = useGameStore((s) => s.setAudioMuted);
  const setAudioMusicEnabled = useGameStore((s) => s.setAudioMusicEnabled);

  function previewSound() {
    AudioManager.unlock();
    playGameSound("ui-buy");
  }

  return (
    <div className="space-y-5">
      <SettingsSection title={t.settings.output}>
        <ToggleRow
          label={t.settings.muteAll}
          description={t.settings.muteAllDesc}
          checked={audio.muted}
          onChange={setAudioMuted}
        />
      </SettingsSection>

      <SettingsSection title={t.settings.volume}>
        <SliderRow
          label={t.settings.master}
          value={audio.masterVolume}
          onChange={setAudioMasterVolume}
          disabled={audio.muted}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <SliderRow
          label={t.settings.gameplaySfx}
          value={audio.sfxVolume}
          onChange={setAudioSfxVolume}
          disabled={audio.muted}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <SliderRow
          label={t.settings.uiSounds}
          value={audio.uiVolume}
          onChange={setAudioUiVolume}
          disabled={audio.muted}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <SliderRow
          label={t.settings.backgroundMusic}
          value={audio.musicVolume}
          onChange={setAudioMusicVolume}
          disabled={audio.muted || !audio.musicEnabled}
          format={(v) => `${Math.round(v * 100)}%`}
          hint={t.settings.musicHint}
        />
      </SettingsSection>

      <SettingsSection title={t.settings.music}>
        <ToggleRow
          label={t.settings.backgroundMusic}
          description={t.settings.musicToggleDesc}
          checked={audio.musicEnabled}
          onChange={setAudioMusicEnabled}
          disabled={audio.muted}
        />
        <p className="text-[11px] leading-relaxed text-slate-600">
          {BACKGROUND_MUSIC_CREDIT}
        </p>
      </SettingsSection>

      <button
        type="button"
        onClick={previewSound}
        disabled={audio.muted}
        className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {t.settings.previewSound}
      </button>
    </div>
  );
}

function DisplayTab() {
  const t = useT();
  const cameraZoom = useGameStore((s) => s.cameraZoom);
  const setCameraZoom = useGameStore((s) => s.setCameraZoom);
  const resetDisplaySettings = useGameStore((s) => s.resetDisplaySettings);

  return (
    <div className="space-y-5">
      <SettingsSection title={t.settings.camera}>
        <SliderRow
          label={t.settings.zoom}
          value={cameraZoom}
          min={CAMERA_ZOOM_MIN}
          max={CAMERA_ZOOM_MAX}
          step={0.05}
          onChange={setCameraZoom}
          format={(v) => `${Math.round(v * 100)}%`}
          hint={t.settings.zoomHint}
        />
        <p className="text-xs leading-relaxed text-slate-500">
          {t.settings.cameraNote(Math.round(CAMERA_ZOOM_DEFAULT * 100))}
        </p>
      </SettingsSection>

      <button
        type="button"
        onClick={() => {
          playUiClick();
          resetDisplaySettings();
        }}
        className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800"
      >
        {t.settings.resetCamera}
      </button>
    </div>
  );
}

function ControlsTab() {
  const t = useT();
  const shortcuts = t.settings.shortcuts;

  return (
    <div className="space-y-5">
      <SettingsSection title={t.settings.keyboardMouse}>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5"
            >
              <span className="text-sm text-slate-300">{s.action}</span>
              <kbd className="shrink-0 rounded border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </SettingsSection>

      <p className="text-xs leading-relaxed text-slate-500">
        {t.settings.controlsNote}
      </p>
    </div>
  );
}

function LanguageTab() {
  const t = useT();
  const language = useGameStore((s) => s.language);
  const setLanguage = useGameStore((s) => s.setLanguage);

  return (
    <div className="space-y-5">
      <SettingsSection title={t.settings.languageHeading}>
        <div className="space-y-2">
          {LANGUAGES.map((l) => {
            const active = language === l.id;
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  playUiClick();
                  setLanguage(l.id as Lang);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                  active
                    ? "border-brand-500/60 bg-brand-500/10 text-brand-100"
                    : "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-600 hover:bg-slate-800"
                }`}
              >
                <span>{l.label}</span>
                {active && (
                  <span className="text-xs uppercase tracking-wide text-brand-300">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] leading-relaxed text-slate-600">
          {t.settings.languageNote}
        </p>
      </SettingsSection>
    </div>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  disabled = false,
  min = 0,
  max = 1,
  step = 0.05,
  format,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  format: (value: number) => string;
  hint?: string;
}) {
  return (
    <div className={disabled ? "opacity-40" : undefined}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-sm text-slate-300">{label}</label>
        <span className="tabular-nums text-xs text-slate-500">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="h-1.5 w-full cursor-pointer accent-brand-400 disabled:cursor-not-allowed"
      />
      {hint && <p className="mt-2 text-[11px] leading-relaxed text-slate-600">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <div>
        <div className="text-sm font-medium text-slate-200">{label}</div>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          playUiClick();
          onChange(!checked);
        }}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          checked ? "bg-brand-500" : "bg-slate-700"
        } disabled:cursor-not-allowed`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
