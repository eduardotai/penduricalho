import { useState, useEffect, useRef } from "react";
import { Analytics } from "@vercel/analytics/react";
import GameCanvas from "./components/GameCanvas";
import HUD, { HUDStats } from "./components/HUD";
import Customize from "./components/Customize";
import Settings from "./components/Settings";
import Tutorial from "./components/Tutorial";
import ControlPanel from "./components/ControlPanel";
import IdleToast from "./components/IdleToast";
import Achievements from "./components/Achievements";
import Prestige from "./components/Prestige";
import AchievementToast from "./components/AchievementToast";
import { AudioManager } from "./audio/AudioManager";
import { playGameSound } from "./audio/soundMap";
import { useGameStore } from "./state/store";
import { startIdleEngine } from "./state/idleEngine";
import { startClickerEngine } from "./state/clickerEngine";
import WorkshopPanel from "./components/WorkshopPanel";
import TitleScreen from "./components/TitleScreen";
import { MusicDirector } from "./audio/musicDirector";
import { RUN_MOOD_LINGER_MS, resolveMood } from "./audio/musicTracks";
import { useUiPrefs } from "./state/uiPrefs";
import { useT } from "./i18n";
import { WORKSHOP_CLICKER_ENABLED } from "./config/features";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Wrench } from "lucide-react";
import { ICON_STROKE } from "./components/ui/icons";

