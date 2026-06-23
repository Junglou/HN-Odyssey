import { Navigate, Outlet, useLocation } from "react-router-dom";
import tokenStorage from "../utils/tokenStorage";
import type { UserProfile } from "../types/user";

interface AuthGuardProps {
  allowedRoles?: string[];
  excludedRoles?: string[];
  children?: React.ReactNode;
}

export default function AuthGuard({
  allowedRoles,
  excludedRoles,
  children,
}: AuthGuardProps) {
  const token = tokenStorage.getToken();
  const user = tokenStorage.getUser<UserProfile>();
  const location = useLocation();

  // kiểm tra nếu người dùng chưa đăng nhập thì điều hướng về trang đăng nhập kèm theo vị trí hiện tại
  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // kiểm tra trạng thái hoạt động của tài khoản
  if (user.status !== "ACTIVE") {
    tokenStorage.clearAuth();
    return <Navigate to="/login" replace />;
  }

  // kiểm tra quyền truy cập dựa trên danh sách role bị loại trừ (nếu có)
  if (excludedRoles && excludedRoles.length > 0) {
    const hasValidRole = user.roles.some(
      (role) => !excludedRoles.includes(role),
    );
    if (!hasValidRole) {
      return <Navigate to="/" replace />;
    }
  }

  // kiểm tra quyền truy cập nếu route có yêu cầu danh sách role cụ thể được phép
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
