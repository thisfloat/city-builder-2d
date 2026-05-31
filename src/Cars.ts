import { Assets, Container, Sprite, Texture } from "pixi.js";
import { TILE_SIZE, GRID_COLS, GRID_ROWS, CAR_REACTION_DELAY, STOP_ALL_INTERSECTIONS } from "./constants";
import { type Edge } from "./RoadTileset";
import { type RoadNetwork, tileKey, parseKey } from "./RoadNetwork";

type PathStep = {
  col: number;
  row: number;
  enterEdge: Edge;
  exitEdge: Edge;
};

export type Behavior = "pathfind" | "wander";

export type CarData = {
  sprite: Sprite;
  col: number;
  row: number;
  enterEdge: Edge;
  exitEdge: Edge;
  traveled: number;
  speed: number;
  lane: 1;
  pathSteps: PathStep[];
  pathIndex: number;
  behavior: Behavior;
  despawnKey: string;
  age: number;
  distSinceIntersection: number;
  stopped: boolean;
  pathDirty: boolean;
  reactionFrames: number;
};

export const MAX_CARS = 50;
export const PATHFIND_WEIGHT = 0.7;

const LANE_OFFSET = 12;
const CAR_SPEED = 4.5;
const CRUISE_SPEED = CAR_SPEED * 0.5;
const DECEL_DISTANCE = TILE_SIZE + 32;
const ACCEL_DISTANCE = TILE_SIZE;
const CAR_LENGTH = 24;
const MIN_GAP = 12;
const MAX_AGE_FRAMES = 3 * 60 * 60;
const carTextures: Texture[] = [];

const DIR: Record<Edge, { dc: number; dr: number }> = {
  N: { dc: 0, dr: -1 },
  S: { dc: 0, dr: 1 },
  E: { dc: 1, dr: 0 },
  W: { dc: -1, dr: 0 },
};

const OPP: Record<Edge, Edge> = {
  N: "S", S: "N", E: "W", W: "E",
};

const blocks = import.meta.glob<{ default: string }>("../sprites/car_*.png", {
  eager: true,
});

export async function initCarTextures(): Promise<void> {
  const urls: string[] = [];
  for (const [filepath, mod] of Object.entries(blocks)) {
    if (filepath.includes("black")) continue;
    urls.push(mod.default);
  }
  const textures = await Promise.all(urls.map((url) => Assets.load(url)));
  carTextures.push(...textures);
}

