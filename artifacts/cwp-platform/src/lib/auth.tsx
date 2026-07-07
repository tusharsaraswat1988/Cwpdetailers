import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import {
  authPortalHeaders,
  migrateLegacySession,
  resolveAuthPortal,
  tokenStorageKey,
  userStorageKey,
  type AuthPortal,
} from "./authPortal";

export type UserRole = "customer" | "staff" | "admin" | "superadmin" | "franchisee" | "manager";

export interface AuthUser {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  role: UserRole;
  branchId?: number | null;
  companyId?: number | null;
  franchiseeId?: number | null;
  staffId?: number | null;
  customerId?: number | null;
  hasUserPassword?: boolean;
}

export type PermissionTuple = { resource: string; action: string };
export type TenantScope = {
  isSuperAdmin: boolean;
  companyId: number | null;
  branchIds: number[] | null;
  franchiseeId: number | null;
  customerId: number | null;
  staffId: number | null;
};

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  permissions: PermissionTuple[];
  scope: TenantScope | null;
  hasPermission: (resource: string, action: string) => boolean;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SESSION_VALIDATE_RETRIES = 3;
const SESSION_VALIDATE_RETRY_MS = 500;

function isSuperAdmin(role?: UserRole | null) {
  return role === "admin" || role === "superadmin";
}

function clearStoredSession(portal: AuthPortal) {
  localStorage.removeItem(tokenStorageKey(portal));
  localStorage.removeItem(userStorageKey(portal));
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeAuthUser(raw: unknown): AuthUser | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  if (typeof u.id !== "number" || typeof u.name !== "string") return null;

  const phone = typeof u.phone === "string" ? u.phone : String(u.phone ?? "");

  return {
    id: u.id,
    name: u.name,
    phone,
    email: typeof u.email === "string" ? u.email : u.email ?? null,
    role: u.role as UserRole,
    branchId: typeof u.branchId === "number" ? u.branchId : u.branchId ?? null,
    companyId: typeof u.companyId === "number" ? u.companyId : u.companyId ?? null,
    franchiseeId: typeof u.franchiseeId === "number" ? u.franchiseeId : u.franchiseeId ?? null,
    staffId: typeof u.staffId === "number" ? u.staffId : u.staffId ?? null,
    customerId: typeof u.customerId === "number" ? u.customerId : u.customerId ?? null,
    hasUserPassword: u.hasUserPassword === true,
  };
}

function loadCachedSession(portal: AuthPortal): { user: AuthUser | null; token: string | null } {
  migrateLegacySession(portal);

  const token = localStorage.getItem(tokenStorageKey(portal));
  const rawUser = localStorage.getItem(userStorageKey(portal));
  if (!rawUser) return { user: null, token };

  try {
    const user = normalizeAuthUser(JSON.parse(rawUser));
    if (!user) {
      localStorage.removeItem(userStorageKey(portal));
      return { user: null, token };
    }
    return { user, token };
  } catch {
    localStorage.removeItem(userStorageKey(portal));
    return { user: null, token };
  }
}

function persistSession(portal: AuthPortal, u: AuthUser, token: string | null) {
  localStorage.setItem(userStorageKey(portal), JSON.stringify(u));
  if (token) localStorage.setItem(tokenStorageKey(portal), token);
  else localStorage.removeItem(tokenStorageKey(portal));
}

async function fetchAuthMe(portal: AuthPortal, bearerToken: string | null): Promise<Response> {
  const headers: Record<string, string> = { ...authPortalHeaders(portal) };
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

  return fetch("/api/auth/me", {
    credentials: "include",
    headers,
  });
}

/**
 * Validate session — portal cookie first (httpOnly), then bearer token from portal localStorage.
 * Returns null only when the server definitively rejects all credentials (401).
 */
