import { Navigate, Outlet, useLocation } from "react-router-dom";
import tokenStorage from "../utils/tokenStorage";
import type { UserProfile } from "../types/user";

interface AuthGuardProps {
  allowedRoles?: string[];
  requirePermissions?: string[]; // Thay thế/Bổ sung check theo mảng quyền
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

  // 1. Check quyền truy cập Portal chung (Thay thế cho việc check role !== CUSTOMER)
  if (requirePortalAccess && user.is_portal_access === false) {
    return <Navigate to="/" replace />;
  }

  // 2. Check quyền cụ thể bằng Permissions (RBAC Dynamic)
  if (requirePermissions && requirePermissions.length > 0) {
    const userPermissions = user.permissions || [];
    // Nếu user không có quyền nào nằm trong mảng yêu cầu -> đẩy ra ngoài
    const hasPermission = requirePermissions.some((perm) =>
      userPermissions.includes(perm),
    );
    if (!hasPermission) {
      // Có thể đẩy về một trang 403 Forbidden thay vì trang chủ
      return <Navigate to="/portal/overview" replace />;
    }
  }

  // 3. Giữ lại check Roles nếu hệ thống của bạn vẫn bắt buộc phải check theo chức danh ở một số màn hình
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
