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

import UserManagementPage from "../pages/portal/UsersAndRoles/UserManagement/UserManagementPage";
import RoleManagementPage from "../pages/portal/UsersAndRoles/RoleManagement/RoleManagementPage";
import UserBehaviorHeatmapPage from "../pages/portal/UsersAndRoles/UserBehaviorHeatmap/UserBehaviorHeatmapPage";

// import trang quản lý sản phẩm
import ProductManagementPage from "../pages/portal/ProductCatalog/ProductManagement/ProductManagementPage";
// import trang form thêm/sửa sản phẩm
import ProductFormPage from "../pages/portal/ProductCatalog/ProductManagement/ProductFormPage";

// ghi nhớ để sau này: trong dự án lớn có thể dùng react.lazy() để tối ưu performance

export const router = createBrowserRouter([
  // route auth
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

  // route bảo vệ dùng main layout
  {
    path: "/",
    element: <MainLayout />,
    children: [
      {
        path: "/profile",
        element: <MyProfilePage />,
      },
      {
        index: true,
        element: <Navigate to="/login" replace />,
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

  // lỗi 404
  {
    path: "*",
    element: <Navigate to="/login" replace />,
  },

  // route bảo vệ dùng portal layout cho admin
  {
    path: "/portal",
    element: <PortalLayout />,
    children: [
      {
        path: "users",
        element: <UserManagementPage />,
      },
      {
        path: "roles",
        element: <RoleManagementPage />,
      },
      {
        path: "heatmap",
        element: <UserBehaviorHeatmapPage />,
      },
      {
        path: "products",
        element: <ProductManagementPage />,
      },
      {
        path: "products/new",
        element: <ProductFormPage />,
      },
      {
        path: "products/:id",
        element: <ProductFormPage />,
      },
      {
        path: "products/:id/edit",
        element: <ProductFormPage />,
      },
    ],
  },
]);
