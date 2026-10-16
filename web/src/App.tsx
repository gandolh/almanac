import { APP_NAME } from "@almanac/shared";
import { useEffect, useState } from "react";
import { API_BASE } from "./base";

type Health = { state: "loading" } | { state: "ok"; status: string } | { state: "failed"; message: string };

/**
 * The scaffold's page: the app's name and what `GET /api/health` answered
 * through the API prefix, which shows the proxy and the server are wired.
 * Brief 02 puts the auth gate and the real shell around it.
 */
export function App() {
  const [health, setHealth] = useState<Health>({ state: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/api/health`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`The server answered ${res.status}.`);
        const body = (await res.json()) as { status: string };
        setHealth({ state: "ok", status: body.status });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setHealth({ state: "failed", message: err instanceof Error ? err.message : String(err) });
      });
    return () => controller.abort();
  }, []);

  return (
    <main>
      <h1>{APP_NAME}</h1>
      <p>
        {health.state === "loading" && "Checking the server…"}
        {health.state === "ok" && `Server: ${health.status}`}
        {health.state === "failed" && `Server: ${health.message}`}
      </p>
    </main>
  );
}
