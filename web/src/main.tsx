import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Tokens first: every other sheet reads them.
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/shell.css";

import { App } from "./App";
import { registerWorker } from "./push/subscription";

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The push-only service worker (brief 14): nothing cached, nothing asked until Notifications is turned on.
registerWorker();
