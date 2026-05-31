import type { Edge } from "./RoadTileset";

const EDGE_DIR: Record<Edge, { dc: number; dr: number }> = {
  N: { dc: 0, dr: -1 },
  S: { dc: 0, dr: 1 },
  E: { dc: 1, dr: 0 },
  W: { dc: -1, dr: 0 },
};

const OPPOSITE: Record<Edge, Edge> = {
  N: "S", S: "N", E: "W", W: "E",
};

export type TileKey = string;

export function tileKey(col: number, row: number): TileKey {
  return `${col},${row}`;
}

export function parseKey(k: TileKey): { col: number; row: number } {
  const [c, r] = k.split(",");
  return { col: +c, row: +r };
}

export class RoadNetwork {
  private tiles = new Map<TileKey, Set<Edge>>();
  private _onChange: ((affected: TileKey[]) => void) | null = null;
  private batchKeys: Set<TileKey> | null = null;

  onChange(fn: (affected: TileKey[]) => void): void {
    this._onChange = fn;
  }

  beginBatch(): void {
    this.batchKeys = new Set();
  }

  endBatch(): void {
    const keys = this.batchKeys;
    this.batchKeys = null;
    if (keys && keys.size > 0) {
      this.trigger(Array.from(keys));
    }
  }

  private trigger(affected: TileKey[]): void {
    if (this.batchKeys !== null) {
      for (const k of affected) this.batchKeys.add(k);
    } else if (this._onChange) {
      this._onChange(affected);
    }
  }

  hasTile(col: number, row: number): boolean {
    return this.tiles.has(tileKey(col, row));
  }

  getEdges(col: number, row: number): Set<Edge> {
    return this.tiles.get(tileKey(col, row)) ?? new Set();
  }

  tileKeys(): TileKey[] {
    return Array.from(this.tiles.keys());
  }

  addTile(col: number, row: number): TileKey[] {
    const key = tileKey(col, row);
    if (this.tiles.has(key)) return [];

    const edges = new Set<Edge>();

    for (const edge of ["N", "S", "E", "W"] as Edge[]) {
      const { dc, dr } = EDGE_DIR[edge];
      const nk = tileKey(col + dc, row + dr);
      if (this.tiles.has(nk)) {
        edges.add(edge);
        this.tiles.get(nk)!.add(OPPOSITE[edge]);
      }
    }

    this.tiles.set(key, edges);

    const affected: TileKey[] = [key];
    for (const edge of edges) {
      const { dc, dr } = EDGE_DIR[edge];
      affected.push(tileKey(col + dc, row + dr));
    }

    this.trigger(affected);
    return affected;
  }

  removeTile(col: number, row: number): TileKey[] {
    const key = tileKey(col, row);
    if (!this.tiles.has(key)) return [];

    const edges = this.tiles.get(key)!;
    const affected: TileKey[] = [key];

    for (const edge of edges) {
      const { dc, dr } = EDGE_DIR[edge];
      const nk = tileKey(col + dc, row + dr);
      if (this.tiles.has(nk)) {
        this.tiles.get(nk)!.delete(OPPOSITE[edge]);
        affected.push(nk);
      }
    }

    this.tiles.delete(key);
    this.trigger(affected);
    return affected;
  }

  setEdges(col: number, row: number, edges: Set<Edge>): void {
    const key = tileKey(col, row);
    if (!this.tiles.has(key)) return;
    this.tiles.set(key, new Set(edges));
    this.trigger([key]);
  }

  addTileRaw(col: number, row: number): TileKey[] {
    const key = tileKey(col, row);
    if (this.tiles.has(key)) return [];
    this.tiles.set(key, new Set<Edge>());
    this.trigger([key]);
    return [key];
  }

  clear(): void {
    this.tiles.clear();
  }
}
