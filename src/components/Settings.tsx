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

type SettingsTab = "audio" | "display" | "controls";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "audio", label: "Audio" },
  { id: "display", label: "Display" },
  { id: "controls", label: "Controls" },
];

interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

export default function Settings({ open, onClose }: SettingsProps) {
  const [tab, setTab] = useState<SettingsTab>("audio");

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      data-no-camera-zoom
      onClick={onClose}
    >
      <div
        className="relative flex h-[min(640px,88vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-100">Settings</h2>
            <p className="text-xs text-slate-400">
              Audio, display, and control preferences.
            </p>
          </div>
          <button
            onClick={() => {
              playUiClick();
              onClose();
            }}
            className="shrink-0 rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
        </header>

        <nav className="flex gap-1 border-b border-slate-800 px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                playUiClick();
                setTab(t.id);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                tab === t.id
                  ? "bg-brand-600 text-white"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">
          {tab === "audio" && <AudioTab />}
          {tab === "display" && <DisplayTab />}
          {tab === "controls" && <ControlsTab />}
        </div>
      </div>
    </div>
  );
}

function AudioTab() {
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
      <SettingsSection title="Output">
        <ToggleRow
          label="Mute all audio"
          description="Silences every sound. Press M to toggle anytime."
          checked={audio.muted}
          onChange={setAudioMuted}
        />
      </SettingsSection>

      <SettingsSection title="Volume">
        <SliderRow
          label="Master"
          value={audio.masterVolume}
          onChange={setAudioMasterVolume}
          disabled={audio.muted}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <SliderRow
          label="Gameplay SFX"
          value={audio.sfxVolume}
          onChange={setAudioSfxVolume}
          disabled={audio.muted}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <SliderRow
          label="UI sounds"
          value={audio.uiVolume}
          onChange={setAudioUiVolume}
          disabled={audio.muted}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <SliderRow
          label="Background music"
          value={audio.musicVolume}
          onChange={setAudioMusicVolume}
          disabled={audio.muted || !audio.musicEnabled}
          format={(v) => `${Math.round(v * 100)}%`}
          hint="Kept low by default so gameplay SFX stay clear."
        />
      </SettingsSection>

      <SettingsSection title="Music">
        <ToggleRow
          label="Background music"
          description="Soft lofi loop while you play."
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
        Preview sound
      </button>
    </div>
  );
}

function DisplayTab() {
  const cameraZoom = useGameStore((s) => s.cameraZoom);
  const setCameraZoom = useGameStore((s) => s.setCameraZoom);
  const resetDisplaySettings = useGameStore((s) => s.resetDisplaySettings);

  return (
    <div className="space-y-5">
      <SettingsSection title="Camera">
        <SliderRow
          label="Zoom"
          value={cameraZoom}
          min={CAMERA_ZOOM_MIN}
          max={CAMERA_ZOOM_MAX}
          step={0.05}
          onChange={setCameraZoom}
          format={(v) => `${Math.round(v * 100)}%`}
          hint="Scroll the mouse wheel over the canvas to zoom in or out."
        />
        <p className="text-xs leading-relaxed text-slate-500">
          Default zoom is {Math.round(CAMERA_ZOOM_DEFAULT * 100)}%. Reset camera restores
          zoom and the standard playfield framing. Hold Space and drag to pan.
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
        Reset camera
      </button>
    </div>
  );
}

function ControlsTab() {
  const shortcuts = [
    { keys: "Start Run / Run Again", action: "Launch the pendulum" },
    { keys: "G", action: "Spend a ready golden token (mid-run)" },
    { keys: "M", action: "Toggle mute" },
    { keys: "Scroll", action: "Zoom camera in or out" },
    { keys: "Space + drag", action: "Pan the camera" },
    { keys: "Escape", action: "Close open menus" },
  ];

  return (
    <div className="space-y-5">
      <SettingsSection title="Keyboard & mouse">
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
        Camera zoom and pan are disabled while a menu is open.
      </p>
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
