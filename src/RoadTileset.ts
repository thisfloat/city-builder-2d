import { Assets, Texture, Rectangle } from "pixi.js";
import tilesetUrl from "../sprites/roadTextures_tilesheet.png";

type Edge = "N" | "S" | "E" | "W";

const TILE_DEFS: Record<string, { col: number; row: number }> = {
  "N,S": { col: 0, row: 0 },
  "E,W": { col: 0, row: 1 },
  "E,S": { col: 1, row: 0 },
  "S,W": { col: 2, row: 0 },
  "E,N": { col: 1, row: 1 },
  "N,W": { col: 2, row: 1 },
  "E,N,S,W": { col: 9, row: 0 },
  "E,N,S": { col: 4, row: 2 },
  "N,S,W": { col: 5, row: 2 },
  "E,N,W": { col: 4, row: 3 },
  "E,S,W": { col: 5, row: 3 },
  "S": { col: 8, row: 2 },
  "N": { col: 9, row: 2 },
  "W": { col: 9, row: 3 },
  "E": { col: 8, row: 3 },
};

const TILE_SIZE = 64;
const textures: Record<string, Texture> = {};

export async function initRoadTileset(): Promise<void> {
  const tileset: Texture = await Assets.load(tilesetUrl);

  for (const [key, def] of Object.entries(TILE_DEFS)) {
    textures[key] = new Texture({
      source: tileset.source,
      frame: new Rectangle(def.col * TILE_SIZE, def.row * TILE_SIZE, TILE_SIZE, TILE_SIZE),
    });
  }
}

function sortKey(...edges: Edge[]): string {
  return edges.sort().join(",");
}

export function getTexture(...edges: Edge[]): Texture | undefined {
  return textures[sortKey(...edges)];
}

export type { Edge };
