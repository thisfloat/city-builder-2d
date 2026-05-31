import { Graphics } from "pixi.js";
import { TILE_SIZE, GRID_COLS, GRID_ROWS, WORLD_WIDTH, WORLD_HEIGHT, COLORS } from "./constants";

export function createBackground(): Graphics {
  return new Graphics().rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT).fill({ color: COLORS.background });
}

export function createGridLines(): Graphics {
  const g = new Graphics();

  // Vertical lines
  for (let col = 0; col <= GRID_COLS; col++) {
    const x = col * TILE_SIZE;
    const isMajor = col % 5 === 0;
    g.moveTo(x, 0)
      .lineTo(x, WORLD_HEIGHT)
      .stroke({ width: isMajor ? 1.5 : 0.5, color: isMajor ? COLORS.gridLineMajor : COLORS.gridLine });
  }

  // Horizontal lines
  for (let row = 0; row <= GRID_ROWS; row++) {
    const y = row * TILE_SIZE;
    const isMajor = row % 5 === 0;
    g.moveTo(0, y)
      .lineTo(WORLD_WIDTH, y)
      .stroke({ width: isMajor ? 1.5 : 0.5, color: isMajor ? COLORS.gridLineMajor : COLORS.gridLine });
  }

  return g;
}
