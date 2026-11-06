import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AdminApp } from "./AdminApp.jsx";
import { ADMIN_BASE } from "./api.js";
import "./admin.css";

createRoot(document.getElementById("admin-root")).render(
  <StrictMode>
    <BrowserRouter basename={ADMIN_BASE}>
      <AdminApp />
    </BrowserRouter>
  </StrictMode>
);
