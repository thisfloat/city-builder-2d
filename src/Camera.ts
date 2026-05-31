import { Container, Application } from "pixi.js";
import { MIN_ZOOM, MAX_ZOOM } from "./constants";
import { getActiveTool } from "./ToolState";

export class Camera {
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private originX = 0;
  private originY = 0;

  constructor(
    private container: Container,
    app: Application,
  ) {
    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;

    app.stage.on("pointerdown", this.onPointerDown, this);
    app.stage.on("pointermove", this.onPointerMove, this);
    app.stage.on("pointerup", this.onPointerUp, this);
    app.stage.on("pointerupoutside", this.onPointerUp, this);
    app.stage.on("wheel", this.onWheel, this);
  }

  private onPointerDown(e: any) {
    if (getActiveTool() !== "none") return;
    this.dragging = true;
    this.dragStartX = e.global.x;
    this.dragStartY = e.global.y;
    this.originX = this.container.x;
    this.originY = this.container.y;
  }

  private onPointerMove(e: any) {
    if (!this.dragging) return;
    this.container.x = this.originX + (e.global.x - this.dragStartX);
    this.container.y = this.originY + (e.global.y - this.dragStartY);
  }

  private onPointerUp() {
    this.dragging = false;
  }

  private onWheel(e: any) {
    e.preventDefault();

    const oldZoom = this.container.scale.x;
    const factor = 1 - e.deltaY * 0.001;
    const clamped = Math.min(1.05, Math.max(0.95, factor));
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * clamped));
    if (newZoom === oldZoom) return;

    // World position under cursor before zoom
    const worldX = (e.global.x - this.container.x) / oldZoom;
    const worldY = (e.global.y - this.container.y) / oldZoom;

    this.container.scale.set(newZoom);

    // Keep cursor anchored to same world position
    this.container.x = e.global.x - worldX * newZoom;
    this.container.y = e.global.y - worldY * newZoom;
  }
}
