// Thin fetch wrapper for the Laravel REST API (routes/api.php).
// Uses the session cookie (Sanctum stateful) + the XSRF-TOKEN cookie so the
// logged-in web user is authenticated without a separate token exchange.

export const apiBase = "/api";
export const appBase = "/";
export const bootstrapBase = "/spa/bootstrap";
export const authMeUrl = "/api/auth/me";
export const localeUrl = "/locale";
export const loginUrl = "/login";
export const logoutUrl = "/api/auth/logout";

const ACTIVE_PROJECT_KEY = "activeProjectId";
const PROJECT_SCOPE_KEY = "projectScope";

function fallbackScope(id: string) {
  return { mode: "single", projectIds: [id], primaryProjectId: id };
}

function readBootstrapData(): any | null {
  return typeof window !== "undefined" ? (window as any).__DATA__ || null : null;
}

export function readXsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )XSRF-TOKEN=([^;]+)"));
  if (match) return decodeURIComponent(match[2]);
  return null;
}

export function buildBootstrapUrl(scope = getProjectScope()): string {
  if (!scope || scope.mode === "all") return `${bootstrapBase}?project=all`;
  if (scope.mode === "single" && scope.primaryProjectId) return `${bootstrapBase}?project=${scope.primaryProjectId}`;
  const qs = scope.projectIds.map((id: string) => `project_ids[]=${id}`).join("&");
  return `${bootstrapBase}?${qs}`;
}

function readProjectScope(): any | null {
  try {
    const raw = localStorage.getItem(PROJECT_SCOPE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readBootstrapProjectScope(): any | null {
  const data = readBootstrapData();
  const scope = data?.projectScope;
  if (scope?.primaryProjectId && Array.isArray(scope.projectIds)) {
    return scope;
  }

  const projectId = data?.project?.id;
  if (projectId) {
    return fallbackScope(String(projectId));
  }

  return null;
}

/** The project id the user last selected (persisted across reloads). */
export function getActiveProjectId(): string | null {
  try {
    return getProjectScope()?.primaryProjectId ?? localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function getProjectScope(): { mode: "single" | "multi" | "all"; projectIds: string[]; primaryProjectId: string; label?: string; projectNames?: string[] } | null {
  const scope = readProjectScope();
  if (scope?.primaryProjectId && Array.isArray(scope.projectIds)) {
    return scope;
  }

  const bootstrapScope = readBootstrapProjectScope();
  if (bootstrapScope) {
    return bootstrapScope;
  }

  try {
    const active = localStorage.getItem(ACTIVE_PROJECT_KEY);
    return active ? fallbackScope(active) : null;
  } catch {
    return null;
  }
}

export function setProjectScope(scope: { mode: "single" | "multi" | "all"; projectIds: string[]; primaryProjectId: string; label?: string; projectNames?: string[] }, reload = true): void {
  try {
    localStorage.setItem(PROJECT_SCOPE_KEY, JSON.stringify(scope));
    localStorage.setItem(ACTIVE_PROJECT_KEY, scope.primaryProjectId);
  } catch { /* ignore */ }
  if (reload) {
    window.location.href = appBase;
  }
}

/** Switch the active project and reload so the bootstrap re-fetches its data. */
export function setActiveProject(id: string | number, reload = true): void {
  const strId = String(id);
  setProjectScope(fallbackScope(strId), reload);
}

export interface ApiFetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
}

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function apiFetch<T = any>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T | null> {
  const { retries = 2, retryDelay = 800, fetchOptions } = splitOptions(options);
  const token = readXsrfToken();

  let lastError: (Error & { status?: number; details?: any }) | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(retryDelay * attempt);
    }

    try {
      const jwtToken = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(apiBase + path, {
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { "X-XSRF-TOKEN": token } : {}),
          ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
          ...fetchOptions.headers,
        },
        ...fetchOptions,
      });

      if (!res.ok) {
        // Don't retry client errors (4xx) except retryable ones
        if (res.status >= 400 && res.status < 500 && !RETRYABLE_STATUSES.has(res.status)) {
          throw await buildApiError(res);
        }
        // For retryable errors, save and continue
        if (attempt < retries && RETRYABLE_STATUSES.has(res.status)) {
          lastError = await buildApiError(res);
          continue;
        }
        throw await buildApiError(res);
      }

      const text = await res.text();
      return text ? (JSON.parse(text) as T) : null;
    } catch (err: any) {
      // Network errors are retryable
      if (err?.name === "TypeError" && attempt < retries) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

function splitOptions(options: ApiFetchOptions): {
  retries: number;
  retryDelay: number;
  fetchOptions: RequestInit;
} {
  const { retries = 2, retryDelay = 800, ...fetchOptions } = options;
  return { retries, retryDelay, fetchOptions };
}

async function buildApiError(res: Response): Promise<Error & { status?: number; details?: any }> {
  let msg = `Request failed (${res.status})`;
  let details: any = null;

  try {
    const body = await res.json();
    details = body;
    if (typeof body?.message === "string" && body.message.trim()) {
      msg = body.message;
    } else if (typeof body?.detail === "string" && body.detail.trim()) {
      msg = body.detail;
    } else if (body?.errors && typeof body.errors === "object") {
      const firstError = Object.values(body.errors)
        .flat()
        .find((v) => typeof v === "string" && v.trim());
      if (typeof firstError === "string") {
        msg = firstError;
      }
    }
  } catch { /* ignore non-JSON errors */ }

  const error = new Error(msg) as Error & { status?: number; details?: any };
  error.status = res.status;
  error.details = details;
  return error;
}

export const api = {
  get: <T = any>(p: string) => apiFetch<T>(p),
  post: <T = any>(p: string, body?: unknown) =>
    apiFetch<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(p: string, body?: unknown) =>
    apiFetch<T>(p, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T = any>(p: string, body?: unknown) =>
    apiFetch<T>(p, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T = any>(p: string, body?: unknown) =>
    apiFetch<T>(p, { method: "DELETE", body: body ? JSON.stringify(body) : undefined }),
};
