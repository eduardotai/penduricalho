#!/usr/bin/env python3
"""
Penduricalho original soundtrack — a tiny deterministic synth.

Every sound here is synthesised from scratch with numpy (oscillators, noise,
envelopes, a convolution reverb and a tempo-synced delay). No samples, no
third-party audio, so the output is ours to release: CC0 1.0.

    python3 scripts/music/compose.py            # writes public/music/*.wav
    scripts/music/encode.sh                     # wav -> ogg + mp3 (ffmpeg)

Tracks
  bench-at-rest   menu / ambient   72 BPM  D major   pads, tick-tock clock, bells
  tightrope       arena            116 BPM A minor   plucked arps, four-on-floor
  amber-orbit     arena            124 BPM F# dorian syncopated bass, bell lead
  momentum        arena            90 BPM  Eb major  half-time keys groove
"""
import os
import sys
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "music")

A4 = 440.0
NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}
NOTE.update({"Db": 1, "Eb": 3, "Gb": 6, "Ab": 8, "Bb": 10})


def midi(name: str) -> int:
    """'C4' -> 60, 'F#3' -> 54."""
    pitch, octave = name[:-1], int(name[-1])
    return 12 * (octave + 1) + NOTE[pitch]


def hz(m: float) -> float:
    return A4 * 2 ** ((m - 69) / 12)


class Mix:
    def __init__(self, seconds: float):
        self.n = int(seconds * SR)
        self.buses = {}

    def bus(self, name):
        if name not in self.buses:
            self.buses[name] = np.zeros((self.n, 2), dtype=np.float64)
        return self.buses[name]

    def add(self, name, t0, sig, pan=0.0, gain=1.0):
        b = self.bus(name)
        i0 = int(t0 * SR)
        if i0 >= self.n:
            return
        sig = sig[: self.n - i0] * gain
        l = np.cos((pan + 1) * np.pi / 4)
        r = np.sin((pan + 1) * np.pi / 4)
        b[i0 : i0 + len(sig), 0] += sig * l
        b[i0 : i0 + len(sig), 1] += sig * r


def env_adsr(n, a, d, s, r, sustain_len):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    s_n = max(0, int(sustain_len * SR) - a_n - d_n)
    e = np.concatenate([
        np.linspace(0, 1, max(1, a_n), endpoint=False),
        np.linspace(1, s, max(1, d_n), endpoint=False),
        np.full(s_n, s),
        np.linspace(s, 0, max(1, r_n)),
    ])
    if len(e) < n:
        e = np.pad(e, (0, n - len(e)))
    return e[:n]


def onepole_lp(x, cutoff):
    """One-pole low-pass applied in the frequency domain (numerically stable, fast)."""
    a = np.exp(-2 * np.pi * cutoff / SR)
    n = len(x)
    size = 1
    while size < n + SR // 10:
        size *= 2
    w = 2 * np.pi * np.fft.rfftfreq(size) 
    h = (1 - a) / (1 - a * np.exp(-1j * w))
    return np.fft.irfft(np.fft.rfft(x, size) * h, size)[:n]


def saw_additive(f, t, harmonics=12):
    out = np.zeros_like(t)
    for k in range(1, harmonics + 1):
        if f * k > SR / 2.2:
            break
        out += np.sin(2 * np.pi * f * k * t) / k
    return out * 0.6


def pad(freqs, dur, bright=1800.0, rng=None):
    n = int((dur + 1.6) * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.0, 0.11):
            ph = rng.random() * 6.28 if rng is not None else 0
            sig += saw_additive(f * 2 ** (det / 12), t + ph / (2 * np.pi * f), 10)
    sig /= max(1, len(freqs) * 3)
    sig = onepole_lp(sig, bright)
    sig = onepole_lp(sig, bright * 1.4)
    return sig * env_adsr(n, 0.9, 0.6, 0.8, 1.5, dur)


