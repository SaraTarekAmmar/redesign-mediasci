import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { loginUrl } from "../../lib/api";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
  permissions?: string[];
  fallback?: string;
}

export function ProtectedRoute({ children, roles, permissions, fallback = "/" }: ProtectedRouteProps) {
  const { user, hasRole, hasPermission } = useAuth();

  if (!user) {
    window.location.assign(loginUrl);
    return null;
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return <Navigate to={fallback} replace />;
  }

  if (permissions && permissions.length > 0) {
    if (!permissions.some((permission) => hasPermission(permission))) {
      return <Navigate to={fallback} replace />;
    }
  }

  return <>{children}</>;
}
