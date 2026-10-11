import { Navigate, Outlet, useLocation } from "react-router-dom";
import tokenStorage from "../utils/tokenStorage";
import type { UserProfile } from "../types/user";
import { hasPermission } from "../utils/permission";
import { getFirstAllowedPortalPath } from "../utils/portalRoutes";
import { Action } from "../types/permissions";

interface AuthGuardProps {
  allowedRoles?: string[];
  requirePermissions?: string[]; // Bổ sung check theo mảng quyền
  requirePortalAccess?: boolean; // Cờ yêu cầu quyền vào portal
  children?: React.ReactNode;
}

export default function AuthGuard({
  allowedRoles,
  requirePermissions,
  requirePortalAccess,
  children,
}: AuthGuardProps) {
  const token = tokenStorage.getToken();
  const user = tokenStorage.getUser<UserProfile>();
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.status !== "ACTIVE") {
    tokenStorage.clearAuth();
    return <Navigate to="/login" replace />;
  }

  // 1. Check quyền truy cập Portal chung
  if (requirePortalAccess && user.is_portal_access === false) {
    return <Navigate to="/" replace />;
  }

  // 2. Check quyền cụ thể bằng Permissions (RBAC Dynamic)
  if (requirePermissions && requirePermissions.length > 0) {
    // Vào trang phải có quyền XEM (READ hoặc MANAGE), không chỉ "có dính" resource
    const allowed = requirePermissions.some((perm) =>
      hasPermission(user, perm, Action.READ),
    );

    if (!allowed) {
      const fallback = getFirstAllowedPortalPath(user);
      // Không có trang nào hợp lệ, hoặc trang dự phòng chính là trang đang đứng → về trang chủ
      if (!fallback || fallback === location.pathname) {
        return <Navigate to="/" replace />;
      }
      return <Navigate to={fallback} replace />;
    }
  }

  // 3. Giữ lại check Roles (nếu cần)
  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return <Navigate to="/" replace />;
    }
  }

  if (children) {
    return <>{children}</>;
  }

  return <Outlet />;
}