def pluck(f, dur=1.2, bright=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sig = np.zeros(n)
    for k in range(1, 9):
        if f * k > SR / 2.2:
            break
        decay = 3.0 + k * 2.4 / bright
        sig += np.sin(2 * np.pi * f * k * t + k) * np.exp(-decay * t) / (k ** 1.1)
    sig *= np.minimum(1, t / 0.003)
    return sig * 0.5


def bell(f, dur=2.5, index=2.2, ratio=3.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * ratio * t) * index * np.exp(-3.5 * t)
    sig = np.sin(2 * np.pi * f * t + mod) * np.exp(-1.8 * t)
    sig *= np.minimum(1, t / 0.002)
    return sig * 0.35


def epiano(f, dur=1.6):
    n = int((dur + 0.6) * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * np.pi * f * 1.0 * t) * 1.3 * np.exp(-4 * t)
    tine = np.sin(2 * np.pi * f * 7.0 * t) * 0.08 * np.exp(-14 * t)
    sig = (np.sin(2 * np.pi * f * t + mod) + tine) * np.exp(-1.2 * t)
    return sig * env_adsr(n, 0.004, 0.1, 0.9, 0.35, dur) * 0.3


def bass(f, dur, drive=1.6):
    n = int((dur + 0.08) * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-6 * t)
    sig = np.tanh(sig * drive) / np.tanh(drive)
    return sig * env_adsr(n, 0.005, 0.12, 0.75, 0.06, dur) * 0.5


def kick(level=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 45 + 85 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) * np.exp(-t * 7.5)
    click = np.exp(-t * 400) * 0.3
    return np.tanh((sig + click) * 1.4) * 0.8 * level


def noise(n, rng):
    return rng.uniform(-1, 1, n)


def snare(rng, level=1.0, clap=False):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    nz = noise(n, rng)
    nz = nz - onepole_lp(nz, 900)  # high-pass-ish
    if clap:
        e = np.zeros(n)
        for off in (0, 0.011, 0.023):
            i = int(off * SR)
            e[i:] += np.exp(-(t[: n - i]) * 38)
        sig = nz * e * 0.5
    else:
        body = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 30)
        sig = nz * np.exp(-t * 22) * 0.6 + body * 0.5
    return sig * 0.55 * level


def hat(rng, open_=False, level=1.0):
    n = int((0.25 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    nz = noise(n, rng)
    nz = nz - onepole_lp(nz, 6000)
    return nz * np.exp(-t * (14 if open_ else 70)) * 0.3 * level


def woodblock(f):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    sig = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.7 * t)) * np.exp(-t * 45)
    return sig * 0.35


def reverb(x, seconds=2.6, mix=0.25, seed=7):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = rng.uniform(-1, 1, n) * np.exp(-t * 6.9 / seconds)
        ir = onepole_lp(ir, 5200)
        ir[0] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        size = 1
        while size < len(x) + n:
            size *= 2
        y = np.fft.irfft(np.fft.rfft(x[:, ch], size) * np.fft.rfft(ir, size), size)
        wet = y[: len(x) + n]
        # wrap the tail onto the head so the loop point is seamless
        wet[: n] += wet[len(x) : len(x) + n]
        out[:, ch] = wet[: len(x)]
    return x * (1 - mix) + out * mix * 1.4


def delay(x, seconds, feedback=0.35, mix=0.3):
    d = int(seconds * SR)
    y = x.copy()
    tap = x.copy()
    for i in range(1, 6):
        tap = np.roll(tap, d, axis=0) * feedback
        # ping-pong
        tap = tap[:, ::-1]
        y += tap * mix / feedback
    return y