function edgeCenter(col: number, row: number, edge: Edge): { x: number; y: number } {
  switch (edge) {
    case "N": return { x: (col + 0.5) * TILE_SIZE, y: row * TILE_SIZE };
    case "S": return { x: (col + 0.5) * TILE_SIZE, y: (row + 1) * TILE_SIZE };
    case "E": return { x: (col + 1) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
    case "W": return { x: col * TILE_SIZE, y: (row + 0.5) * TILE_SIZE };
  }
}

function getSpawnEdges(col: number, row: number): { enterEdge: Edge; exitEdge: Edge } {
  if (row === 0) return { enterEdge: "N", exitEdge: "S" };
  if (row === GRID_ROWS - 1) return { enterEdge: "S", exitEdge: "N" };
  if (col === GRID_COLS - 1) return { enterEdge: "E", exitEdge: "W" };
  return { enterEdge: "W", exitEdge: "E" };
}

function getDespawnEdges(col: number, row: number): { enterEdge: Edge; exitEdge: Edge } {
  if (row === 0) return { enterEdge: "S", exitEdge: "N" };
  if (row === GRID_ROWS - 1) return { enterEdge: "N", exitEdge: "S" };
  if (col === GRID_COLS - 1) return { enterEdge: "W", exitEdge: "E" };
  return { enterEdge: "E", exitEdge: "W" };
}

function tileDist(col: number, row: number, enterEdge: Edge, exitEdge: Edge): number {
  const p1 = edgeCenter(col, row, enterEdge);
  const cx = (col + 0.5) * TILE_SIZE;
  const cy = (row + 0.5) * TILE_SIZE;

  if (enterEdge === exitEdge) {
    return Math.hypot(cx - p1.x, cy - p1.y) * 2;
  }

  if (exitEdge === OPP[enterEdge]) {
    const p2 = edgeCenter(col, row, exitEdge);
    const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    return d > 0 ? d : TILE_SIZE;
  }

  const p2 = edgeCenter(col, row, exitEdge);
  return Math.hypot(cx - p1.x, cy - p1.y) + Math.hypot(p2.x - cx, p2.y - cy);
}

function isIntersection(network: RoadNetwork, col: number, row: number): boolean {
  if (!network.hasTile(col, row)) return false;
  return network.getEdges(col, row).size >= 3;
}

function isOtherCarAt(allCars: CarData[], self: CarData, col: number, row: number): boolean {
  return allCars.some((c) => c !== self && c.col === col && c.row === row);
}

function shouldYieldNextTile(
  data: CarData,
  network: RoadNetwork,
  allCars: CarData[],
  nextCol: number,
  nextRow: number,
): boolean {
  for (const other of allCars) {
    if (other === data) continue;
    if (other.col !== nextCol || other.row !== nextRow) continue;

    if (isIntersection(network, nextCol, nextRow)) {
      if (other.exitEdge === OPP[data.exitEdge]) {
        const otherDist = tileDist(other.col, other.row, other.enterEdge, other.exitEdge);
        if (other.traveled >= otherDist) continue;
      }
      return true;
    }

    if (other.enterEdge === OPP[data.exitEdge]) {
      const remainingUs = tileDist(data.col, data.row, data.enterEdge, data.exitEdge) - data.traveled;
      const gap = remainingUs + other.traveled - CAR_LENGTH;
      if (gap < MIN_GAP) return true;
    }
  }
  return false;
}

function computeMaxSafeTraveled(data: CarData, allCars: CarData[]): number {
  const dist = tileDist(data.col, data.row, data.enterEdge, data.exitEdge);
  let maxTraveled = dist;

  for (const other of allCars) {
    if (other === data) continue;
    if (other.col !== data.col || other.row !== data.row) continue;
    if (other.enterEdge !== data.enterEdge) continue;
    if (other.traveled <= data.traveled) continue;

    const limit = other.traveled - CAR_LENGTH - MIN_GAP;
    if (limit < maxTraveled) maxTraveled = limit;
  }

  return Math.max(0, Math.min(maxTraveled, dist));
}

function manageSpeed(data: CarData, network: RoadNetwork, allCars: CarData[], deltaTime: number): void {
  if (data.stopped) return;

  const inIntersection = isIntersection(network, data.col, data.row);

  if (inIntersection) {
    data.speed = (STOP_ALL_INTERSECTIONS || isOtherCarAt(allCars, data, data.col, data.row)) ? 0 : CRUISE_SPEED;
    data.distSinceIntersection = 0;
    return;
  }

  const nextCol = data.col + DIR[data.exitEdge].dc;
  const nextRow = data.row + DIR[data.exitEdge].dr;
  const nextIsIntersection = isIntersection(network, nextCol, nextRow);
  const distToNextEntry = tileDist(data.col, data.row, data.enterEdge, data.exitEdge) - data.traveled;

  if (nextIsIntersection && distToNextEntry <= DECEL_DISTANCE) {
    const targetAtEntry = isOtherCarAt(allCars, data, nextCol, nextRow) ? 0 : CRUISE_SPEED;
    const fraction = 1 - distToNextEntry / DECEL_DISTANCE;
    data.speed = CAR_SPEED + (targetAtEntry - CAR_SPEED) * fraction;
    data.distSinceIntersection = 0;
    return;
  }

  data.distSinceIntersection += data.speed * deltaTime;
  if (data.distSinceIntersection < ACCEL_DISTANCE) {
    const fraction = data.distSinceIntersection / ACCEL_DISTANCE;
    data.speed = CRUISE_SPEED + (CAR_SPEED - CRUISE_SPEED) * fraction;
  } else {
    data.speed = CAR_SPEED;
  }
}

function setCarPosition(data: CarData): void {
  const dist = tileDist(data.col, data.row, data.enterEdge, data.exitEdge);
  const traveled = Math.min(data.traveled, dist);
  const p1 = edgeCenter(data.col, data.row, data.enterEdge);
  const p2 = edgeCenter(data.col, data.row, data.exitEdge);

  let x: number, y: number, tx: number, ty: number;

  if (data.enterEdge === data.exitEdge) {
    const cx = (data.col + 0.5) * TILE_SIZE;
    const cy = (data.row + 0.5) * TILE_SIZE;
    const halfDist = dist / 2;
    if (traveled < halfDist) {
      const t = halfDist > 0 ? traveled / halfDist : 0;
      x = p1.x + (cx - p1.x) * t;
      y = p1.y + (cy - p1.y) * t;
      tx = cx - p1.x;
      ty = cy - p1.y;
    } else {
      const t = halfDist > 0 ? (traveled - halfDist) / halfDist : 0;
      x = cx + (p1.x - cx) * t;
      y = cy + (p1.y - cy) * t;
      tx = p1.x - cx;
      ty = p1.y - cy;
    }
  } else if (data.exitEdge === OPP[data.enterEdge]) {
    const t = dist > 0 ? traveled / dist : 0;
    x = p1.x + (p2.x - p1.x) * t;
    y = p1.y + (p2.y - p1.y) * t;
    tx = p2.x - p1.x;
    ty = p2.y - p1.y;
  } else {
    const cx = (data.col + 0.5) * TILE_SIZE;
    const cy = (data.row + 0.5) * TILE_SIZE;
    const t = dist > 0 ? traveled / dist : 0;
    const oneMinusT = 1 - t;
    x = oneMinusT * oneMinusT * p1.x + 2 * oneMinusT * t * cx + t * t * p2.x;
    y = oneMinusT * oneMinusT * p1.y + 2 * oneMinusT * t * cy + t * t * p2.y;
    tx = 2 * (oneMinusT * (cx - p1.x) + t * (p2.x - cx));
    ty = 2 * (oneMinusT * (cy - p1.y) + t * (p2.y - cy));
  }

  const len = Math.hypot(tx, ty);
  if (len > 0) {
    tx /= len;
    ty /= len;
  }

  x += -ty * LANE_OFFSET;
  y += tx * LANE_OFFSET;

  data.sprite.x = x;
  data.sprite.y = y;
  data.sprite.rotation = Math.atan2(ty, tx) + Math.PI / 2;
}

function findPath(
  network: RoadNetwork,
  fromKey: string,
  toKey: string,
  startEnterEdge?: Edge,
): PathStep[] | null {
  const visited = new Set<string>();
  const parent = new Map<string, string | null>();
  const queue: string[] = [fromKey];
  visited.add(fromKey);
  parent.set(fromKey, null);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === toKey) break;

    const { col, row } = parseKey(current);
    const edges = network.getEdges(col, row);

    for (const edge of edges) {
      const { dc, dr } = DIR[edge];
      const nk = tileKey(col + dc, row + dr);
      if (visited.has(nk) || !network.hasTile(col + dc, row + dr)) continue;
      visited.add(nk);
      parent.set(nk, current);
      queue.push(nk);
    }
  }

  if (!visited.has(toKey)) return null;

  const keyPath: string[] = [];
  let k: string | null = toKey;
  while (k !== null) {
    keyPath.unshift(k);
    k = parent.get(k) ?? null;
  }

  const steps: PathStep[] = [];
  for (let i = 0; i < keyPath.length; i++) {
    const { col, row } = parseKey(keyPath[i]);

    let enterEdge: Edge;
    if (i === 0 && startEnterEdge !== undefined) {
      enterEdge = startEnterEdge;
    } else if (i === 0) {
      enterEdge = getSpawnEdges(col, row).enterEdge;
    } else {
      const prev = parseKey(keyPath[i - 1]);
      if (prev.col < col) enterEdge = "W";
      else if (prev.col > col) enterEdge = "E";
      else if (prev.row < row) enterEdge = "N";
      else enterEdge = "S";
    }

    let exitEdge: Edge;
    if (i === keyPath.length - 1) {
      exitEdge = getDespawnEdges(col, row).exitEdge;
    } else {
      const next = parseKey(keyPath[i + 1]);
      if (next.col > col) exitEdge = "E";
      else if (next.col < col) exitEdge = "W";
      else if (next.row > row) exitEdge = "S";
      else exitEdge = "N";
    }

    steps.push({ col, row, enterEdge, exitEdge });
  }

  return steps;
}

