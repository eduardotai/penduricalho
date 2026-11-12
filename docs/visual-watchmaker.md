# Visual experiment: watchmaker workshop (branch `experiment/visual-watchmaker`)

**Do not merge.** This is a visual pass for owner review. It adds no new gameplay systems.

## What changed
- **Fonts:** Fraunces (display: headings, counters, the canvas "+N" text) and Inter (UI body) are now actually loaded. Both are OFL-1.1 and self-hosted via `@fontsource-variable/*` (no CDN, no cost). Before this, "Inter" was declared but never loaded, so the game fell back to the system font.
- **UI palette:** Tailwind `slate` is remapped to warm walnut/umber and `brand` orange to brass, so every panel is re-skinned without touching each component.
- **Backdrop** (`src/game/watchmakerArt.ts`): the navy gradient and grid are replaced by a per-map wood gradient, cached wood grain, a warm work-lamp pool, slowly turning gear silhouettes with light parallax on camera pan, and a vignette.
- **Pivot:** the two grey rectangles become a brass mounting plate with bolts, a stem, a ticking gear hub and a ruby jewel bearing.
- **Hit circles:** candy orbs become watch jewels (emerald, sapphire, amethyst, topaz, ruby) in a brass bezel, with an additive glow that blooms on hit. The generic crosshair ticks are gone.
- **Effects:** particles render additively.

## Preview
```
git fetch origin && git checkout experiment/visual-watchmaker
npm ci && npm run dev   # http://localhost:5173
```
Or use the Vercel preview on the draft PR.

## Not done (follow-ups if the direction is approved)
- Emoji icons in the UI (shop tabs, achievements, generators) are still there; they need a custom icon set.
- Bobs, ropes and skins keep their current art.
- Some buttons still use Tailwind `amber`/`yellow` classes directly, so they don't follow the brass remap.
