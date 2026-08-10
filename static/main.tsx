import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import EsatApp from "../app/esat-app";
import "../app/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("ESAT Atlas root element was not found.");

createRoot(root).render(
  <StrictMode>
    <EsatApp />
  </StrictMode>,
);
