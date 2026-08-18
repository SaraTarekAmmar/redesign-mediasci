import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { loginUrl } from "../../lib/api";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
  permissions?: string[];
  allowExternal?: boolean;
  fallback?: string;
}

export function ProtectedRoute({ children, roles, permissions, allowExternal = false, fallback = "/" }: ProtectedRouteProps) {
  const { user, hasRole, hasPermission } = useAuth();
  const externalUser = hasRole("partner", "client");

  if (!user) {
    window.location.assign(loginUrl);
    return null;
  }

  if (externalUser && !allowExternal) {
    return <Navigate to={fallback} replace />;
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return <Navigate to={fallback} replace />;
  }

  if (permissions && permissions.length > 0 && !(externalUser && allowExternal)) {
    if (!permissions.some((permission) => hasPermission(permission))) {
      return <Navigate to={fallback} replace />;
    }
  }

  return <>{children}</>;
}
