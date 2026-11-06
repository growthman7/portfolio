import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App.jsx";
import "./styles/main.css";

// Active les styles « JavaScript disponible » (animations d'entrée) avant le premier rendu.
document.documentElement.classList.replace("no-js", "js");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
