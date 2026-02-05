import { createBrowserRouter, Navigate } from "react-router-dom";

import MainLayout from "../layouts/MainLayout";

import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import ProductListPage from "../pages/products/ProductListPage";
import VerifyOtpPage from "../pages/auth/VerifyOtpPage";
import ResetPasswordPage from "../pages/auth/ResetPasswordPage";
import AccountRecoveryPage from "../pages/auth/AccountRecoveryPage";
import AccountRecoVerifiedPage from "../pages/auth/AccountRecoVerifiedPage";
import MyProfilePage from "../pages/profile/MyProfilePage";

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

  // Route Profile
  {
    path: "/profile",
    element: <MyProfilePage />,
  },

  // PROTECTED ROUTES (Dùng MainLayout)
  {
    path: "/",
    element: <MainLayout />, // MainLayout có <Outlet /> bên trong để render children
    children: [
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
]);
