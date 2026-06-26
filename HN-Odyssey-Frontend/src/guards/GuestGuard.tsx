import { Navigate, Outlet } from "react-router-dom";
import tokenStorage from "../utils/tokenStorage";
import type { UserProfile } from "../types/user";

export default function GuestGuard() {
  const token = tokenStorage.getToken();
  const user = tokenStorage.getUser<UserProfile>();

  if (token && user) {
    // Dựa vào cờ is_portal_access được trả về từ Backend thay vì fix cứng Role
    if (user.is_portal_access) {
      return <Navigate to="/portal/overview" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
