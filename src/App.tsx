import { useState } from "react";
import GameCanvas from "./components/GameCanvas";
import HUD from "./components/HUD";
import Customize from "./components/Customize";
import ControlPanel from "./components/ControlPanel";

export default function App() {
  const [customizeOpen, setCustomizeOpen] = useState(false);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <GameCanvas />
      <HUD />
      <ControlPanel onOpenCustomize={() => setCustomizeOpen(true)} />
      <Customize open={customizeOpen} onClose={() => setCustomizeOpen(false)} />
    </div>
  );
}
