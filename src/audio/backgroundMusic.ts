import { Howl } from "howler";

export interface BackgroundMusicHandle {
  stop: () => void;
  setLevel: (level: number) => void;
}

/** CC0 lofi loop — "Benkyou" by MonkeyKidGC (OpenGameArt.org) */
const MUSIC_SOURCES = ["/sounds/benkyou-loop.ogg", "/sounds/benkyou-loop.mp3"];

export function createBackgroundMusic(): BackgroundMusicHandle {
  let targetLevel = 0;
  let started = false;

  const howl = new Howl({
    src: MUSIC_SOURCES,
    loop: true,
    volume: 0,
    preload: true,
    html5: false,
  });

  function applyLevel() {
    howl.volume(targetLevel);
    if (targetLevel > 0.0001) {
      if (!started) {
        howl.play();
        started = true;
      } else if (!howl.playing()) {
        howl.play();
      }
    } else if (started && howl.playing()) {
      howl.pause();
    }
  }

  howl.once("load", applyLevel);

  return {
    stop() {
      howl.stop();
      howl.unload();
      started = false;
    },
    setLevel(level) {
      targetLevel = Math.max(0, Math.min(1, level));
      if (howl.state() === "loaded") {
        applyLevel();
      }
    },
  };
}

export const BACKGROUND_MUSIC_CREDIT =
  "Benkyou — MonkeyKidGC (CC0, OpenGameArt.org)";
