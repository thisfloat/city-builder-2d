import { GRID_COLS, GRID_ROWS } from "./constants";

export type Pos = { col: number; row: number };

export function generatePath(): { path: Pos[]; startPos: Pos; endPos: Pos } {
  const path: Pos[] = [];
  let col = Math.floor(GRID_COLS / 2);
  let row = 0;
  path.push({ col, row });

  let turnDir = 1;

  while (row < GRID_ROWS - 1) {
    const remaining = GRID_ROWS - 1 - row;

    if (remaining <= 2) {
      for (let r = row + 1; r < GRID_ROWS; r++) {
        path.push({ col, row: r });
      }
      break;
    }

    const downLen = 2 + Math.floor(Math.random() * 6);
    const actualDown = Math.min(downLen, remaining - 2);
    for (let i = 0; i < actualDown; i++) {
      row++;
      path.push({ col, row });
    }

    if (row >= GRID_ROWS - 2) continue;

    const hLen = 2 + Math.floor(Math.random() * 3);
    const newCol = col + turnDir * hLen;

    if (newCol >= 1 && newCol < GRID_COLS - 1) {
      for (let c = col + turnDir; turnDir > 0 ? c <= newCol : c >= newCol; c += turnDir) {
        path.push({ col: c, row });
      }
      row++;
      path.push({ col: newCol, row });
      col = newCol;
    } else {
      row++;
      path.push({ col, row });
    }

    turnDir *= -1;
  }

  return { path, startPos: path[0], endPos: path[path.length - 1] };
}

function wavySegment(sCol: number, sRow: number, eCol: number, eRow: number): Pos[] {
  const path: Pos[] = [];
  let col = sCol;
  let row = sRow;
  path.push({ col, row });

  while (col < eCol) {
    const remaining = eCol - col;

    if (remaining <= 3) {
      for (let c = col + 1; c <= eCol; c++) {
        path.push({ col: c, row });
      }
      col = eCol;

      if (row < eRow) {
        for (let r = row + 1; r <= eRow; r++) {
          path.push({ col: col, row: r });
        }
      } else if (row > eRow) {
        for (let r = row - 1; r >= eRow; r--) {
          path.push({ col: col, row: r });
        }
      }
      row = eRow;
      break;
    }

    const eastLen = 2 + Math.floor(Math.random() * 6);
    const actualLen = Math.min(eastLen, remaining - 3);
    for (let i = 0; i < actualLen; i++) {
      col++;
      path.push({ col, row });
    }

    if (col >= eCol - 3) continue;

    const vLen = 2 + Math.floor(Math.random() * 3);
    const rowDiff = eRow - row;
    const dir = rowDiff >= 0 ? 1 : -1;
    const newRow = row + dir * vLen;
    const clampedRow = Math.max(1, Math.min(GRID_ROWS - 2, newRow));

    for (let r = row + dir; dir > 0 ? r <= clampedRow : r >= clampedRow; r += dir) {
      path.push({ col, row: r });
    }
    col++;
    path.push({ col, row: clampedRow });
    row = clampedRow;
  }

  return path;
}

export function generateHorizontalPath(crossCol: number, crossRow: number): { path: Pos[]; startPos: Pos; endPos: Pos } {
  const centerRow = Math.floor(GRID_ROWS / 2);
  const startRow = Math.max(1, Math.min(GRID_ROWS - 2, centerRow + Math.floor(Math.random() * 9) - 4));
  const endRow = Math.max(1, Math.min(GRID_ROWS - 2, centerRow + Math.floor(Math.random() * 9) - 4));

  const firstHalf = wavySegment(1, startRow, crossCol, crossRow);
  firstHalf.unshift({ col: 0, row: startRow });
  const secondHalf = wavySegment(crossCol, crossRow, GRID_COLS - 2, endRow);
  secondHalf.push({ col: GRID_COLS - 1, row: endRow });

  const path = [...firstHalf, ...secondHalf.slice(1)];

  return {
    path,
    startPos: { col: 0, row: startRow },
    endPos: { col: GRID_COLS - 1, row: endRow },
  };
}
