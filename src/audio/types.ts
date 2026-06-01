export type SoundGroup = "sfx" | "ui" | "ambient";

export type SoundId =
  | "zone-hit"
  | "zone-hit-echo"
  | "combo-milestone"
  | "token-spawn"
  | "token-spawn-golden"
  | "token-collect"
  | "token-collect-golden"
  | "token-relaunch"
  | "bonus-zones-spawn"
  | "maneuver"
  | "launch"
  | "rope-snap"
  | "run-stall"
  | "run-complete"
  | "token-expire"
  | "ui-click"
  | "ui-buy"
  | "ui-equip"
  | "ui-error"
  | "ui-modal-open"
  | "ui-modal-close"
  | "ui-achievement";

export interface PlayOptions {
  pitch?: number;
  volume?: number;
  group?: SoundGroup;
  /** Maneuver or token kind for pitch tinting */
  variant?: string;
}

export interface AudioSettingsSnapshot {
  masterVolume: number;
  sfxVolume: number;
  uiVolume: number;
  musicVolume: number;
  muted: boolean;
  musicEnabled: boolean;
  ambientEnabled: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettingsSnapshot = {
  masterVolume: 0.8,
  sfxVolume: 1,
  uiVolume: 0.7,
  musicVolume: 0.28,
  muted: false,
  musicEnabled: true,
  ambientEnabled: false,
};
