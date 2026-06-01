# Rendering System — Context (`src/game/render.ts` + related)

**Important**: This is **not** Matter.Render. The entire visual layer is custom Canvas2D written on top of the live Matter bodies + extra game state.

---

## Core Idea

Every frame, after the physics + gameplay systems have run, `GameCanvas` builds a `RenderContext` (which contains the current view transform + canvas 2D context) and calls a series of `draw*` functions.

All drawing is done in **world space** first, then the view transform is applied.

---

## Key Files

- `render.ts` — The main drawing functions
- `bobShapePath.ts` — Generates the vector paths for the 13 BobShapeKind values
- `bobSkinArt.ts` — The 5 pattern styles (solid, striped, crystal, starfield, band) + color application
- `bobRenderUtils.ts` — Helpers for drawing bobs with skins/shapes + density cues
- `viewTransform.ts` — Camera math (`computeViewTransform`, `screenToWorld`, `applyWorldCamera`)

---

## RenderContext

```ts
interface RenderContext {
  ctx: CanvasRenderingContext2D;
  view: ViewTransform;
  width: number;
  height: number;
  now: number;
  // plus some cached values
}
```

Most `drawXxx(rc, ...)` functions expect the context to already have the world→screen transform applied (or they apply it themselves for certain layers).

---

## Drawing Order (Typical)

From the call site in GameCanvas (roughly):

1. `drawScreenBackdrop`
2. `drawSiteBackground` (the arena texture/color)
3. `drawBlackHole` (if the site has one)
4. `drawHitZones`
5. `drawTokens`
6. `drawWalls` + `drawObstacles` (breakable walls + Layers rings)
7. `drawBeltTunnel` (the conveyor path + walls, only on belt)
8. `drawPendulum` (the rope line + all bobs + chain bobs + echoes)
9. `drawEchoBobs` (extra visual echoes from Multi-Bob / Hydra)
10. `drawEffects` (particles, hit flashes, maneuvers)
11. `applyShake` (screen translation based on recent big hits)

The pendulum drawing itself is quite complex because it has to draw:
- The rope as a thick polyline (with sag for heavy bobs)
- Special visuals for bulwark hardened segments
- All the bob shapes + skins with proper density/scale cues
- Chain bobs (the static "links" on multi-bob rigs)

---

## Bob Visuals Pipeline

1. Shape path is generated from `BobShapeDef.shape` via `bobShapePath.ts`
2. Skin (palette + pattern) is applied via `bobSkinArt.ts` functions
3. `drawBobSkin` does the actual fill + stroke + pattern work
4. Density is visualized via a dark core or highlight when `weightScale / sizeScale²` deviates from 1.0

This system lets the Chaos bob, Splitter (as it sheds), Frenzy (as it grows), and size/weight modifier tokens all look distinct even when they have the same equipped cosmetic.

---

## View & Camera

- `viewTransform.ts` handles the mapping between the fixed virtual world (3840×2400 after scale) and the actual canvas pixels.
- The camera supports pan + zoom. Player can override the default framing.
- `userAdjustedCameraRef` in GameCanvas stops auto-fitting on resize once the player has touched the camera.

When doing hit testing or drag logic, you **must** go through `screenToWorld`.

---

## Performance Notes

- Everything is redrawn every frame (no dirty rects).
- The custom renderer is deliberately lightweight — no heavy per-bob SVG or complex paths on hot paths.
- `drawPendulum` and `drawHitZones` are the two most expensive calls.

---

## When You Need to Touch Rendering

Common reasons:
- New behavior needs a visual tell (e.g. magnet has attraction lines? rocket has thrust flame?)
- New site type needs background elements
- Bob shape or skin additions (mostly data + the two bob* files)
- Special rope state (bulwark walls are drawn as thicker/stiffer segments)

Always add the new drawing call in the correct place in the drawing order inside GameCanvas, or the layering will be wrong (e.g. effects behind the bob, or walls drawn over the rope).

---

## Related

- `src/components/CONTEXT.md` (how the canvas size + DPR + RAF interact with rendering)
- `src/game/CONTEXT.md` (ViewTransform + world constants section)
- `src/game/viewTransform.ts` (the actual math)