def master(mix: Mix, levels, rev_send, name):
    total = np.zeros((mix.n, 2))
    send = np.zeros((mix.n, 2))
    for k, b in mix.buses.items():
        g = levels.get(k, 1.0)
        total += b * g
        send += b * g * rev_send.get(k, 0.0)
    total += reverb(send, mix=1.0) * 0.6
    # gentle bus compression via soft clip, then normalise to -1 dBFS
    total = np.tanh(total * 1.3) / 1.3
    total /= np.max(np.abs(total)) / 0.89
    # 30 ms fade at both ends to avoid clicks
    f = int(0.03 * SR)
    total[:f] *= np.linspace(0, 1, f)[:, None]
    total[-f:] *= np.linspace(1, 0, f)[:, None]
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{name}.wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((total * 32767).astype("<i2").tobytes())
    print("wrote", path, f"{mix.n / SR:.1f}s")


def chord(root: str, quality: str):
    shapes = {
        "maj7": [0, 4, 7, 11], "m7": [0, 3, 7, 10], "m9": [0, 3, 7, 10, 14], "maj9": [0, 4, 7, 11, 14],
        "sus2": [0, 2, 7], "add9": [0, 4, 7, 14], "7": [0, 4, 7, 10], "m": [0, 3, 7], "6": [0, 4, 7, 9],
    }
    r = midi(root)
    return [r + i for i in shapes[quality]]


# ----------------------------------------------------------------- tracks


def bench_at_rest():
    """Menu: a clock ticking in a quiet lab. Tick on the beat, tock off it."""
    rng = np.random.default_rng(1)
    bpm = 72
    beat = 60 / bpm
    bars = 24
    m = Mix(bars * 4 * beat)
    prog = [("D3", "maj9"), ("B2", "m9"), ("G2", "maj9"), ("A2", "sus2")]
    scale = [midi(n) for n in ["D5", "E5", "F#5", "A5", "B5", "D6", "E6"]]
    for bar in range(bars):
        t0 = bar * 4 * beat
        root, q = prog[bar % 4]
        notes = chord(root, q)
        m.add("pad", t0, pad([hz(n) for n in notes[1:]], 4 * beat, 1400, rng), gain=0.55)
        m.add("bass", t0, bass(hz(notes[0] - 12), 3.6 * beat, 1.1), gain=0.55)
        # pendulum clock: tick (beats 1,3) / tock (2,4), quieter in the first bars
        level = 0.4 if bar < 2 else 1.0
        for b in range(4):
            f = 1250 if b % 2 == 0 else 930
            m.add("tick", t0 + b * beat, woodblock(f), pan=-0.35 if b % 2 == 0 else 0.35, gain=0.55 * level)
        # sparse bells, a phrase every other bar
        if bar >= 2 and bar % 2 == 0:
            idx = rng.integers(0, 4)
            for k, off in enumerate([0, 1.5, 2.5]):
                n = scale[min(len(scale) - 1, idx + k * rng.integers(1, 3))]
                m.add("bell", t0 + off * beat, bell(hz(n), 3.0), pan=rng.uniform(-0.5, 0.5), gain=0.5)
        # breathing hat on the "and" in the middle section
        if 8 <= bar < 20:
            for b in range(4):
                m.add("hat", t0 + (b + 0.5) * beat, hat(rng, level=0.5), pan=0.2)
    m.buses["bell"] = delay(m.buses["bell"], beat * 0.75, 0.4, 0.35)
    master(m, {"pad": 0.9, "bass": 0.8, "tick": 0.7, "bell": 0.75, "hat": 0.5},
           {"pad": 0.5, "bell": 0.6, "tick": 0.25, "hat": 0.2}, "bench-at-rest")


