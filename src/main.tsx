import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Open-licensed (OFL-1.1) variable fonts, self-hosted via Fontsource. The
// browser only downloads a face when a theme actually uses it.
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "@fontsource-variable/cinzel";
import "@fontsource-variable/orbitron";
import "./index.css";
import { useGameStore } from "./state/store";
import { applyTheme } from "./lib/applyTheme";
import { setRenderTheme } from "./game/themes";

function syncTheme(id: string) {
  applyTheme(id);
  setRenderTheme(id);
}

// Apply the saved theme before the first paint (the store hydrates
// synchronously from localStorage), then follow later changes.
syncTheme(useGameStore.getState().themeId);
useGameStore.subscribe((s, prev) => {
  if (s.themeId !== prev.themeId) syncTheme(s.themeId);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
