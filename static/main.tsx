import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import EsatApp from "../app/esat-app";
import { AppErrorBoundary } from "../app/error-boundary";
import "../app/globals.css";
import "../app/analysis.css";
import "../app/study-plan.css";

const root = document.getElementById("root");
if (!root) throw new Error("ESAT Atlas root element was not found.");

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <EsatApp />
    </AppErrorBoundary>
  </StrictMode>,
);
