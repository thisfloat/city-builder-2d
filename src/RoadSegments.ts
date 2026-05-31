import { TILE_SIZE } from "./constants";
import { type RoadNetwork, tileKey, parseKey, type TileKey } from "./RoadNetwork";
import type { Edge } from "./RoadTileset";

export type Pos = { col: number; row: number };

export type CurveSegment = {
  x1: number; y1: number;
  cx?: number; cy?: number;
  x2: number; y2: number;
  distance: number;
  length: number;
};

function edgeCenter(col: number, row: number, edge: Edge): { x: number; y: number } {
  switch (edge) {
    case "N": return { x: (col + 0.5) * TILE_SIZE, y: row * TILE_SIZE };
    case "S": return { x: (col + 0.5) * TILE_SIZE, y: (row + 1) * TILE_SIZE };
    case "E": return { x: (col + 1) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
    case "W": return { x: col * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
  }
}

function getEdge(from: Pos, to: Pos): Edge {
  if (to.row < from.row) return "N";
  if (to.row > from.row) return "S";
  if (to.col > from.col) return "E";
  return "W";
}

function opposite(e: Edge): Edge {
  return { N: "S", S: "N", E: "W", W: "E" }[e] as Edge;
}

function pathToSegments(path: Pos[]): CurveSegment[] {
  const segments: CurveSegment[] = [];
  let dist = 0;

  for (let i = 0; i < path.length; i++) {
    const { col, row } = path[i];
    const entry: Edge = i === 0 ? "N" : opposite(getEdge(path[i - 1], path[i]));
    const exit: Edge = i === path.length - 1 ? "S" : getEdge(path[i], path[i + 1]);

    const p1 = edgeCenter(col, row, entry);
    const p2 = edgeCenter(col, row, exit);

    if (entry === opposite(exit)) {
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, distance: dist, length: len });
      dist += len;
    } else {
      const cx = (col + 0.5) * TILE_SIZE;
      const cy = (row + 0.5) * TILE_SIZE;
      const len = Math.hypot(p1.x - cx, p1.y - cy) + Math.hypot(p2.x - cx, p2.y - cy);
      segments.push({ x1: p1.x, y1: p1.y, cx, cy, x2: p2.x, y2: p2.y, distance: dist, length: len });
      dist += len;
    }
  }

  return segments;
}

function getConnectedEdges(network: RoadNetwork, col: number, row: number): Edge[] {
  return Array.from(network.getEdges(col, row));
}

export function computeAllSegments(network: RoadNetwork): CurveSegment[][] {
  const visitedTiles = new Set<TileKey>();
  const paths: CurveSegment[][] = [];

  for (const key of network.tileKeys()) {
    if (visitedTiles.has(key)) continue;
    const { col: startCol, row: startRow } = parseKey(key);
    const startEdges = getConnectedEdges(network, startCol, startRow);

    if (startEdges.length === 0) {
      visitedTiles.add(key);
      continue;
    }

    if (startEdges.length > 2) {
      visitedTiles.add(key);
      continue;
    }

    const pathTiles: Pos[] = [{ col: startCol, row: startRow }];
    visitedTiles.add(key);

    let prev: Pos | null = null;
    let cur: Pos = { col: startCol, row: startRow };

    const OPP: Record<Edge, Edge> = { N: "S", S: "N", E: "W", W: "E" };
    const DIR: Record<Edge, { dc: number; dr: number }> = {
      N: { dc: 0, dr: -1 },
      S: { dc: 0, dr: 1 },
      E: { dc: 1, dr: 0 },
      W: { dc: -1, dr: 0 },
    };

    for (;;) {
      const edges = getConnectedEdges(network, cur.col, cur.row);
      const nextEdge = edges.find(e => !prev || (cur.col + DIR[e].dc !== prev!.col || cur.row + DIR[e].dr !== prev!.row));

      if (!nextEdge) break;

      const nc = cur.col + DIR[nextEdge].dc;
      const nr = cur.row + DIR[nextEdge].dr;
      const nk = tileKey(nc, nr);

      if (!network.hasTile(nc, nr)) break;

      const nEdges = getConnectedEdges(network, nc, nr);
      const comingFrom: Edge = OPP[nextEdge];
      if (!nEdges.includes(comingFrom)) break;

      if (nEdges.length > 2 || visitedTiles.has(nk)) break;

      pathTiles.push({ col: nc, row: nr });
      visitedTiles.add(nk);
      prev = cur;
      cur = { col: nc, row: nr };
    }

    if (pathTiles.length >= 2) {
      paths.push(pathToSegments(pathTiles));
    }
  }

  return paths;
}
