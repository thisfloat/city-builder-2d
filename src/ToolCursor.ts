import { Application, Container, Graphics } from "pixi.js";
import { TILE_SIZE, GRID_COLS, GRID_ROWS } from "./constants";
import { getActiveTool, onToolChange, type ToolType } from "./ToolState";

const STROKE = 5;
const INSET = STROKE / 2;

export function createToolCursor(world: Container, app: Application): void {
  const cursor = new Graphics();
  cursor.visible = false;
  world.addChild(cursor);

  function screenToTile(screenX: number, screenY: number): { col: number; row: number } {
    const worldX = (screenX - world.x) / world.scale.x;
    const worldY = (screenY - world.y) / world.scale.y;

    return {
      col: Math.max(0, Math.min(GRID_COLS - 1, Math.floor(worldX / TILE_SIZE))),
      row: Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(worldY / TILE_SIZE))),
    };
  }

  function redrawCursor(tool: ToolType): void {
    cursor.clear();
    cursor.visible = tool !== "none";

    if (tool === "createRoad") {
      cursor.rect(INSET, INSET, TILE_SIZE - STROKE, TILE_SIZE - STROKE).stroke({ width: STROKE, color: 0xffffff });
    } else if (tool === "delete") {
      cursor.rect(INSET, INSET, TILE_SIZE - STROKE, TILE_SIZE - STROKE).stroke({ width: STROKE, color: 0xff3333 });
    }
  }

  redrawCursor(getActiveTool());

  onToolChange(redrawCursor);

  app.stage.on("pointermove", (e: any) => {
    if (getActiveTool() === "none") {
      if (cursor.visible) cursor.visible = false;
      return;
    }

    const { col, row } = screenToTile(e.global.x, e.global.y);
    cursor.x = col * TILE_SIZE;
    cursor.y = row * TILE_SIZE;
    cursor.visible = true;
  });
}