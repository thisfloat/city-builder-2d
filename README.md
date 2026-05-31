# CityFlow

A minimalist 2D city-builder and traffic management simulation. Place roads, watch cars navigate them, and manage the flow.

Built with **TypeScript**, **PixiJS 8**, and **Vite 6**.

## Getting Started

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (default `http://localhost:5173`).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check and production build to `dist/` |
| `npm run preview` | Preview the production build locally |

## Controls

- **Pan** — Click and drag on empty space
- **Zoom** — Mouse wheel (cursors toward pointer)
- **Road tool** — Click the road icon in the toolbar, then click-drag on the grid to place roads
- **Delete tool** — Click the bomb icon, then click-drag to remove roads

## Project Structure

```
src/
  main.ts          # Entry point, bootstraps the app
  constants.ts     # Tile size, grid dimensions, colors
  Camera.ts        # Pan and zoom controls
  Grid.ts          # Background and grid lines
  RoadNetwork.ts   # Graph data structure for road tiles
  RoadRenderer.ts  # Syncs sprites to road network state
  RoadTileset.ts   # Loads and selects road tile textures
  RoadSegments.ts  # Computes drivable curve segments
  WavyRoad.ts      # Procedural road generation
  Cars.ts          # Car simulation, pathfinding, collision
  ToolState.ts     # Active tool state management
  Toolbar.ts       # DOM toolbar UI
  ToolHandler.ts   # Road placement/deletion interaction
  ToolCursor.ts    # Visual cursor overlay
  StatusBar.ts     # Bottom status bar
```

## Tech Stack

- **Language:** TypeScript 5.7 (strict, ES2022 target)
- **Rendering:** PixiJS 8 (WebGL 2D)
- **Bundler:** Vite 6
- **UI:** Plain DOM elements (toolbar, status bar) — not in the WebGL scene
