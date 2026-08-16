import "./index.css";
import "./i18n/config";
import ReactDOM from "react-dom/client";
import { buildBootstrapUrl } from "./lib/api";
import { DirectionProvider } from "./components/layout/DirectionProvider";

/**
 * Fetch the dataset from Laravel BEFORE importing <App>, so the data modules
 * (data/seed.ts, data/opsSeed.ts) read window.__DATA__ at import time.
 * Falls back to the bundled seed if the request fails (e.g. offline preview).
 */
async function boot() {
  const rootEl = document.getElementById("root");
  if (!rootEl) return;

  try {
    const savedTheme = localStorage.getItem("brand-theme-color");
    if (savedTheme) {
      document.documentElement.style.setProperty("--primary", savedTheme);
      document.documentElement.style.setProperty("--ring", savedTheme);
    }
  } catch {}

  // Auth pages don't need protected data — skip the bootstrap fetch and
  // render the standalone auth shell instead of the main app.
  const path = window.location.pathname.replace(/\/$/, "");
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;

  // Demo-preview mode intentionally bypasses the unavailable database-backed
  // bootstrap while preserving the same role/permission shape used by the app.
  // In a production static build, the dashboard opens directly; in development,
  // the local demo token keeps the normal login flow available for testing.
  const demoPreviewEnabled = import.meta.env.VITE_DEMO_PREVIEW === "true";
  const localDemoSession = import.meta.env.DEV && token === "local-demo-preview";
  const demoQuery = new URLSearchParams(window.location.search).get("demo") === "1";
  if ((demoPreviewEnabled || localDemoSession || demoQuery) && path !== "/login" && path !== "/register" && path !== "/app/login" && path !== "/app/register") {
    (window as any).__DATA__ = {
      user: {
        id: 1,
        name: "Demo Super Admin",
        email: "superadmin@taskflow.dev",
        role: "super-admin",
        permissions: [],
      },
    };
    const { default: LocalDemoPreviewPage } = await import("./pages/LocalDemoPreviewPage");
    ReactDOM.createRoot(rootEl).render(
      <DirectionProvider>
        <LocalDemoPreviewPage />
      </DirectionProvider>
    );
    return;
  }

  // Unauthenticated users are sent directly to the Login page.
  if (path === "/login" || path === "/register" || path === "/app/login" || path === "/app/register" || !token) {
    if (!token && path !== "/login" && path !== "/register" && path !== "/app/login" && path !== "/app/register") {
      window.history.replaceState(null, "", "/login");
    }
    const { AuthGate } = await import("./App");
    ReactDOM.createRoot(rootEl).render(
      <DirectionProvider>
        <AuthGate />
      </DirectionProvider>
    );
    return;
  }

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(buildBootstrapUrl(), {
      credentials: "include",
      headers,
    });
    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
      return;
    }
    if (res.ok) {
      (window as any).__DATA__ = await res.json();
    }
  } catch {
    /* keep bundled seed fallback */
  }

  const { App } = await import("./App");
  ReactDOM.createRoot(rootEl).render(
    <DirectionProvider>
      <App />
    </DirectionProvider>
  );
}

boot();
