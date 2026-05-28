/**
 * Procedural Web Audio placeholders until real sprite assets land in public/sounds/.
 * Each profile returns duration in seconds.
 */

export interface SynthProfile {
  group: "sfx" | "ui" | "ambient";
  duration: number;
  play: (
    ctx: AudioContext,
    destination: AudioNode,
    pitch: number,
    volume: number,
    variant?: string
  ) => void;
}

function tone(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  start: number,
  dur: number,
  vol: number,
  type: OscillatorType = "sine"
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function noiseBurst(
  ctx: AudioContext,
  dest: AudioNode,
  start: number,
  dur: number,
  vol: number
) {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.6;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(start);
  src.stop(start + dur + 0.02);
}

export const SYNTH_PROFILES: Record<string, SynthProfile> = {
  "zone-hit": {
    group: "sfx",
    duration: 0.14,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      noiseBurst(ctx, dest, t, 0.06, volume * 0.55);
      tone(ctx, dest, 220 * pitch, t, 0.1, volume * 0.45, "triangle");
    },
  },
  "zone-hit-echo": {
    group: "sfx",
    duration: 0.1,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      tone(ctx, dest, 380 * pitch, t, 0.08, volume * 0.35, "sine");
    },
  },
  "combo-milestone": {
    group: "sfx",
    duration: 0.35,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      const freqs = [440, 554, 659].map((f) => f * pitch);
      freqs.forEach((f, i) => tone(ctx, dest, f, t + i * 0.07, 0.12, volume * 0.4));
    },
  },
  "token-spawn": {
    group: "sfx",
    duration: 0.18,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      tone(ctx, dest, 520 * pitch, t, 0.05, volume * 0.25, "sine");
      tone(ctx, dest, 780 * pitch, t + 0.04, 0.1, volume * 0.35, "sine");
    },
  },
  "token-spawn-golden": {
    group: "sfx",
    duration: 0.4,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      [660, 880, 1100].forEach((f, i) =>
        tone(ctx, dest, f * pitch, t + i * 0.06, 0.14, volume * 0.35, "triangle")
      );
    },
  },
  "token-collect": {
    group: "sfx",
    duration: 0.22,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      tone(ctx, dest, 600 * pitch, t, 0.08, volume * 0.35, "sine");
      tone(ctx, dest, 900 * pitch, t + 0.06, 0.12, volume * 0.4, "triangle");
    },
  },
  "token-collect-golden": {
    group: "sfx",
    duration: 0.45,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      [523, 659, 784, 988].forEach((f, i) =>
        tone(ctx, dest, f * pitch, t + i * 0.08, 0.16, volume * 0.38, "triangle")
      );
    },
  },
  "token-relaunch": {
    group: "sfx",
    duration: 0.5,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      noiseBurst(ctx, dest, t, 0.12, volume * 0.4);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(80 * pitch, t + 0.35);
      gain.gain.setValueAtTime(volume * 0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.45);
    },
  },
  "bonus-zones-spawn": {
    group: "sfx",
    duration: 0.28,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      [880, 1040, 1240].forEach((f, i) =>
        tone(ctx, dest, f * pitch, t + i * 0.05, 0.1, volume * 0.3, "sine")
      );
    },
  },
  maneuver: {
    group: "sfx",
    duration: 0.28,
    play(ctx, dest, pitch, volume, variant) {
      const t = ctx.currentTime;
      const base =
        variant === "fullRotation"
          ? 330
          : variant === "highArc"
            ? 440
            : variant === "doubleSwing"
              ? 520
              : 400;
      tone(ctx, dest, base * pitch, t, 0.12, volume * 0.4, "triangle");
      tone(ctx, dest, base * 1.5 * pitch, t + 0.08, 0.14, volume * 0.35, "sine");
    },
  },
  launch: {
    group: "sfx",
    duration: 0.45,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      noiseBurst(ctx, dest, t, 0.08, volume * 0.3);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(120 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(340 * pitch, t + 0.25);
      gain.gain.setValueAtTime(volume * 0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.4);
    },
  },
  "rope-snap": {
    group: "sfx",
    duration: 0.5,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      // Sharp fibrous crack, then a descending twang as the line whips free.
      noiseBurst(ctx, dest, t, 0.14, volume * 0.5);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(420 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(70 * pitch, t + 0.4);
      gain.gain.setValueAtTime(volume * 0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.5);
    },
  },
  "run-stall": {
    group: "sfx",
    duration: 0.35,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      tone(ctx, dest, 280 * pitch, t, 0.25, volume * 0.25, "sine");
      tone(ctx, dest, 200 * pitch, t + 0.1, 0.2, volume * 0.2, "triangle");
    },
  },
  "run-complete": {
    group: "sfx",
    duration: 0.5,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      [392, 494, 587].forEach((f, i) =>
        tone(ctx, dest, f * pitch, t + i * 0.1, 0.2, volume * 0.32, "sine")
      );
    },
  },
  "token-expire": {
    group: "sfx",
    duration: 0.25,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(700 * pitch, t);
      osc.frequency.exponentialRampToValueAtTime(200 * pitch, t + 0.2);
      gain.gain.setValueAtTime(volume * 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.25);
    },
  },
  "ui-click": {
    group: "ui",
    duration: 0.06,
    play(ctx, dest, pitch, volume) {
      tone(ctx, dest, 800 * pitch, ctx.currentTime, 0.04, volume * 0.25, "square");
    },
  },
  "ui-buy": {
    group: "ui",
    duration: 0.2,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      tone(ctx, dest, 880 * pitch, t, 0.06, volume * 0.3, "triangle");
      tone(ctx, dest, 1175 * pitch, t + 0.06, 0.1, volume * 0.35, "sine");
    },
  },
  "ui-equip": {
    group: "ui",
    duration: 0.14,
    play(ctx, dest, pitch, volume) {
      tone(ctx, dest, 520 * pitch, ctx.currentTime, 0.1, volume * 0.35, "triangle");
    },
  },
  "ui-error": {
    group: "ui",
    duration: 0.18,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      tone(ctx, dest, 180 * pitch, t, 0.12, volume * 0.3, "square");
      tone(ctx, dest, 140 * pitch, t + 0.06, 0.1, volume * 0.25, "square");
    },
  },
  "ui-modal-open": {
    group: "ui",
    duration: 0.16,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      tone(ctx, dest, 300 * pitch, t, 0.08, volume * 0.2, "sine");
      tone(ctx, dest, 500 * pitch, t + 0.05, 0.1, volume * 0.25, "sine");
    },
  },
  "ui-modal-close": {
    group: "ui",
    duration: 0.14,
    play(ctx, dest, pitch, volume) {
      const t = ctx.currentTime;
      tone(ctx, dest, 500 * pitch, t, 0.06, volume * 0.2, "sine");
      tone(ctx, dest, 320 * pitch, t + 0.05, 0.08, volume * 0.22, "sine");
    },
  },
};
