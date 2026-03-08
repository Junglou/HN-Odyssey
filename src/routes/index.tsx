import { createBrowserRouter, Navigate } from "react-router-dom";

import MainLayout from "../layouts/MainLayout";
import PortalLayout from "../layouts/PortalLayout";

import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import ProductListPage from "../pages/products/ProductListPage";
import VerifyOtpPage from "../pages/auth/VerifyOtpPage";
import ResetPasswordPage from "../pages/auth/ResetPasswordPage";
import AccountRecoveryPage from "../pages/auth/AccountRecoveryPage";
import AccountRecoVerifiedPage from "../pages/auth/AccountRecoVerifiedPage";
import MyProfilePage from "../pages/profile/MyProfilePage";

import UserManagement from "../pages/portal/UserManagementPage";

// Ghi nhớ để sau này: Trong dự án lớn có thể dùng React.lazy() để tối ưu performance

export const router = createBrowserRouter([
  // Route Auth
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/verify-otp",
    element: <VerifyOtpPage />,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    path: "/account-recovery",
    element: <AccountRecoveryPage />,
  },
  {
    path: "/account-reco-verified",
    element: <AccountRecoVerifiedPage />,
  },

  // PROTECTED ROUTES (Dùng MainLayout)
  {
    path: "/",
    element: <MainLayout />, // MainLayout có <Outlet /> bên trong để render children
    children: [
      // Route Profile
      {
        path: "/profile",
        element: <MyProfilePage />,
      },
      {
        index: true, // Route mặc định của path: "/"
        element: <Navigate to="/login" replace />, // Redirect về login
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "products",
        element: <ProductListPage />,
      },
    ],
  },

  // Lỗi 404 - Redirect về trang login
  {
    path: "*",
    element: <Navigate to="/login" replace />,
  },

  // PROTECTED ROUTES (Dùng PortalLayout) - Dành cho admin/manager
  {
    path: "/portal",
    element: <PortalLayout />,
    children: [
      {
        path: "users", // Đường dẫn sẽ là: /portal/users
        element: <UserManagement />,
      },
      // Các trang portal khác sau này sẽ thêm tiếp vào đây
    ],
  },
]);
