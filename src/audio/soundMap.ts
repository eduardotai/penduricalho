import { AudioManager } from "./AudioManager";
import { useGameStore } from "../state/store";
import { DEFAULT_AUDIO_SETTINGS, type PlayOptions, type SoundId } from "./types";

export function playGameSound(id: SoundId, opts?: PlayOptions) {
  const { audio } = useGameStore.getState();
  AudioManager.play(id, opts, audio ?? DEFAULT_AUDIO_SETTINGS);
}

export function playUiClick() {
  playGameSound("ui-click", { volume: 0.8 });
}
