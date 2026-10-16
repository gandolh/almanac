import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Tokens first: every other sheet reads them.
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/shell.css";

import { App } from "./App";

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
