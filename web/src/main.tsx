import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles/index.css";

import { App } from "./App";
import { registerWorker } from "./push/subscription";

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The push-only service worker: nothing cached, nothing asked until Notifications is turned on.
registerWorker();