async function validateStoredSession(
  portal: AuthPortal,
  bearerToken: string | null,
  fallbackUser: AuthUser | null,
): Promise<{ user: AuthUser | null; token: string | null }> {
  const attempts: Array<string | null> = [null];
  if (bearerToken) attempts.push(bearerToken);

  for (const attemptToken of attempts) {
    for (let retry = 0; retry < SESSION_VALIDATE_RETRIES; retry++) {
      try {
        const res = await fetchAuthMe(portal, attemptToken);

        if (res.status === 401) {
          if (retry + 1 < SESSION_VALIDATE_RETRIES) {
            await sleep(SESSION_VALIDATE_RETRY_MS * (retry + 1));
            continue;
          }
          break;
        }

        if (res.ok) {
          const fresh = normalizeAuthUser(await res.json());
          if (fresh) {
            return { user: fresh, token: attemptToken };
          }
          return { user: fallbackUser, token: bearerToken };
        }

        // Server/proxy hiccup — keep cached session.
        return { user: fallbackUser, token: bearerToken };
      } catch {
        if (retry + 1 < SESSION_VALIDATE_RETRIES) {
          await sleep(SESSION_VALIDATE_RETRY_MS * (retry + 1));
          continue;
        }
        return { user: fallbackUser, token: bearerToken };
      }
    }
  }

  return { user: null, token: null };
}

let fetchPatched = false;

function isSameOriginApi(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    if (u.origin !== window.location.origin) return false;
    return u.pathname.startsWith("/api/") || u.pathname === "/api";
  } catch {
    return false;
  }
}

function installFetchInterceptor() {
  if (fetchPatched) return;
  fetchPatched = true;

  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;

    if (!isSameOriginApi(url)) return orig(input, init);

    const portal = resolveAuthPortal();
    const token = localStorage.getItem(tokenStorageKey(portal));
    const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has("X-Auth-Portal")) {
      headers.set("X-Auth-Portal", portal);
    }
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return orig(input, {
      ...init,
      headers,
      credentials: init.credentials ?? "include",
    });
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const portalRef = useRef(resolveAuthPortal());
  const cachedRef = useRef(loadCachedSession(portalRef.current));
  const [user, setUser] = useState<AuthUser | null>(() => cachedRef.current.user);
  const [token, setToken] = useState<string | null>(() => cachedRef.current.token);
  const [permissions, setPermissions] = useState<PermissionTuple[]>([]);
  const [scope, setScope] = useState<TenantScope | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const bootstrapGeneration = useRef(0);

  useEffect(() => {
    installFetchInterceptor();
    const portal = resolveAuthPortal();
    portalRef.current = portal;
    cachedRef.current = loadCachedSession(portal);
    const generation = ++bootstrapGeneration.current;
    let cancelled = false;

    void (async () => {
      const cached = cachedRef.current;
      const result = await validateStoredSession(portal, cached.token, cached.user);

      if (cancelled || generation !== bootstrapGeneration.current) return;

      if (result.user === null) {
        clearStoredSession(portal);
        setUser(null);
        setToken(null);
        setPermissions([]);
        setScope(null);
        setSessionReady(false);
      } else {
        setUser(result.user);
        setToken(result.token);
        persistSession(portal, result.user, result.token);
        setSessionReady(true);
      }
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionReady || !user) {
      setPermissions([]);
      setScope(null);
      return;
    }

    let cancelled = false;
    fetch("/api/auth/permissions", { credentials: "include" })
      .then(async r => (r.ok ? r.json() : { permissions: [], scope: null }))
      .then(data => {
        if (cancelled || !data) return;
        setPermissions(data.permissions ?? []);
        setScope(data.scope ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setPermissions([]);
          setScope(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionReady, user]);

  const login = (u: AuthUser, t: string) => {
    const portal = resolveAuthPortal();
    portalRef.current = portal;
    bootstrapGeneration.current += 1;
    cachedRef.current = { user: u, token: t };
    setUser(u);
    setToken(t);
    setSessionReady(true);
    setIsLoading(false);
    persistSession(portal, u, t);
  };

  const logout = () => {
    const portal = resolveAuthPortal();
    bootstrapGeneration.current += 1;
    cachedRef.current = { user: null, token: null };
    fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: authPortalHeaders(portal),
    }).catch(() => {});
    setUser(null);
    setToken(null);
    setPermissions([]);
    setScope(null);
    setSessionReady(false);
    clearStoredSession(portal);
  };

  const hasPermission = (resource: string, action: string) => {
    if (!user) return false;
    if (isSuperAdmin(user.role)) return true;
    return permissions.some(p => p.resource === resource && p.action === action);
  };

  return (
    <AuthContext.Provider value={{ user, token, permissions, scope, hasPermission, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function usePermission(resource: string, action: string) {
  return useAuth().hasPermission(resource, action);
}
