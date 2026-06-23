import { Navigate, Outlet } from "react-router-dom";
import tokenStorage from "../utils/tokenStorage";
import type { UserProfile } from "../types/user";

export default function GuestGuard() {
  const token = tokenStorage.getToken();
  const user = tokenStorage.getUser<UserProfile>();

  // kiểm tra token và thông tin người dùng, nếu đã đăng nhập thì điều hướng ra khỏi trang xác thực
  if (token && user) {
    // kiểm tra nếu người dùng có bất kỳ role nào khác CUSTOMER thì cho phép vào portal
    const hasPortalAccess = user.roles.some((role) => role !== "CUSTOMER");

    if (hasPortalAccess) {
      return <Navigate to="/portal/overview" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
