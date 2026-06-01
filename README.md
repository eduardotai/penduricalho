# 🪀 Pendulum Clicker

> A physics-based idle clicker about momentum. Launch a pendulum, watch it whip through a field of multiplier circles, and grind the points into heavier bobs, exotic ropes, and stranger places to swing.

Pendulum Clicker is a browser game built on a real [Matter.js](https://brm.io/matter-js/) physics simulation. There's no twist-the-bob clicking grind — you set up a rig, hit **Start Run**, and the physics does the rest: a tangential launch impulse flings the bob into an arc, every multiplier circle it clips banks momentum and builds a combo, and the run ends when the rope wears through and **snaps** — triggering a finale where the freed bob ricochets, devours, or detonates depending on what you've equipped.

The whole game is the meta-loop around that one swing: **earn momentum → buy a better rig → the next swing is wilder.**

---

## Table of Contents

- [Gameplay Loop](#-gameplay-loop)
- [Features](#-features)
  - [Bobs & Behavior Bobs](#bobs--behavior-bobs)
  - [Ropes & Behavior Ropes](#ropes--behavior-ropes)
  - [Sites](#sites)
  - [Tokens & Modifiers](#tokens--modifiers)
  - [Cosmetics](#cosmetics)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Scripts](#-scripts)
- [How It Works](#-how-it-works)
- [Versioning & Deployment](#-versioning--deployment)
- [Contributing](#-contributing)

---

## 🎯 Gameplay Loop

1. **Build a rig** — pick a *bob* (the swinging mass), a *rope* (what it hangs from), and a *site* (the arena it swings in).
2. **Start a run** — the bob gets a launch impulse and begins its arc. Every multiplier circle it sweeps through scores points, banks **momentum**, and extends your **combo**.
3. **Collect tokens** — timed buffs (bigger bob, speed ramps, echo bobs, rope patches…) drop mid-run and drift into the field.
4. **Ride the snap** — the rope has per-run **durability** that drains under the bob's weight over time. When it hits zero the rope snaps and the run reaches its finale; what happens next depends on your bob's *behavior*.
5. **Spend & upgrade** — momentum is the currency. Unlock heavier bobs, longer/weirder ropes, new sites, and cosmetics, each gated behind stat milestones (total hits, best combo, total momentum…).

Progress persists locally via Zustand's `persist` middleware, so your unlocks and stats survive a refresh.

---

## ✨ Features

### Bobs & Behavior Bobs

Bobs trade off **weight**, **reach** (radius), **swing speed** (max angular velocity), and a **base point multiplier**. The starter roster runs from the nimble **Wooden Bob** up to the planet-dense **Tungsten Heavy**.

Beyond the basics, **behavior bobs** each rewrite a slice of the run at a specific game-loop hook point:

| Bob | Behavior | What it does |
| --- | --- | --- |
| **Ravager** | `hunter` | After the snap, the freed bob homes onto multiplier circles and devours them Pac-Man style until sated. |
| **Piercer** | `piercer` | Periodically fires a dead-straight dash that spears a whole row of circles instead of grazing the arc. |
| **Hydra** | `hydra` | Grows a new permanent scoring "head" on every combo milestone — one bob snowballs into a swarm. |
| **Nitro** | `nitro` | Glass cannon: huge reach and payout, but the rope drains ~3.5× faster and snaps early. |
| **Lodestone** | `magnet` | Passively drags nearby circles and loose tokens toward its swing arc. |
| **Frenzy** | `frenzy` | Berserker: swing speed and size scale up with the live combo, then snap back when it breaks. |
| **TP** | `teleport` | Blinks to random spots; the rope reels it back within reach, so shorter ropes yank harder. |
| **Rocket** | `rocket` | No launch kick — builds speed under continuous thrust (stacks hard with Speed Ramp). |
| **Breakable** | `splitter` | Every circle it hits sheds a free-flying scoring shard; as it loses mass it shrinks and speeds up. |
| **Chaos** | `chaos` | Every stat (size, weight, speed, reach) churns through the run, bounded by the lightest/heaviest rigs. |

### Ropes & Behavior Ropes

Ropes are simulated as **segmented lines** with material-derived stiffness and damping (Hooke's law + damping ratio). They vary by **length** (reach), feel, and momentum/velocity bonuses — from snappy **Micro Twine** to the cheating-distance **Magnetic Tether**. There are also rigid alternatives: an **Iron Rod**, a **Heavy Chain**, and a springy **Elastic Cord**.

**Behavior ropes** are the rope-side analog of behavior bobs:

| Rope | Behavior | What it does |
| --- | --- | --- |
| **Flux Cord** | `flux` | Reach and durability-drain speed churn randomly all run — never the same swing twice. |
| **Pendulum Line** | `metronome` | A rigid pivot→bob rod whose length oscillates sinusoidally, pumping a true pendulum swing. |
| **Mechanic Belt** | `belt` | A real conveyor: the bob rides a procedurally generated tunnel (re-rolled each run), kicked along by the belt and contained by hard corridor walls. No rope ever attaches. |
| **Bulwark Weave** | `bulwark` | Every half-second it hardens a random stretch into a rigid wall; it can't grab repair drops, but a hard enough whip breaks the wall and repairs that stretch. |

### Sites

The arena changes the rules of the swing and the snap finale:

- **Workshop** — open bench, no walls. Snapped bobs fly clear off the edge.
- **Bumper Cage / Arena / Colosseum** — walled arenas (small → large) with **breakable walls**: slam one hard enough and it shatters, kicking the bob with extra impulse.
- **The Layers** — concentric circular walls ringing the mount, with multiplier circles between the rings; the snap finale ricochets through every ring on the way out.
- **Black Hole** — a gravity-well singularity drags every bob toward its core, walls keeping them contained.

### Tokens & Modifiers

Tokens drop into the field mid-run (weighted random) and grant **timed modifiers**:

- **Bigger / Giant / Tiny Bob** — resize the bob to sweep more zones or thread tight gaps.
- **Velocity Surge / Speed Ramp** — instant kick or a building speed boost.
- **Multi-Bob** — spawns echo bobs that also score.
- **Rope Patch** — restores rope durability, delaying the snap (a lifeline for Nitro).
- **Golden Token** — re-launches the bob and triples points.

A broader modifier pool (Power Twist, Heavy Air, Featherweight, Golden Hour, Overdrive…) tunes twist power, mass, acceleration, and score multipliers.

### Cosmetics

Purely visual customization, all gated behind stat milestones:

- **13 bob shapes** — sphere, brick, gem, star, hex nut, razor triangle, heart, bolt, flame, cog, cross, moon, void ring.
- **28 bob skins** — from Classic Oak to Solar Flare, Matrix Code, and Void Leech, each with its own palette and pattern (solid / band / striped / crystal / starfield).

---

## 🛠 Tech Stack

- **[Vite](https://vitejs.dev/)** + **React 18** + **TypeScript** — app shell, build, HMR
- **[Matter.js](https://brm.io/matter-js/)** — 2D physics (pendulum, ropes, collisions, gravity wells)
- **HTML5 Canvas** — custom render pipeline for the world, bobs, and effects
- **[Zustand](https://github.com/pmndrs/zustand)** (+ `persist`) — game state and save data
- **[Tailwind CSS](https://tailwindcss.com/)** — HUD and UI
- **[Howler.js](https://howlerjs.com/)** — procedural audio and background music

---

## 📁 Project Structure

```
src/
├── audio/            # AudioManager, procedural sound synthesis, sound map, music
├── components/       # React UI: GameCanvas, HUD, ControlPanel, Customize, Settings
├── data/             # Game content: pendulums, attachments, sites, tokens, modifiers,
│                     #   maneuvers, bobShapes, bobSkins
├── game/             # Simulation: engine, pendulum, hitZones, effects, render,
│   │                 #   tokens, modifiers, viewTransform, worldConstants, beltTunnel
│   └── rope/         # Segmented rope physics + materials
├── lib/              # formatNumber and other helpers
├── state/            # Zustand store + selectors
└── types.ts          # Shared type definitions
```

Game **content** lives in `src/data/` (declarative defs), while game **behavior** lives in `src/game/`. Tuning for a system generally sits next to it — e.g. rope durability tuning lives in `src/game/rope/materials.ts`, and the belt tunnel route generation is self-contained in `src/game/beltTunnel.ts`.

### AI / Contributor Context Docs

For fast understanding without reading every line, see the `CONTEXT.md` files:

- Root [CONTEXT.md](CONTEXT.md) — architecture overview + behavior hook philosophy
- `src/data/CONTEXT.md`, `src/game/CONTEXT.md`, `src/game/rope/CONTEXT.md`, `src/game/render.md`
- `src/state/CONTEXT.md`, `src/components/CONTEXT.md`, `src/audio/CONTEXT.md`

These are deliberately structured for token efficiency when working with LLMs.

---

## 🚀 Getting Started

**Prerequisites:** [Node.js](https://nodejs.org/) 18+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server (with hot module reload)
npm run dev
```

Then open **http://localhost:5173**.

---

## 📜 Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Local dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) and produce a production build in `dist/` |
| `npm run preview` | Serve the production build locally |

---

## ⚙️ How It Works

- **The world is virtual and scaled.** A `worldConstants` module defines a scaled virtual world with a default camera pan/zoom; bob radii, rope lengths, and behavior speeds are all expressed in design pixels and multiplied by the world scale so sizes stay consistent as the camera moves.
- **The swing is a real simulation.** On Start Run, the engine applies a tangential launch impulse; each zone hit adds a small boost, and the run ends automatically once motion settles or the rope snaps.
- **Durability drives the finale.** Each run tracks local rope durability that drains by `weight × time`. Hitting zero snaps the rope and hands control to whatever behavior the bob carries — the snap is a reward beat, not a failure state.
- **Behaviors are hook points, not subclasses.** Each special bob/rope is special-cased at a handful of game-loop hooks (snap finale, durability drain, zone scoring, echo bobs, per-frame steering), keeping the core loop readable.

---

## 🏷 Versioning & Deployment

Current release: **1.0.1** (MVP).

Releases are tagged in git as `v<version>`. See **[CHANGELOG.md](CHANGELOG.md)** for the full history (including the latest *Behavior Bobs, Behavior Ropes & Belt Tunnel* drop) and **[docs/VERSIONING.md](docs/VERSIONING.md)** for the tagging, rollback, and Vercel promotion workflow.

---

## 🤝 Contributing

This is a personal project, but issues and suggestions are welcome on the [GitHub repo](https://github.com/eduardotai/penduricalho). If you're adding game content:

- New **bobs / ropes / sites / cosmetics** → add a declarative def to the matching file in `src/data/`.
- New **behaviors** → wire the def's `behavior` field into the relevant hook point in `src/game/`.
- Keep tuning constants beside the system they tune, and add a changelog entry.

---

<p align="center"><i>Built with momentum. 🪀</i></p>
