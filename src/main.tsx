import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// Open-licensed (OFL-1.1) variable fonts, self-hosted via Fontsource.
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
