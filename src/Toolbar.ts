import { toggleTool, onToolChange, type ToolType } from "./ToolState";

const STYLE = `#toolbar {
  position: fixed; left: 16px; top: 50%; transform: translateY(-50%);
  display: flex; flex-direction: column; gap: 4px; z-index: 10;
}
#toolbar button {
  padding: 10px 12px; background: rgba(26,26,26,0.85); color: #ccc;
  border: 1px solid #555; border-radius: 6px;
  cursor: pointer; font-size: 22px; line-height: 1;
  white-space: nowrap; transition: background 0.15s, border-color 0.15s, color 0.15s;
}
#toolbar button:hover { background: rgba(40,40,40,0.9); }
#toolbar button.active {
  background: rgba(26,26,26,0.95); color: #fff;
  border-left: 3px solid #ffcc00;
  padding-left: 9px;
}`;

const BUTTONS: { icon: string; tool: ToolType }[] = [
  { icon: "fa-road", tool: "createRoad" },
  { icon: "fa-bomb", tool: "delete" },
];

export function createToolbar(): void {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.appendChild(style);

  const wrapper = document.createElement("div");
  wrapper.id = "toolbar";

  for (const { icon, tool } of BUTTONS) {
    const btn = document.createElement("button");
    btn.innerHTML = `<i class="fa-solid ${icon}"></i>`;
    btn.addEventListener("click", () => toggleTool(tool));
    wrapper.appendChild(btn);
  }

  document.body.appendChild(wrapper);

  onToolChange((tool) => {
    const buttons = wrapper.querySelectorAll("button");
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle("active", BUTTONS[i].tool === tool);
    }
  });
}