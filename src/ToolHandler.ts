import { Application, Container, Graphics, Sprite } from "pixi.js";
import { TILE_SIZE, GRID_COLS, GRID_ROWS } from "./constants";
import { getActiveTool, onToolChange } from "./ToolState";
import { type RoadNetwork, tileKey } from "./RoadNetwork";
import { type RoadRenderer } from "./RoadRenderer";
import { getTexture, type Edge } from "./RoadTileset";

const CLICK_THRESHOLD = 3;
const PREVIEW_ALPHA = 0.5;
const DELETE_ALPHA = 0.3;

const DIR = {
  N: { dc: 0, dr: -1 },
  S: { dc: 0, dr: 1 },
  E: { dc: 1, dr: 0 },
  W: { dc: -1, dr: 0 },
} as const;

const OPP: Record<string, Edge> = {
  N: "S", S: "N", E: "W", W: "E",
};

function asEdge(s: string): Edge {
  return s as Edge;
}

type DragState = {
  type: "createRoad" | "delete";
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
  direction: "N" | "S" | "E" | "W" | null;
} | null;

export function initToolHandler(
  app: Application,
  world: Container,
  network: RoadNetwork,
  renderer: RoadRenderer,
  blockedKeys: Set<string>,
): void {
  let dragState: DragState = null;
  let dragScreenX = 0;
  let dragScreenY = 0;

  const previewContainer = new Container();
  world.addChild(previewContainer);

  const previewGraphics = new Graphics();
  previewContainer.addChild(previewGraphics);

  onToolChange(() => {
    clearPreview(previewContainer, previewGraphics);
    dragState = null;
  });

  function screenToTile(screenX: number, screenY: number): { col: number; row: number } | null {
    const worldX = (screenX - world.x) / world.scale.x;
    const worldY = (screenY - world.y) / world.scale.y;
    const col = Math.floor(worldX / TILE_SIZE);
    const row = Math.floor(worldY / TILE_SIZE);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
    return { col, row };
  }

  function clampTile(col: number, row: number): { col: number; row: number } {
    return {
      col: Math.max(0, Math.min(GRID_COLS - 1, col)),
      row: Math.max(0, Math.min(GRID_ROWS - 1, row)),
    };
  }

  function getLineTiles(
    sCol: number, sRow: number,
    eCol: number, eRow: number,
    dir: "N" | "S" | "E" | "W",
  ): { col: number; row: number }[] {
    const tiles: { col: number; row: number }[] = [];
    const dc = dir === "E" ? 1 : dir === "W" ? -1 : 0;
    const dr = dir === "S" ? 1 : dir === "N" ? -1 : 0;
    let col = sCol;
    let row = sRow;
    const targetCol = eCol;
    const targetRow = eRow;
    while (true) {
      tiles.push({ col, row });
      if (col === targetCol && row === targetRow) break;
      col += dc;
      row += dr;
    }
    return tiles;
  }

  function getRectTiles(
    sCol: number, sRow: number,
    eCol: number, eRow: number,
  ): { col: number; row: number }[] {
    const minCol = Math.min(sCol, eCol);
    const maxCol = Math.max(sCol, eCol);
    const minRow = Math.min(sRow, eRow);
    const maxRow = Math.max(sRow, eRow);
    const tiles: { col: number; row: number }[] = [];
    for (let c = minCol; c <= maxCol; c++) {
      for (let r = minRow; r <= maxRow; r++) {
        tiles.push({ col: c, row: r });
      }
    }
    return tiles;
  }

  function tileKeySet(tiles: { col: number; row: number }[]): Set<string> {
    const s = new Set<string>();
    for (const t of tiles) s.add(tileKey(t.col, t.row));
    return s;
  }

  function clearPreview(container: Container, gfx: Graphics): void {
    gfx.clear();
    while (container.children.length > 1) {
      const child = container.children[1];
      container.removeChild(child);
      if (child instanceof Sprite) child.destroy();
    }
  }

  function showCreatePreview(
    lineTiles: { col: number; row: number }[],
  ): void {
    const previewKeys = tileKeySet(lineTiles);

    for (const tile of lineTiles) {
      const edges: Edge[] = [];
      const existing = network.getEdges(tile.col, tile.row);
      if (existing.size > 0) {
        for (const e of existing) edges.push(e);
      }

      for (const [edge, { dc, dr }] of Object.entries(DIR)) {
        if (previewKeys.has(tileKey(tile.col + dc, tile.row + dr))) {
          edges.push(asEdge(edge));
        }
      }

      const tex = getTexture(...edges);
      if (!tex) continue;

      const sprite = new Sprite(tex);
      sprite.x = tile.col * TILE_SIZE;
      sprite.y = tile.row * TILE_SIZE;
      sprite.alpha = PREVIEW_ALPHA;
      previewContainer.addChild(sprite);
    }
  }

  function showDeletePreview(
    rectTiles: { col: number; row: number }[],
  ): void {
    const gfx = previewGraphics;
    gfx.clear();
    for (const t of rectTiles) {
      gfx.rect(t.col * TILE_SIZE, t.row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
    gfx.fill({ color: 0xff3333, alpha: DELETE_ALPHA });
  }

  function commitCreate(
    lineTiles: { col: number; row: number }[],
    dir: "N" | "S" | "E" | "W",
  ): void {
    network.beginBatch();
    const dirEdge = asEdge(dir);
    const oppEdge = OPP[dir];

    for (const { col, row } of lineTiles) {
      if (!network.hasTile(col, row)) {
        network.addTileRaw(col, row);
      }
    }

    for (let i = 0; i < lineTiles.length; i++) {
      const { col, row } = lineTiles[i];
      const existing = network.getEdges(col, row);
      const newEdges = new Set(existing);

      if (i > 0) newEdges.add(oppEdge);
      if (i < lineTiles.length - 1) newEdges.add(dirEdge);

      if (newEdges.size !== existing.size ||
          ![...newEdges].every(e => existing.has(e))) {
        network.setEdges(col, row, newEdges);
      }
    }
    network.endBatch();
  }

  function commitDelete(
    rectTiles: { col: number; row: number }[],
  ): void {
    network.beginBatch();
    for (const { col, row } of rectTiles) {
      const key = tileKey(col, row);
      if (blockedKeys.has(key)) continue;
      if (!network.hasTile(col, row)) continue;
      renderer.removeTile(col, row);
      network.removeTile(col, row);
    }
    network.endBatch();
  }

  app.stage.on("pointerdown", (e: any) => {
    const tool = getActiveTool();
    if (tool === "none") return;

    const tile = screenToTile(e.global.x, e.global.y);
    if (!tile) return;

    dragState = {
      type: tool,
      startCol: tile.col,
      startRow: tile.row,
      endCol: tile.col,
      endRow: tile.row,
      direction: null,
    };
    dragScreenX = e.global.x;
    dragScreenY = e.global.y;
  });

  app.stage.on("pointermove", (e: any) => {
    if (!dragState) {
      return;
    }

    const tile = screenToTile(e.global.x, e.global.y);
    if (!tile) return;

    const dx = e.global.x - dragScreenX;
    const dy = e.global.y - dragScreenY;

    if (!dragState.direction) {
      if (Math.abs(dx) < CLICK_THRESHOLD && Math.abs(dy) < CLICK_THRESHOLD) return;
      dragState.direction = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? "E" as const : "W" as const)
        : (dy > 0 ? "S" as const : "N" as const);
    }

    if (dragState.type === "createRoad") {
      const dir = dragState.direction!;
      if (dir === "N" || dir === "S") {
        dragState.endCol = dragState.startCol;
        dragState.endRow = tile.row;
      } else {
        dragState.endCol = tile.col;
        dragState.endRow = dragState.startRow;
      }

      const clamped = clampTile(dragState.endCol, dragState.endRow);
      dragState.endCol = clamped.col;
      dragState.endRow = clamped.row;

      clearPreview(previewContainer, previewGraphics);
      const lineTiles = getLineTiles(
        dragState.startCol, dragState.startRow,
        dragState.endCol, dragState.endRow,
        dragState.direction,
      );
      showCreatePreview(lineTiles);
    } else {
      dragState.endCol = tile.col;
      dragState.endRow = tile.row;

      clearPreview(previewContainer, previewGraphics);
      const rectTiles = getRectTiles(
        dragState.startCol, dragState.startRow,
        dragState.endCol, dragState.endRow,
      );
      showDeletePreview(rectTiles);
    }
  });

  app.stage.on("pointerup", () => {
    if (!dragState) return;

    if (dragState.type === "createRoad" && dragState.direction) {
      const lineTiles = getLineTiles(
        dragState.startCol, dragState.startRow,
        dragState.endCol, dragState.endRow,
        dragState.direction,
      );
      if (lineTiles.length >= 2) {
        commitCreate(lineTiles, dragState.direction);
      }
    } else if (dragState.type === "delete") {
      const rectTiles = getRectTiles(
        dragState.startCol, dragState.startRow,
        dragState.endCol, dragState.endRow,
      );
      commitDelete(rectTiles);
    }

    clearPreview(previewContainer, previewGraphics);
    dragState = null;
  });

  app.stage.on("pointerupoutside", () => {
    if (!dragState) return;
    clearPreview(previewContainer, previewGraphics);
    dragState = null;
  });
}
