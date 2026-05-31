export type ToolType = "none" | "createRoad" | "delete";

let activeTool: ToolType = "none";
const listeners = new Set<(tool: ToolType) => void>();

export function getActiveTool(): ToolType {
  return activeTool;
}

export function toggleTool(tool: ToolType): void {
  activeTool = activeTool === tool ? "none" : tool;
  for (const fn of listeners) fn(activeTool);
}

export function onToolChange(fn: (tool: ToolType) => void): void {
  listeners.add(fn);
}