export function spawnCar(
  container: Container,
  network: RoadNetwork,
  spawnKey: string,
  despawnKey: string,
  behavior: Behavior,
): CarData | null {
  if (carTextures.length === 0) return null;

  const { col, row } = parseKey(spawnKey);
  const { enterEdge, exitEdge } = getSpawnEdges(col, row);

  let pathSteps: PathStep[];

  if (behavior === "pathfind") {
    const found = findPath(network, spawnKey, despawnKey);
    if (!found || found.length === 0) return null;
    pathSteps = found;
  } else {
    pathSteps = [{ col, row, enterEdge, exitEdge }];
  }

  const tex = carTextures[Math.floor(Math.random() * carTextures.length)];
  const sprite = new Sprite(tex);
  sprite.anchor.set(0.5, 0.5);
  sprite.scale.set(0.5);

  const data: CarData = {
    sprite,
    col,
    row,
    enterEdge,
    exitEdge,
    traveled: 0,
    speed: CAR_SPEED,
    lane: 1,
    pathSteps,
    pathIndex: 0,
    behavior,
    despawnKey,
    age: 0,
    distSinceIntersection: 0,
    stopped: false,
    pathDirty: false,
    reactionFrames: Math.floor(Math.random() * (CAR_REACTION_DELAY + 1)),
  };

  setCarPosition(data);
  container.addChild(sprite);
  return data;
}

