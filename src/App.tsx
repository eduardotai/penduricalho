import { useState } from "react";
import GameCanvas from "./components/GameCanvas";
import HUD from "./components/HUD";
import Shop from "./components/Shop";
import Inventory from "./components/Inventory";
import StatsPanel from "./components/StatsPanel";

type Panel = "shop" | "inventory" | "stats";

export default function App() {
  const [panel, setPanel] = useState<Panel>("shop");

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <div className="relative flex-1">
        <GameCanvas />
        <HUD />
      </div>

      <aside className="flex h-full w-[380px] flex-col border-l border-slate-800/80 bg-slate-950/70 backdrop-blur">
        <nav className="flex items-stretch border-b border-slate-800/80 text-sm">
          {(["shop", "inventory", "stats"] as Panel[]).map((p) => (
            <button
              key={p}
              onClick={() => setPanel(p)}
              className={`flex-1 px-3 py-3 font-medium uppercase tracking-wide transition-colors ${
                panel === p
                  ? "bg-slate-900 text-brand-300"
                  : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
              }`}
            >
              {p}
            </button>
          ))}
        </nav>
        <div className="scrollbar-thin flex-1 overflow-y-auto p-4">
          {panel === "shop" && <Shop />}
          {panel === "inventory" && <Inventory />}
          {panel === "stats" && <StatsPanel />}
        </div>
      </aside>
    </div>
  );
}
