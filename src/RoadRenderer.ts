import { Container, Sprite } from "pixi.js";
import { TILE_SIZE } from "./constants";
import { getTexture, type Edge } from "./RoadTileset";
import { type RoadNetwork, tileKey, parseKey, type TileKey } from "./RoadNetwork";

export class RoadRenderer {
  private sprites = new Map<TileKey, Sprite>();
  readonly container = new Container();

  syncTile(network: RoadNetwork, col: number, row: number): void {
    const key = tileKey(col, row);
    const edges = network.getEdges(col, row);

    const existing = this.sprites.get(key);

    if (!network.hasTile(col, row)) {
      if (existing) {
        this.container.removeChild(existing);
        this.sprites.delete(key);
        existing.destroy();
      }
      return;
    }

    const texture = getTexture(...(edges.size > 0 ? edges : (["N", "S"] as Edge[])));
    if (!texture) {
      if (existing) {
        this.container.removeChild(existing);
        this.sprites.delete(key);
        existing.destroy();
      }
      return;
    }

    if (existing) {
      existing.texture = texture;
    } else {
      const sprite = new Sprite(texture);
      sprite.x = col * TILE_SIZE;
      sprite.y = row * TILE_SIZE;
      this.container.addChild(sprite);
      this.sprites.set(key, sprite);
    }
  }

  syncTiles(network: RoadNetwork, keys: TileKey[]): void {
    for (const key of keys) {
      const { col, row } = parseKey(key);
      this.syncTile(network, col, row);
    }
  }

  removeTile(col: number, row: number): void {
    const key = tileKey(col, row);
    const sprite = this.sprites.get(key);
    if (sprite) {
      this.container.removeChild(sprite);
      this.sprites.delete(key);
      sprite.destroy();
    }
  }

  rebuildAll(network: RoadNetwork): void {
    this.container.removeChildren();
    this.sprites.clear();

    for (const key of network.tileKeys()) {
      const { col, row } = parseKey(key);
      this.syncTile(network, col, row);
    }
  }
}
