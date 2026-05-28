import type { AudioSettingsSnapshot, PlayOptions, SoundGroup, SoundId } from "./types";
import { SYNTH_PROFILES } from "./proceduralSounds";
import { createBackgroundMusic, type BackgroundMusicHandle } from "./backgroundMusic";

const COOLDOWN_MS = 40;
const MAX_CONCURRENT_SFX = 8;
const PITCH_JITTER = 0.05;

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private unlocked = false;
  private lastPlayed = new Map<string, number>();
  private activeSfx = 0;
  private music: BackgroundMusicHandle | null = null;

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  get isUnlocked() {
    return this.unlocked;
  }

  private ensureContext() {
    if (!this.unlocked) return false;
    if (!this.ctx || !this.masterGain) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return true;
  }

  private resolveVolume(
    settings: AudioSettingsSnapshot,
    group: SoundGroup,
    scale = 1
  ): number {
    if (settings.muted) return 0;
    const groupVol =
      group === "ui"
        ? settings.uiVolume
        : group === "ambient"
          ? settings.ambientEnabled
            ? settings.sfxVolume * 0.5
            : 0
          : settings.sfxVolume;
    return settings.masterVolume * groupVol * scale;
  }

  private resolveMusicLevel(settings: AudioSettingsSnapshot): number {
    if (settings.muted || !settings.musicEnabled) return 0;
    return settings.masterVolume * settings.musicVolume;
  }

  syncMusic(settings: AudioSettingsSnapshot) {
    if (!this.ensureContext()) return;

    const level = this.resolveMusicLevel(settings);
    const shouldPlay = level > 0.0001;

    if (shouldPlay && !this.music) {
      this.music = createBackgroundMusic();
    }

    if (this.music) {
      this.music.setLevel(level);
      if (!shouldPlay) {
        this.music.stop();
        this.music = null;
      }
    }
  }

  play(id: SoundId, opts: PlayOptions = {}, settings: AudioSettingsSnapshot) {
    if (settings.muted) return;
    if (!this.ensureContext()) return;

    const profile = SYNTH_PROFILES[id];
    if (!profile) return;

    const group = opts.group ?? profile.group;
    if (group === "ambient" && !settings.ambientEnabled) return;

    const now = performance.now();
    const last = this.lastPlayed.get(id) ?? 0;
    if (now - last < COOLDOWN_MS) return;
    this.lastPlayed.set(id, now);

    if (group === "sfx") {
      if (this.activeSfx >= MAX_CONCURRENT_SFX) return;
      this.activeSfx += 1;
      window.setTimeout(() => {
        this.activeSfx = Math.max(0, this.activeSfx - 1);
      }, profile.duration * 1000);
    }

    const pitch =
      (opts.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * PITCH_JITTER);
    const volume = this.resolveVolume(settings, group, opts.volume ?? 1);
    if (volume <= 0.0001) return;

    this.masterGain!.gain.setValueAtTime(1, this.ctx!.currentTime);
    profile.play(this.ctx!, this.masterGain!, pitch, volume, opts.variant);
  }
}

export const AudioManager = new AudioManagerImpl();
