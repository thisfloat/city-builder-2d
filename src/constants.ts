export const TILE_SIZE = 64;
export const GRID_COLS = 32;
export const GRID_ROWS = 32;
export const WORLD_WIDTH = GRID_COLS * TILE_SIZE;
export const WORLD_HEIGHT = GRID_ROWS * TILE_SIZE;

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 3;

export const CAR_REACTION_DELAY = 0; // frames before reacting (0=instant, 8-15=human-like)
export const STOP_ALL_INTERSECTIONS = true; // debug: all cars stop at every intersection
export const COLORS = {
  background: 0x21bf8f,
  gridLine: 0xa0a0a0,
  gridLineMajor: 0x808080,
} as const;
