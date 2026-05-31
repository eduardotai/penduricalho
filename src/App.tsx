import { useState, useEffect } from "react";
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
      <aside className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-80 max-w-[min(20rem,calc(100%-2rem))] flex-col p-5 sm:p-6">
        <div className="pointer-events-none min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
          <HUDStats />
        </div>
        <ControlPanel
          onOpenCustomize={openCustomize}
          onOpenSettings={openSettings}
        />
      </aside>
      <HUD />
      <Customize open={customizeOpen} onClose={closeCustomize} />
      <Settings open={settingsOpen} onClose={closeSettings} />
      <Analytics />
    </div>
  );
}