export default function App() {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [prestigeOpen, setPrestigeOpen] = useState(false);
  const t = useT();
  const workshopOpen = useUiPrefs((s) => s.workshopOpen);
  const workshopSeen = useUiPrefs((s) => s.workshopSeen);
  const toggleWorkshop = useUiPrefs((s) => s.toggleWorkshop);
  // Auto-open the How-to-Play tutorial once for first-time players, then leave
  // it reopenable from the controls. tutorialSeen is read once on mount so a
  // mid-session dismiss doesn't fight the initial state.
  const [tutorialOpen, setTutorialOpen] = useState(false);
  // Title card once per page load; first-time players get the tutorial right
  // after it (tutorialSeen is read once so a mid-session dismiss doesn't fight).
  const [titleOpen, setTitleOpen] = useState(true);
  const isRunning = useGameStore((s) => s.isRunning);
  const dismissTutorial = useGameStore((s) => s.dismissTutorial);
  const toggleAudioMuted = useGameStore((s) => s.toggleAudioMuted);
  const audio = useGameStore((s) => s.audio);
  // Distance from the viewport bottom to the top of the bottom control bar, so
  // the buffs panel can sit just above it on mobile and stay visible even when
  // the controls expand. Undefined on md+, where the controls are a sidebar.
  const controlsRef = useRef<HTMLDivElement>(null);
  const [buffsBottomOffset, setBuffsBottomOffset] = useState<number | undefined>(
    undefined
  );

  useEffect(() => {
    const el = controlsRef.current;
    if (!el) return;
    const mq = window.matchMedia("(min-width: 768px)"); // Tailwind md
    function update() {
      if (mq.matches) {
        setBuffsBottomOffset(undefined);
        return;
      }
      const rect = el!.getBoundingClientRect();
      setBuffsBottomOffset(Math.max(0, Math.round(window.innerHeight - rect.top + 4)));
    }
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    mq.addEventListener("change", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      mq.removeEventListener("change", update);
    };
  }, []);

  // Keep the core idle gameplay running while the tab is hidden / the page is
  // closed: a worker-driven heartbeat banks Momentum at the recent earn rate,
  // and a wall-clock reconcile grants offline progress on return. See
  // state/idleEngine.ts.
  useEffect(() => startIdleEngine(), []);
  // Workshop clicker layer is feature-flagged: no panel, no passive CPS, no
  // Arc Surge procs while disabled. Flip WORKSHOP_CLICKER_ENABLED to restore.
  useEffect(
    () => (WORKSHOP_CLICKER_ENABLED ? startClickerEngine() : undefined),
    []
  );

  useEffect(() => {
    useGameStore.getState().recomputeWorkshop();
  }, []);

  // One-time retroactive achievement reconciliation on load (catches any
  // milestones the player already qualified for before the system existed).
  useEffect(() => {
    // Defer one tick so the persisted store is fully merged.
    const id = window.setTimeout(() => {
      useGameStore.getState().checkAchievements();
    }, 50);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const unlock = () => {
      AudioManager.unlock();
      AudioManager.syncMusic(useGameStore.getState().audio);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    AudioManager.syncMusic(audio);
  }, [audio]);

  // Soundtrack mood: arena tracks while runs are going (and briefly after, so
  // auto-run doesn't bounce between themes), the menu theme otherwise.
  const lastRunEndedAt = useRef<number | null>(null);
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !isRunning) lastRunEndedAt.current = Date.now();
    wasRunning.current = isRunning;
    const apply = () => MusicDirector.setMood(resolveMood(isRunning, lastRunEndedAt.current, Date.now()));
    apply();
    if (isRunning) return;
    const id = window.setTimeout(apply, RUN_MOOD_LINGER_MS + 50);
    return () => window.clearTimeout(id);
  }, [isRunning]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) {
        AudioManager.syncMusic({ ...useGameStore.getState().audio, musicEnabled: false });
      } else {
        AudioManager.syncMusic(useGameStore.getState().audio);
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.repeat) return;
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleAudioMuted();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleAudioMuted]);

  function enterFromTitle() {
    AudioManager.unlock();
    AudioManager.syncMusic(useGameStore.getState().audio);
    playGameSound("ui-modal-close");
    setTitleOpen(false);
    if (!useGameStore.getState().tutorialSeen) setTutorialOpen(true);
  }

  function openCustomize() {
    AudioManager.unlock();
    playGameSound("ui-modal-open");
    setCustomizeOpen(true);
  }

  function closeCustomize() {
    playGameSound("ui-modal-close");
    setCustomizeOpen(false);
  }

  function openSettings() {
    AudioManager.unlock();
    playGameSound("ui-modal-open");
    setSettingsOpen(true);
  }

  function closeSettings() {
    playGameSound("ui-modal-close");
    setSettingsOpen(false);
  }

  function openTutorial() {
    AudioManager.unlock();
    playGameSound("ui-modal-open");
    setTutorialOpen(true);
  }

  function closeTutorial() {
    playGameSound("ui-modal-close");
    setTutorialOpen(false);
    dismissTutorial();
  }

  function openAchievements() {
    AudioManager.unlock();
    playGameSound("ui-modal-open");
    setAchievementsOpen(true);
  }

  function openPrestige() {
    AudioManager.unlock();
    playGameSound("ui-modal-open");
    setPrestigeOpen(true);
  }

  function closePrestige() {
    playGameSound("ui-modal-close");
    setPrestigeOpen(false);
  }

  function closeAchievements() {
    playGameSound("ui-modal-close");
    setAchievementsOpen(false);
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <GameCanvas />
      {/* Hide HUD, workshop and toasts while the title card is up so they don't
          show through the scrim (the arena itself stays visible underneath). */}
      {!titleOpen && <>
      {/* On mobile the overlay spans the screen: stats pinned top, controls as a
          bottom action bar. At md+ it collapses back to the left sidebar. */}
      <aside
        className="pointer-events-none absolute inset-0 z-10 flex min-h-0 flex-col justify-between overflow-hidden
          p-2 pl-[max(0.5rem,env(safe-area-inset-left))] pt-[max(0.5rem,env(safe-area-inset-top))]
          pb-[max(0.5rem,env(safe-area-inset-bottom))]
          sm:p-3 sm:pl-[max(0.75rem,env(safe-area-inset-left))] sm:pt-[max(0.75rem,env(safe-area-inset-top))]
          sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]
          md:inset-y-0 md:right-auto md:w-80 md:max-w-[min(20rem,calc(100%-2rem))] md:justify-start md:overflow-y-auto md:p-6"
      >
        <div className="pointer-events-none max-h-[38dvh] max-w-[11rem] min-h-0 shrink overflow-y-auto overscroll-contain sm:max-h-[42dvh] sm:max-w-[min(20rem,calc(100%-1rem))] md:max-h-none md:max-w-none md:flex-1 md:shrink md:pb-4">
          <HUDStats />
        </div>
        <div className="pointer-events-none flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-y-auto md:gap-3 md:overflow-visible">
          {WORKSHOP_CLICKER_ENABLED && (
            <div className={`pointer-events-none flex min-h-0 flex-col items-center gap-1 md:hidden ${workshopOpen ? "flex-1 overflow-hidden" : "shrink-0"}`}>
              {/* Mobile: collapsed to a small tab by default; tap to open. */}
              <button
                type="button"
                data-testid="workshop-toggle-mobile"
                onClick={toggleWorkshop}
                aria-expanded={workshopOpen}
                aria-controls="workshop-panel-mobile"
                aria-label={workshopOpen ? t.workshop.close : t.workshop.open}
                className={`key pointer-events-auto min-h-[36px] rounded-full px-4 text-[11px] text-brand-200 ${
                  !workshopSeen ? "blink-soft" : ""
                }`}
              >
                <Wrench size={14} strokeWidth={2} aria-hidden />
                {workshopOpen ? <ChevronDown size={14} aria-hidden /> : <ChevronUp size={14} aria-hidden />}
                {t.workshop.title}
              </button>
              {workshopOpen && (
                <div
                  id="workshop-panel-mobile"
                  className="pointer-events-auto min-h-0 w-full flex-1 overflow-y-auto overscroll-contain rounded-2xl"
                >
                  <WorkshopPanel />
                </div>
              )}
            </div>
          )}
          <div className="pointer-events-none flex shrink-0 justify-center md:block">
            <div
              ref={controlsRef}
              className="pointer-events-auto w-full max-w-md md:max-w-none"
            >
              <ControlPanel
                onOpenCustomize={openCustomize}
                onOpenSettings={openSettings}
                onOpenAchievements={openAchievements}
                onOpenPrestige={openPrestige}
                workshopOpen={workshopOpen}
              />
            </div>
          </div>
        </div>
      </aside>
      {WORKSHOP_CLICKER_ENABLED && (
        <>
          {/* Desktop: slides in from the right edge; collapsed by default so
              the arena gets the space. */}
          <aside
            id="workshop-panel-desktop"
            aria-hidden={!workshopOpen}
            className={`pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-80 max-w-[min(20rem,calc(100%-2rem))] flex-col justify-center p-4 pr-[max(1rem,env(safe-area-inset-right))] transition-transform duration-300 ease-out md:flex ${
              workshopOpen ? "translate-x-0" : "invisible translate-x-full"
            }`}
          >
            <div className="relative">
              <button
                type="button"
                data-testid="workshop-collapse"
                onClick={toggleWorkshop}
                aria-label={t.workshop.close}
                aria-controls="workshop-panel-desktop"
                aria-expanded={workshopOpen}
                className="key pointer-events-auto absolute -left-9 top-1/2 h-16 w-9 -translate-y-1/2 rounded-l-xl rounded-r-none text-brand-300"
              >
                <ChevronRight size={18} strokeWidth={2.25} aria-hidden />
              </button>
              <WorkshopPanel />
            </div>
          </aside>
          {!workshopOpen && (
            <button
              type="button"
              data-testid="workshop-open"
              onClick={toggleWorkshop}
              aria-label={t.workshop.open}
              aria-controls="workshop-panel-desktop"
              aria-expanded={false}
              title={t.workshop.title}
              className={`plate absolute right-0 top-1/2 z-10 hidden w-10 -translate-y-1/2 flex-col items-center justify-center gap-2 rounded-r-none border-r-0 py-3 pr-[env(safe-area-inset-right)] text-brand-300 transition-colors hover:text-brand-100 md:flex ${
                !workshopSeen ? "blink-soft" : ""
              }`}
            >
              <ChevronLeft size={18} strokeWidth={2.25} aria-hidden />
              <Wrench size={16} strokeWidth={ICON_STROKE} aria-hidden />
              <span className="silk text-[9px] text-brand-300 [writing-mode:vertical-rl]" aria-hidden>
                {t.workshop.title}
              </span>
            </button>
          )}
        </>
      )}
      <HUD buffsBottomOffset={buffsBottomOffset} />
      </>}
      <Customize open={customizeOpen} onClose={closeCustomize} />
      <Settings open={settingsOpen} onClose={closeSettings} onOpenTutorial={openTutorial} />
      <Tutorial open={tutorialOpen} onClose={closeTutorial} />
      <Achievements open={achievementsOpen} onClose={closeAchievements} />
      <Prestige open={prestigeOpen} onClose={closePrestige} />
      <TitleScreen
        open={titleOpen}
        onEnter={enterFromTitle}
        onHowTo={() => {
          enterFromTitle();
          setTutorialOpen(true);
        }}
        onSettings={() => {
          enterFromTitle();
          setSettingsOpen(true);
        }}
      />
      {!titleOpen && <>
      <AchievementToast />
      <IdleToast />
      </>}
      <Analytics />
    </div>
  );
}
