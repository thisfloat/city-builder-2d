import { Application, Container } from "pixi.js";
import { createBackground, createGridLines } from "./Grid";
import { Camera } from "./Camera";
import { initRoadTileset, type Edge } from "./RoadTileset";
import { generatePath, generateHorizontalPath } from "./WavyRoad";
import { RoadNetwork, tileKey } from "./RoadNetwork";
import { RoadRenderer } from "./RoadRenderer";
import { initCarTextures, spawnCar, updateCar, MAX_CARS, PATHFIND_WEIGHT, type CarData, type Behavior } from "./Cars";
import { WORLD_WIDTH, WORLD_HEIGHT } from "./constants";
import { createToolbar } from "./Toolbar";
import { createStatusBar } from "./StatusBar";
import { createToolCursor } from "./ToolCursor";
import { initToolHandler } from "./ToolHandler";

async function main() {
  const app = new Application();

  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x1a1a1a,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  document.body.appendChild(app.canvas);

  const world = new Container();
  const zoom = 0.5;
  world.scale.set(zoom);
  world.x = (window.innerWidth - WORLD_WIDTH * zoom) / 2;
  world.y = (window.innerHeight - WORLD_HEIGHT * zoom) / 2;
  app.stage.addChild(world);

  await initRoadTileset();
  await initCarTextures();

  const { path: nspPath, startPos: nPos, endPos: sPos } = generatePath();
  const centerIdx = Math.floor(nspPath.length / 2);
  const crossTile = nspPath[centerIdx];
  const { path: wepPath, startPos: wPos, endPos: ePos } = generateHorizontalPath(crossTile.col, crossTile.row);

  function deltaToEdge(dc: number, dr: number): Edge {
    if (dc === 0 && dr === -1) return "N";
    if (dc === 0 && dr === 1) return "S";
    if (dc === 1 && dr === 0) return "E";
    return "W";
  }

  function connectPathEdges(network: RoadNetwork, path: { col: number; row: number }[]): void {
    for (let i = 0; i < path.length; i++) {
      const { col, row } = path[i];
      const edges = network.getEdges(col, row);
      const newEdges = new Set(edges);
      if (i > 0) {
        const prev = path[i - 1];
        newEdges.add(deltaToEdge(prev.col - col, prev.row - row));
      }
      if (i < path.length - 1) {
        const next = path[i + 1];
        newEdges.add(deltaToEdge(next.col - col, next.row - row));
      }
      network.setEdges(col, row, newEdges);
    }
  }

  const network = new RoadNetwork();
  for (const p of nspPath) {
    network.addTileRaw(p.col, p.row);
  }
  for (const p of wepPath) {
    network.addTileRaw(p.col, p.row);
  }
  connectPathEdges(network, nspPath);
  connectPathEdges(network, wepPath);

  const nKey = tileKey(nPos.col, nPos.row);
  const sKey = tileKey(sPos.col, sPos.row);
  const eKey = tileKey(ePos.col, ePos.row);
  const wKey = tileKey(wPos.col, wPos.row);
  const blockedKeys = new Set([nKey, sKey, eKey, wKey]);

  const renderer = new RoadRenderer();

  const cars: CarData[] = [];

  network.onChange((affected) => {
    renderer.syncTiles(network, affected);
    for (const car of cars) {
      if (car.behavior === "pathfind") car.pathDirty = true;
    }
  });

  network.setEdges(nPos.col, nPos.row, new Set<Edge>(["N", "S"]));
  network.setEdges(sPos.col, sPos.row, new Set<Edge>(["N", "S"]));
  network.setEdges(ePos.col, ePos.row, new Set<Edge>(["E", "W"]));
  network.setEdges(wPos.col, wPos.row, new Set<Edge>(["E", "W"]));

  renderer.rebuildAll(network);

  const bg = createBackground();
  world.addChild(bg);
  world.addChild(renderer.container);

  const carsContainer = new Container();
  world.addChild(carsContainer);

  let spawnTimer = 0;

  function randomSpawnInterval(): number {
    return (0.25 + Math.random() * 1.75) * 60;
  }

  let nextSpawn = randomSpawnInterval();

  const OPP_KEY: Record<string, string> = {
    [nKey]: sKey,
    [sKey]: nKey,
    [eKey]: wKey,
    [wKey]: eKey,
  };
  const SPAWN_KEYS = [nKey, sKey, eKey, wKey];

  function spawnCarWithBehavior(): void {
    const spawnKey = SPAWN_KEYS[Math.floor(Math.random() * SPAWN_KEYS.length)];
    const despawnKey = OPP_KEY[spawnKey];
    const behavior: Behavior = Math.random() < PATHFIND_WEIGHT ? "pathfind" : "wander";

    if (cars.length >= MAX_CARS) {
      let oldestIdx = 0;
      let oldestAge = 0;
      for (let i = 0; i < cars.length; i++) {
        if (cars[i].age > oldestAge) {
          oldestAge = cars[i].age;
          oldestIdx = i;
        }
      }
      carsContainer.removeChild(cars[oldestIdx].sprite);
      cars[oldestIdx].sprite.destroy();
      cars.splice(oldestIdx, 1);
    }

    const car = spawnCar(carsContainer, network, spawnKey, despawnKey, behavior);
    if (car) cars.push(car);
  }

  spawnCarWithBehavior();

  app.ticker.add(() => {
    spawnTimer += app.ticker.deltaTime;
    if (spawnTimer >= nextSpawn) {
      spawnTimer = 0;
      nextSpawn = randomSpawnInterval();
      spawnCarWithBehavior();
    }

    for (let i = cars.length - 1; i >= 0; i--) {
      const alive = updateCar(cars[i], network, app.ticker.deltaTime, cars);
      if (!alive) {
        carsContainer.removeChild(cars[i].sprite);
        cars[i].sprite.destroy();
        cars.splice(i, 1);
      }
    }
  });

  const grid = createGridLines();
  world.addChild(grid);

  new Camera(world, app);
  createToolbar();
  createStatusBar();
  createToolCursor(world, app);
  initToolHandler(app, world, network, renderer, blockedKeys);

  window.addEventListener("resize", () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
  });
}

main();
