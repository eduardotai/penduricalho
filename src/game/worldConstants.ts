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
