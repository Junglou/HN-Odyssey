import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import authService from "../services/auth.service";

/**
 * Bọc ngoài toàn bộ route: mỗi lần tải lại trang (F5) sẽ lấy quyền mới nhất từ server
 * TRƯỚC KHI AuthGuard / PortalLayout đọc quyền từ tokenStorage.
 */
export default function SessionBootstrap() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void authService.syncCurrentUser().finally(() => {
      if (!cancelled) setIsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isReady) return null;
  return <Outlet />;
}
