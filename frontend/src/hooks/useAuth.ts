import { useState, useCallback, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  hasPermission: (permission: string) => boolean;
  hasRole: (...roles: string[]) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isPM: boolean;
  isTeamLeader: boolean;
  isDeveloper: boolean;
  isMember: boolean;
  isViewer: boolean;
  isAccountManager: boolean;
  isDepartmentManager: boolean;
  isHrManager: boolean;
  isReviewer: boolean;
  isExecutive: boolean;
  isPartner: boolean;
  isClient: boolean;
}

const normalizeRole = (role?: string | null) =>
  (role ?? "member")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

const normalizePermission = (permission: string) => permission.trim().toLowerCase();

/**
 * Read the current user from the bootstrap payload that was loaded at boot time.
 * The SPA fetches /spa/bootstrap before mounting and stores the response in
 * window.__DATA__. This hook reads the `user` field from that payload.
 *
 * ```tsx
 * const { user, hasPermission, isAdmin, isPM } = useAuth();
 * if (hasPermission('manage-users')) { ... }
 * if (isAdmin) { ... }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const data = (window as any).__DATA__;

  const user = useMemo<AuthUser | null>(() => {
    if (!data?.user) return null;
    const permissions = Array.isArray(data.user.permissions) ? data.user.permissions : [];
    const role = normalizeRole(data.user.role);
    const fallbackByRole: Record<string, string[]> = {
      "super-admin": [
        "view-users",
        "manage-users",
        "view-departments",
        "manage-departments",
        "view-teams",
        "manage-teams",
        "view-resources",
        "allocate-resources",
        "manage-project-members",
        "manage-skills",
      ],
      admin: [
        "view-users",
        "manage-users",
        "view-departments",
        "manage-departments",
        "view-teams",
        "manage-teams",
        "view-resources",
        "allocate-resources",
        "manage-project-members",
        "manage-skills",
      ],
      "project-manager": [
        "view-departments",
        "manage-departments",
        "view-teams",
        "manage-teams",
        "view-resources",
        "allocate-resources",
        "manage-project-members",
        "manage-skills",
      ],
      "team-leader": [
        "view-departments",
        "view-teams",
        "manage-teams",
        "view-resources",
        "allocate-resources",
        "manage-project-members",
        "manage-skills",
      ],
      "department-manager": [
        "view-departments",
        "manage-departments",
        "view-teams",
        "manage-teams",
        "view-resources",
        "allocate-resources",
      ],
      "hr-manager": [
        "view-users",
        "manage-users",
      ],
    };
    return {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role,
      permissions: Array.from(new Set([
        ...permissions.map((permission: string) => normalizePermission(permission)),
        ...(fallbackByRole[role] ?? []),
      ])),
    };
  }, [data?.user]);

  const loading = false; // bootstrap already resolved before mount
  const error = user ? null : "No user in bootstrap payload";

  const hasPermission = useCallback(
    (permission: string) => {
      if (user?.role === "super-admin") return true;
      return user?.permissions?.includes(normalizePermission(permission)) ?? false;
    },
    [user]
  );

  const hasRole = useCallback(
    (...roles: string[]) =>
      user?.role ? roles.map((role) => normalizeRole(role)).includes(user.role) : false,
    [user]
  );

  return {
    user,
    loading,
    error,
    hasPermission,
    hasRole,
    isSuperAdmin: hasRole("super-admin"),
    isAdmin: hasRole("super-admin", "admin"),
    isPM: hasRole("project-manager"),
    isTeamLeader: hasRole("team-leader"),
    isDeveloper: hasRole("developer"),
    isMember: hasRole("member"),
    isViewer: hasRole("viewer"),
    isAccountManager: hasRole("account-manager"),
    isDepartmentManager: hasRole("department-manager"),
    isHrManager: hasRole("hr-manager"),
    isReviewer: hasRole("reviewer"),
    isExecutive: hasRole("executive"),
    isPartner: hasRole("partner"),
    isClient: hasRole("client"),
  };
}
