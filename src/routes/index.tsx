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
import AddressMangementPage from "../pages/profile/AddressManagementPage";
import OrderMangementPage from "../pages/profile/OrderManagementPage";
import OrderDetailPage from "../pages/profile/OrderDetailPage";
import PurchaseHistoryPage from "../pages/profile/PurchaseHistoryPage";
import MyWishlistPage from "../pages/profile/MyWishlistPage";

import UserManagementPage from "../pages/portal/UsersAndRoles/UserManagement/UserManagementPage";
import RoleManagementPage from "../pages/portal/UsersAndRoles/RoleManagement/RoleManagementPage";
import UserBehaviorHeatmapPage from "../pages/portal/UsersAndRoles/UserBehaviorHeatmap/UserBehaviorHeatmapPage";

import VariantManagementPage from "../pages/portal/ProductCatalog/VariantManagement/VariantManagementPage";
import ProductManagementPage from "../pages/portal/ProductCatalog/ProductManagement/ProductManagementPage";
import ProductFormPage from "../pages/portal/ProductCatalog/ProductManagement/ProductFormPage";
import CategoryManagementPage from "../pages/portal/ProductCatalog/CategoryManagement/CategoryManagementPage";
import TagManagementPage from "../pages/portal/ProductCatalog/TagManagement/TagManagementPage";
import PriceManagementPage from "../pages/portal/ProductCatalog/PriceManagement/PriceManagementPage";

import CustomerManagementPage from "../pages/portal/CustomerCRM/CustomerManagement/CustomerManagementPage";
import LiveChatSupportPage from "../pages/portal/CustomerCRM/LiveChatSupport/LiveChatSupportPage";

import PromotionManagementPage from "../pages/portal/MarketingSuite/PromotionManagement/PromotionManagementPage";
import ReviewAndRatingManagementPage from "../pages/portal/MarketingSuite/ReviewAndRatingManagement/ReviewAndRatingManagementPage";
import CouponManagementPage from "../pages/portal/MarketingSuite/CouponManagement/CouponManagementPage";

import StaticPageManagementPage from "../pages/portal/Communication/StaticPageManagement/StaticPageManagementPage";
import MediaManagementPage from "../pages/portal/Communication/MediaManagement/MediaManagementPage";
import BannerManagementPage from "../pages/portal/Communication/BannerManagement/BannerManagementPage";
import BlogNewsManagementPage from "../pages/portal/Communication/BlogNewsManagement/BlogNewsManagementPage";

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
        path: "/profile/address-management",
        element: <AddressMangementPage />,
      },
      {
        path: "/profile/orders",
        element: <OrderMangementPage />,
      },
      {
        path: "/profile/orders/detail",
        element: <OrderDetailPage />,
      },
      {
        path: "/profile/history",
        element: <PurchaseHistoryPage />,
      },
      {
        path: "/profile/wishlist",
        element: <MyWishlistPage />,
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
      {
        path: "categories",
        element: <CategoryManagementPage />,
      },
      {
        path: "variants",
        element: <VariantManagementPage />,
      },
      {
        path: "tags",
        element: <TagManagementPage />,
      },
      {
        path: "prices",
        element: <PriceManagementPage />,
      },
      {
        path: "customers",
        element: <CustomerManagementPage />,
      },
      {
        path: "live-chat",
        element: <LiveChatSupportPage />,
      },
      {
        path: "promotion",
        element: <PromotionManagementPage />,
      },
      {
        path: "review-rating",
        element: <ReviewAndRatingManagementPage />,
      },
      {
        path: "coupon",
        element: <CouponManagementPage />,
      },
      {
        path: "static-pages",
        element: <StaticPageManagementPage />,
      },
      {
        path: "media-management",
        element: <MediaManagementPage />,
      },
      {
        path: "banner-management",
        element: <BannerManagementPage />,
      },
      {
        path: "blog-news",
        element: <BlogNewsManagementPage />,
      },
    ],
  },
]);
