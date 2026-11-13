import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import Window, { type WindowTab } from "./ui/Window";
import {
  CircleHelp,
  Disc3,
  Gamepad2,
  SkipForward,
  Languages,
  Monitor,
  Save,
  SlidersHorizontal,
  Volume2,
} from "lucide-react";
import {
  useGameStore,
  CAMERA_ZOOM_MIN,
  CAMERA_ZOOM_MAX,
  CAMERA_ZOOM_DEFAULT,
} from "../state/store";
import {
  downloadSaveFile,
  exportSaveString,
  importSaveString,
} from "../state/saveTransfer";
import { playGameSound, playUiClick } from "../audio/soundMap";
import { AudioManager } from "../audio/AudioManager";
import { MusicDirector, trackTitle } from "../audio/musicDirector";
import { MUSIC_TRACKS } from "../audio/musicTracks";
import { useT, LANGUAGES, type Lang } from "../i18n";

type SettingsTab = "audio" | "display" | "controls" | "language" | "data";

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  onOpenTutorial?: () => void;
}

export default function Settings({ open, onClose, onOpenTutorial }: SettingsProps) {
  const t = useT();
  const [tab, setTab] = useState<SettingsTab>("audio");

  const tabs: WindowTab<SettingsTab>[] = [
    { id: "audio", label: t.settings.tabAudio, icon: Volume2 },
    { id: "display", label: t.settings.tabDisplay, icon: Monitor },
    { id: "controls", label: t.settings.tabControls, icon: Gamepad2 },
    { id: "language", label: t.settings.tabLanguage, icon: Languages },
    { id: "data", label: t.settings.tabData, icon: Save },
  ];

  return (
    <Window
      open={open}
      onClose={onClose}
      title={t.settings.title}
      subtitle={t.settings.subtitle}
      icon={SlidersHorizontal}
      code="04 / SETUP"
      closeLabel={t.settings.close}
      tabs={tabs}
      activeTab={tab}
      onTab={setTab}
      sizeClass="sm:h-[min(680px,90vh)] sm:max-w-xl"
      testId="settings-window"
      footer={
        onOpenTutorial ? (
          <button
            onClick={() => {
              playUiClick();
              onClose(); // close settings first
              onOpenTutorial(); // then open tutorial
            }}
            className="key key-ghost min-h-[40px] w-full text-xs"
          >
            <CircleHelp size={16} strokeWidth={2} aria-hidden />
            {t.controls.howToPlay}
          </button>
        ) : undefined
      }
    >
      {tab === "audio" && <AudioTab />}
      {tab === "display" && <DisplayTab />}
      {tab === "controls" && <ControlsTab />}
      {tab === "language" && <LanguageTab />}
      {tab === "data" && <DataTab />}
    </Window>
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
        <NowPlaying />
      </SettingsSection>

      <button
        type="button"
        onClick={previewSound}
        disabled={audio.muted}
        className="key key-ghost min-h-[42px] w-full text-xs"
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
        className="key key-ghost min-h-[42px] w-full text-xs"
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
              className="card flex items-center justify-between gap-4 px-3 py-2.5"
            >
              <span className="text-sm text-slate-300">{s.action}</span>
              <kbd className="key shrink-0 px-2 py-0.5 font-mono text-[11px] normal-case tracking-normal text-slate-200">
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
                className={`card flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-bold uppercase tracking-wide ${
                  active ? "card-lit text-brand-100" : "text-slate-300"
                }`}
              >
                <span>{l.label}</span>
                {active && (
                  <span className="led led-on" aria-hidden />
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

function DataTab() {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function errorMessage(reason: "empty" | "invalid" | "unrecognized"): string {
    if (reason === "empty") return t.settings.importErrorEmpty;
    if (reason === "unrecognized") return t.settings.importErrorUnrecognized;
    return t.settings.importErrorInvalid;
  }

  function applyImport(text: string) {
    setError(null);
    const result = importSaveString(text);
    if (!result.ok) {
      setError(errorMessage(result.reason));
      return;
    }
    if (!window.confirm(t.settings.importConfirm)) return;
    setSuccess(true);
    // Reload so the store rehydrates from the freshly written localStorage.
    setTimeout(() => window.location.reload(), 350);
  }

  async function onCopy() {
    playUiClick();
    setError(null);
    setNotice(null);
    try {
      await navigator.clipboard.writeText(exportSaveString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (e.g. insecure context) — fall back to a download.
      downloadSaveFile();
      setNotice(t.settings.copyFallback);
    }
  }

  function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Allow re-picking the same file later by clearing the input value.
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => applyImport(String(reader.result ?? ""));
    reader.onerror = () => setError(t.settings.importErrorInvalid);
    reader.readAsText(file);
  }

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-slate-400">{t.settings.dataIntro}</p>

      <SettingsSection title={t.settings.exportSection}>
        <p className="text-xs leading-relaxed text-slate-500">{t.settings.exportDesc}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              playUiClick();
              setError(null);
              setNotice(null);
              downloadSaveFile();
            }}
            className="key min-h-[42px] px-4 text-xs"
          >
            {t.settings.downloadSave}
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="key min-h-[42px] px-4 text-xs"
          >
            {copied ? t.settings.copied : t.settings.copySave}
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title={t.settings.importSection}>
        <p className="text-xs leading-relaxed text-slate-500">{t.settings.importDesc}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="text/plain,application/json,.txt,.json"
          onChange={onPickFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => {
            playUiClick();
            setError(null);
            fileInputRef.current?.click();
          }}
          className="key key-ghost min-h-[42px] w-full text-xs"
        >
          {t.settings.loadSaveFile}
        </button>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={t.settings.pastePlaceholder}
          rows={3}
          className="readout scrollbar-thin w-full resize-y px-3 py-2 font-mono text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            playUiClick();
            setNotice(null);
            applyImport(pasted);
          }}
          disabled={!pasted.trim()}
          className="key key-primary min-h-[44px] w-full text-xs"
        >
          {t.settings.applyPasted}
        </button>
      </SettingsSection>

      {error && (
        <p className="card border-rose-700/60 px-3 py-2 text-xs leading-relaxed text-rose-200">
          {error}
        </p>
      )}
      {notice && (
        <p className="card border-sky-700/60 px-3 py-2 text-xs leading-relaxed text-sky-200">
          {notice}
        </p>
      )}
      {success && (
        <p className="card border-emerald-700/60 px-3 py-2 text-xs leading-relaxed text-emerald-200">
          {t.settings.importSuccess}
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-slate-600">{t.settings.safetyNote}</p>
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
      <h3 className="silk silk-tick mb-3">{title}</h3>
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
        <label className="text-xs font-bold uppercase tracking-wide text-slate-200">{label}</label>
        <span className="readout px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-brand-300">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        aria-label={label}
        className="fader w-full cursor-pointer disabled:cursor-not-allowed"
        style={{ "--fill": `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
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
      className={`card flex items-start justify-between gap-4 px-4 py-3 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-slate-100">{label}</div>
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
        aria-label={label}
        className={`well relative inline-flex h-7 w-14 shrink-0 items-center rounded-md p-0.5 transition-colors disabled:cursor-not-allowed ${
          checked ? "!bg-[rgb(var(--c-brand-500)/0.25)]" : ""
        }`}
      >
        <span
          aria-hidden="true"
          className={`key pointer-events-none flex h-6 w-6 items-center justify-center rounded transition-transform duration-200 ${
            checked ? "translate-x-7" : "translate-x-0"
          }`}
        >
          <span className={`led ${checked ? "led-on" : ""}`} />
        </span>
      </button>
    </div>
  );
}

function NowPlaying() {
  const t = useT();
  const [playing, setPlaying] = useState<string | null>(MusicDirector.nowPlaying);
  useEffect(() => MusicDirector.subscribe(setPlaying), []);
  return (
    <div className="space-y-2">
      <div className="readout flex items-center gap-3 px-3 py-2">
        <Disc3
          size={22}
          strokeWidth={1.75}
          className={`shrink-0 text-brand-300 ${playing ? "animate-spin [animation-duration:3s]" : "opacity-40"}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="silk text-[9px]">{t.music.nowPlaying}</div>
          <div className="readout-digits truncate text-sm" data-testid="now-playing">
            {trackTitle(playing) ?? "—"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            playUiClick();
            MusicDirector.next();
          }}
          disabled={!playing}
          aria-label="Next track"
          className="key key-ghost key-icon h-9 w-9"
        >
          <SkipForward size={16} aria-hidden />
        </button>
      </div>
      <div>
        <div className="silk mb-1 text-[9px]">{t.music.tracks}</div>
        <ul className="space-y-1 font-mono text-[10px] text-slate-400">
          {MUSIC_TRACKS.map((tr) => (
            <li key={tr.id} className="flex items-center gap-2">
              <span className={`led ${tr.id === playing ? "led-on" : ""}`} aria-hidden />
              <span className="text-slate-200">{tr.title}</span>
              <span className="text-slate-600">
                · {tr.mood === "menu" ? t.music.menuTrack : t.music.runTrack} · {tr.license}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">{t.music.credit}</p>
    </div>
  );
}
