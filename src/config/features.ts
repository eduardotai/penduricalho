/**
 * Feature flags — compile-time switches for shipping the game with a feature
 * hidden while keeping all of its code in place.
 */

/**
 * The Workshop clicker layer (right-side WorkshopPanel, Pump/generator shop,
 * passive CPS income, Arc Surge procs, click-streak HUD readouts).
 *
 * Set to `true` to bring the whole layer back — this single flag gates:
 *  - both `<WorkshopPanel />` mounts in App.tsx (desktop aside + mobile)
 *  - `startClickerEngine()` (passive income / Arc Surge scheduling)
 *  - the workshop readouts in HUDStats (CPS line, surge banner, click streak)
 *  - the "Workshop power" hint in ControlPanel
 *
 * Player workshop progress (owned generators, upgrades) stays persisted in the
 * store either way, so re-enabling picks up exactly where the save left off.
 */
export const WORKSHOP_CLICKER_ENABLED = false;
