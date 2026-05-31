import { onToolChange, type ToolType } from "./ToolState";

const STYLE = `#statusbar {
  position: fixed; left: 0; bottom: 0; width: 100%;
  display: flex; justify-content: space-between; align-items: center;
  height: 40px; padding: 0 16px;
  background: rgba(26,26,26,0.85); color: #ccc;
  border-top: 1px solid #555;
  font-family: sans-serif; font-size: 14px;
  z-index: 10;
}
#statusbar .section {
  display: flex; align-items: center; gap: 6px;
  min-width: 0; white-space: nowrap;
}
#statusbar .center {
  flex: 1; justify-content: center;
}
#statusbar .right {
  justify-content: flex-end;
}
#statusbar i {
  font-size: 14px;
  width: 16px; text-align: center;
}`;

const DATE = "2020/12/25";
const POPULATION = "0";
const MONEY = "$20,000";

const TOOL_LABELS: Record<ToolType, { icon: string; label: string }> = {
  none: { icon: "", label: "" },
  createRoad: { icon: "fa-road", label: "Road" },
  delete: { icon: "fa-bomb", label: "Delete" },
};

export function createStatusBar(): void {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.appendChild(style);

  const bar = document.createElement("div");
  bar.id = "statusbar";

  const left = document.createElement("div");
  left.className = "section left";
  left.textContent = DATE;

  const center = document.createElement("div");
  center.className = "section center";

  const right = document.createElement("div");
  right.className = "section right";
  right.innerHTML = `<i class="fa-solid fa-person"></i> ${POPULATION} &nbsp;|&nbsp; <i class="fa-solid fa-coins"></i> ${MONEY}`;

  bar.appendChild(left);
  bar.appendChild(center);
  bar.appendChild(right);
  document.body.appendChild(bar);

  onToolChange((tool) => {
    const info = TOOL_LABELS[tool];
    center.innerHTML = info.icon
      ? `<i class="fa-solid ${info.icon}"></i> ${info.label}`
      : "";
  });
}