def tightrope():
    """Arena 1: plucked 16th arps over four-on-the-floor; A minor."""
    rng = np.random.default_rng(2)
    bpm = 116
    beat = 60 / bpm
    bars = 32
    m = Mix(bars * 4 * beat)
    prog = [("A2", "m7"), ("F2", "maj7"), ("C3", "add9"), ("G2", "6")]
    for bar in range(bars):
        t0 = bar * 4 * beat
        root, q = prog[bar % 4]
        notes = chord(root, q)
        section = "intro" if bar < 4 else "break" if 16 <= bar < 20 else "outro" if bar >= 28 else "main"
        m.add("pad", t0, pad([hz(n + 12) for n in notes[1:]], 4 * beat, 2200, rng), gain=0.4)
        arp = [notes[i % len(notes)] + 24 + 12 * ((i // len(notes)) % 2) for i in range(16)]
        if bar % 2 == 1:
            arp = arp[::-1]
        for i, n in enumerate(arp):
            if section == "intro" and i % 2:
                continue
            acc = 1.0 if i % 4 == 0 else 0.65
            m.add("pluck", t0 + i * beat / 4, pluck(hz(n), 0.9, 1.2), pan=np.sin(i * 0.7) * 0.5, gain=0.45 * acc)
        if section in ("main", "outro"):
            for b in range(4):
                m.add("kick", t0 + b * beat, kick())
                m.add("hat", t0 + (b + 0.5) * beat, hat(rng, open_=(b == 3)), pan=0.3)
                if b in (1, 3):
                    m.add("snare", t0 + b * beat, snare(rng, 0.7, clap=True))
            for i in range(8):
                if i in (0, 3, 4, 6):
                    m.add("bass", t0 + i * beat / 2, bass(hz(notes[0] - 12 + (12 if i == 6 else 0)), beat * 0.45))
        elif section == "break":
            m.add("bass", t0, bass(hz(notes[0] - 12), 3.8 * beat, 1.2), gain=0.8)
    m.buses["pluck"] = delay(m.buses["pluck"], beat * 0.75, 0.38, 0.4)
    master(m, {"pad": 0.75, "pluck": 0.9, "kick": 0.9, "hat": 0.55, "snare": 0.6, "bass": 0.85},
           {"pad": 0.4, "pluck": 0.35, "snare": 0.25}, "tightrope")


def amber_orbit():
    """Arena 2: syncopated bass and a bell lead; F# dorian."""
    rng = np.random.default_rng(3)
    bpm = 124
    beat = 60 / bpm
    bars = 32
    m = Mix(bars * 4 * beat)
    prog = [("F#2", "m9"), ("F#2", "m9"), ("B2", "7"), ("D3", "maj7")]
    lead_scale = [midi(n) for n in ["F#4", "G#4", "A4", "B4", "C#5", "D#5", "E5", "F#5", "A5"]]
    motif = [0, 2, 4, 3, 2, 4, 6, 4]
    rhythm = [0, 0.75, 1.5, 2, 2.5, 3, 3.25, 3.5]
    bass_pat = [0, 0.75, 1.5, 2.5, 3, 3.5]
    for bar in range(bars):
        t0 = bar * 4 * beat
        root, q = prog[bar % 4]
        notes = chord(root, q)
        section = "intro" if bar < 4 else "break" if 20 <= bar < 24 else "main"
        m.add("pad", t0, pad([hz(n + 12) for n in notes[1:4]], 4 * beat, 1600, rng), gain=0.38)
        if section != "break":
            for i, off in enumerate(bass_pat):
                n = notes[0] - 12 + (7 if i == 4 else 0) + (12 if i == 2 else 0)
                m.add("bass", t0 + off * beat, bass(hz(n), beat * 0.4, 2.2), gain=0.9 if section == "main" else 0.6)
        if section == "main":
            for b in range(4):
                m.add("kick", t0 + b * beat, kick(0.95))
                m.add("hat", t0 + (b + 0.5) * beat, hat(rng, level=0.9), pan=-0.25)
                m.add("hat", t0 + (b + 0.75) * beat, hat(rng, level=0.4), pan=0.25)
            m.add("snare", t0 + beat, snare(rng, 0.8, clap=True))
            m.add("snare", t0 + 3 * beat, snare(rng, 0.8, clap=True))
        # lead: motif with per-bar transposition inside the scale
        if bar >= 8 and section == "main":
            shift = [0, 1, -1, 2][(bar // 2) % 4]
            for k, (deg, off) in enumerate(zip(motif, rhythm)):
                if bar % 2 == 1 and k >= 5:
                    break
                n = lead_scale[max(0, min(len(lead_scale) - 1, deg + shift))]
                m.add("lead", t0 + off * beat, bell(hz(n), 1.4, 1.6, 2.0), pan=0.15, gain=0.6)
        if section == "break":
            for i in range(8):
                n = lead_scale[(i * 3) % len(lead_scale)]
                m.add("lead", t0 + i * beat / 2, bell(hz(n + 12), 1.6, 1.2, 3.5), pan=np.sin(i) * 0.6, gain=0.35)
    m.buses["lead"] = delay(m.buses["lead"], beat * 0.5, 0.32, 0.3)
    master(m, {"pad": 0.8, "bass": 0.85, "kick": 0.9, "hat": 0.55, "snare": 0.6, "lead": 0.85},
           {"pad": 0.45, "lead": 0.45, "snare": 0.2}, "amber-orbit")


def momentum():
    """Arena 3: half-time boom-bap with electric-piano chords; Eb major."""
    rng = np.random.default_rng(4)
    bpm = 90
    beat = 60 / bpm
    bars = 24
    m = Mix(bars * 4 * beat)
    prog = [("Eb3", "maj9"), ("C3", "m9"), ("Ab2", "maj9"), ("Bb2", "sus2")]
    mel = [midi(n) for n in ["G4", "Bb4", "C5", "D5", "Eb5", "F5", "G5"]]
    for bar in range(bars):
        t0 = bar * 4 * beat
        root, q = prog[bar % 4]
        notes = chord(root, q)
        section = "intro" if bar < 2 else "main"
        # comped keys: on 1 and the "and" of 2
        for off, ln in ((0, 1.4), (1.5, 2.2)):
            for j, n in enumerate(notes[1:]):
                m.add("keys", t0 + off * beat + j * 0.012, epiano(hz(n + 12), ln * beat), pan=-0.2 + j * 0.13, gain=0.5)
        m.add("bass", t0, bass(hz(notes[0] - 12), 1.4 * beat, 1.3))
        m.add("bass", t0 + 2.5 * beat, bass(hz(notes[0] - 12 + 7), 1.2 * beat, 1.3), gain=0.8)
        if section == "main":
            m.add("kick", t0, kick())
            m.add("kick", t0 + 1.75 * beat, kick(0.7))
            m.add("kick", t0 + 2.5 * beat, kick(0.85))
            m.add("snare", t0 + beat, snare(rng, 0.9))
            m.add("snare", t0 + 3 * beat, snare(rng, 0.9))
            for i in range(8):
                swing = 0.08 if i % 2 else 0
                m.add("hat", t0 + (i / 2 + swing) * beat, hat(rng, level=0.8 if i % 2 == 0 else 0.45), pan=0.3)
        if bar >= 6 and bar % 4 in (0, 2):
            for k in range(4):
                n = mel[rng.integers(0, len(mel))]
                m.add("pluck", t0 + (k * 0.75 + (0.5 if bar % 4 == 2 else 0)) * beat, pluck(hz(n), 1.4, 0.8), pan=0.35, gain=0.55)
    m.buses["pluck"] = delay(m.buses["pluck"], beat * 0.75, 0.35, 0.4)
    master(m, {"keys": 0.85, "bass": 0.85, "kick": 0.95, "snare": 0.65, "hat": 0.5, "pluck": 0.8},
           {"keys": 0.35, "pluck": 0.4, "snare": 0.3}, "momentum")


TRACKS = {"bench-at-rest": bench_at_rest, "tightrope": tightrope, "amber-orbit": amber_orbit, "momentum": momentum}

if __name__ == "__main__":
    names = sys.argv[1:] or list(TRACKS)
    for n in names:
        TRACKS[n]()
