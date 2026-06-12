import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";

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

const TOKEN_KEY = "cwp_token";
const USER_KEY = "cwp_user";

function isSuperAdmin(role?: UserRole | null) {
  return role === "admin" || role === "superadmin";
}

// Patches window.fetch once so every SAME-ORIGIN /api/* request carries the
// bearer token. We deliberately do NOT attach the token to cross-origin
// requests — that would leak credentials to third-party hosts (e.g. Google
// Maps, analytics) even if they happen to have "/api/" in their path.
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
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    if (!isSameOriginApi(url)) return orig(input, init);
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return orig(input, init);
    const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    return orig(input, { ...init, headers });
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermissionTuple[]>([]);
  const [scope, setScope] = useState<TenantScope | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hydrated = useRef(false);

  // Bootstrap once
  useEffect(() => {
    installFetchInterceptor();
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
    hydrated.current = true;
  }, []);

  // Re-fetch permissions whenever user/token changes
  useEffect(() => {
    if (!user || !token) {
      setPermissions([]);
      setScope(null);
      return;
    }
    let cancelled = false;
    fetch("/api/auth/permissions")
      .then(async r => {
        // Token revoked / expired / user deactivated → force a clean logout
        // instead of leaving a phantom session in the UI.
        if (r.status === 401) {
          if (!cancelled) {
            setUser(null);
            setToken(null);
            setPermissions([]);
            setScope(null);
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
          }
          return null;
        }
        return r.ok ? r.json() : { permissions: [], scope: null };
      })
      .then(data => {
        if (cancelled || data === null) return;
        setPermissions(data.permissions ?? []);
        setScope(data.scope ?? null);
      })
      .catch(() => { if (!cancelled) { setPermissions([]); setScope(null); } });
    return () => { cancelled = true; };
  }, [user, token]);

  const login = (u: AuthUser, t: string) => {
    setUser(u);
    setToken(t);
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
  };

  const logout = () => {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setToken(null);
    setPermissions([]);
    setScope(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
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
