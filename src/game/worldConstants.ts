/** Scale factor vs the original 1280×800 playfield. */
export const WORLD_SCALE = 3;

export const VIRTUAL_WIDTH = 1280 * WORLD_SCALE;
export const VIRTUAL_HEIGHT = 800 * WORLD_SCALE;

/**
 * Rope mount sits mid-field — multiplier circles fill the upper and lower bands.
 */
export const ANCHOR = { x: VIRTUAL_WIDTH / 2, y: Math.round(VIRTUAL_HEIGHT * 0.58) };

/**
 * Default camera: mount centered vertically so upper and lower multiplier bands
 * get equal screen space. Pan is in virtual world units (see viewTransform).
 */
export const CAMERA_PAN_X_DEFAULT = 0;
export const CAMERA_PAN_Y_DEFAULT = Math.round(VIRTUAL_HEIGHT * 0.5 - ANCHOR.y);

/** Slightly zoomed out so both bands fit with a little margin at default pan. */
export const CAMERA_ZOOM_DEFAULT = 0.9;

/**
 * Matter collision categories. These let in-field obstacles (the Layers map's
 * concentric ring walls) collide with the scoring bobs while passing cleanly
 * through the rope's segment nodes — otherwise the light rope links would snag
 * on a ring and tangle the swing. Boundary walls keep the default category so
 * they still stop everything at the cage edge.
 *   DEFAULT  — pivot, boundary walls, hit zones, tokens (collide with all).
 *   BOB      — every scoring body (tip/chain/freed bobs + Breakable shards).
 *   ROPE     — the rope segment nodes (excluded from obstacle masks).
 *   OBSTACLE — in-field ring walls; masked to hit only BOB bodies.
 */
export const COLLISION = {
  DEFAULT: 0x0001,
  BOB: 0x0002,
  ROPE: 0x0004,
  OBSTACLE: 0x0008,
} as const;
