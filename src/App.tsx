import { useState, useEffect, useRef } from "react";
import { Analytics } from "@vercel/analytics/react";
import GameCanvas from "./components/GameCanvas";
import HUD, { HUDStats } from "./components/HUD";
import Customize from "./components/Customize";
import Settings from "./components/Settings";
import ControlPanel from "./components/ControlPanel";
import { AudioManager } from "./audio/AudioManager";
import { playGameSound } from "./audio/soundMap";
import { useGameStore } from "./state/store";

export default function App() {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
      setBuffsBottomOffset(Math.max(0, Math.round(window.innerHeight - rect.top + 8)));
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

  return (
    <div className="relative h-full w-full overflow-hidden">
      <GameCanvas />
      {/* On mobile the overlay spans the screen: stats pinned top, controls as a
          bottom action bar. At md+ it collapses back to the left sidebar. */}
      <aside
        className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between
          p-3 pl-[max(0.75rem,env(safe-area-inset-left))] pt-[max(0.75rem,env(safe-area-inset-top))]
          pb-[max(0.75rem,env(safe-area-inset-bottom))]
          md:inset-y-0 md:right-auto md:w-80 md:max-w-[min(20rem,calc(100%-2rem))] md:justify-start md:p-6"
      >
        <div className="pointer-events-none max-h-[42dvh] max-w-[12rem] min-h-0 overflow-y-auto overscroll-contain sm:max-w-[min(20rem,calc(100%-1rem))] md:max-h-none md:max-w-none md:flex-1 md:pb-4">
          <HUDStats />
        </div>
        <div className="pointer-events-none flex justify-center md:block">
          <div
            ref={controlsRef}
            className="pointer-events-auto w-full max-w-md md:max-w-none"
          >
            <ControlPanel
              onOpenCustomize={openCustomize}
              onOpenSettings={openSettings}
            />
          </div>
        </div>
      </aside>
      <HUD buffsBottomOffset={buffsBottomOffset} />
      <Customize open={customizeOpen} onClose={closeCustomize} />
      <Settings open={settingsOpen} onClose={closeSettings} />
      <Analytics />
    </div>
  );
}