export function recomputeCarPath(data: CarData, network: RoadNetwork): void {
  if (data.behavior === "wander") return;

  const key = tileKey(data.col, data.row);

  if (!network.hasTile(data.col, data.row)) {
    data.behavior = "wander";
    data.age = 0;
    return;
  }

  const path = findPath(network, key, data.despawnKey, data.enterEdge);

  if (path) {
    data.pathSteps = path;
    data.pathIndex = 0;
    data.exitEdge = path[0].exitEdge;
  } else {
    data.behavior = "wander";
    data.age = 0;
  }
}

function updateWandering(data: CarData, network: RoadNetwork, deltaTime: number, allCars: CarData[]): boolean {
  data.age += deltaTime;
  if (data.age >= MAX_AGE_FRAMES) return false;

  const desired = data.traveled + data.speed * deltaTime;
  data.traveled = desired;

  data.reactionFrames--;
  const canReact = data.reactionFrames <= 0;

  const safeTravel = computeMaxSafeTraveled(data, allCars);
  if (canReact && data.traveled > safeTravel) {
    data.traveled = safeTravel;
    data.speed = 0;
    data.stopped = true;
  } else {
    data.stopped = false;
  }

  let safe = 20;
  while (data.traveled > 0 && safe > 0) {
    safe--;

    const dist = tileDist(data.col, data.row, data.enterEdge, data.exitEdge);
    if (data.traveled < dist) break;

    data.traveled -= dist;

    const nextCol = data.col + DIR[data.exitEdge].dc;
    const nextRow = data.row + DIR[data.exitEdge].dr;

    if (nextCol < 0 || nextCol >= GRID_COLS || nextRow < 0 || nextRow >= GRID_ROWS) return false;

    if (!network.hasTile(nextCol, nextRow)) {
      const tmp = data.enterEdge;
      data.enterEdge = data.exitEdge;
      data.exitEdge = tmp;
      continue;
    }

    if (canReact && shouldYieldNextTile(data, network, allCars, nextCol, nextRow)) {
      data.traveled = dist;
      data.speed = 0;
      data.stopped = true;
      break;
    }

    data.col = nextCol;
    data.row = nextRow;
    data.enterEdge = OPP[data.exitEdge];

    const edges = network.getEdges(nextCol, nextRow);
    const available = Array.from(edges).filter((e) => e !== data.enterEdge);

    if (available.length === 0) {
      data.exitEdge = data.enterEdge;
    } else if (available.length === 1) {
      data.exitEdge = available[0];
    } else {
      data.exitEdge = available[Math.floor(Math.random() * available.length)];
    }
  }

  if (canReact) data.reactionFrames = CAR_REACTION_DELAY;

  manageSpeed(data, network, allCars, deltaTime);
  setCarPosition(data);
  return true;
}

export function updateCar(
  data: CarData,
  network: RoadNetwork,
  deltaTime: number,
  allCars: CarData[],
): boolean {
  if (data.behavior === "wander") {
    return updateWandering(data, network, deltaTime, allCars);
  }

  if (data.pathDirty) {
    data.pathDirty = false;
    recomputeCarPath(data, network);
    if (data.behavior !== "pathfind") return updateWandering(data, network, deltaTime, allCars);
  }

  const desired = data.traveled + data.speed * deltaTime;
  data.traveled = desired;

  data.reactionFrames--;
  const canReact = data.reactionFrames <= 0;

  const safeTravel = computeMaxSafeTraveled(data, allCars);
  if (canReact && data.traveled > safeTravel) {
    data.traveled = safeTravel;
    data.speed = 0;
    data.stopped = true;
  } else {
    data.stopped = false;
  }

  let safe = 20;
  while (data.traveled > 0 && safe > 0) {
    safe--;

    const dist = tileDist(data.col, data.row, data.enterEdge, data.exitEdge);
    if (data.traveled < dist) break;

    data.traveled -= dist;
    data.pathIndex++;

    if (data.pathIndex >= data.pathSteps.length) return false;

    const step = data.pathSteps[data.pathIndex];

    if (!network.hasTile(step.col, step.row)) {
      data.traveled = dist;
      data.pathDirty = true;
      break;
    }

    if (canReact && shouldYieldNextTile(data, network, allCars, step.col, step.row)) {
      data.traveled = dist;
      data.speed = 0;
      data.stopped = true;
      break;
    }

    data.col = step.col;
    data.row = step.row;
    data.enterEdge = step.enterEdge;
    data.exitEdge = step.exitEdge;
  }

  if (canReact) data.reactionFrames = CAR_REACTION_DELAY;

  manageSpeed(data, network, allCars, deltaTime);
  setCarPosition(data);
  return true;
}
