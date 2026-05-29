import { createBrowserRouter, Navigate } from "react-router-dom";

import MainLayout from "../layouts/MainLayout";
import PortalLayout from "../layouts/PortalLayout";

import HomePage from "../pages/home/HomePage";
import LoyaltyLandingPage from "../pages/loytalty/LoyaltyLandingPage";
import SecondCharmPage from "../pages/secondCharm/SecondCharmPage";
import BlogNewsPage from "../pages/blogNews/BlogNewsPage";
import ProductListPage from "../pages/products/ProductListPage";
import ProductDetailPage from "../pages/productDetail/ProductDetailPage";
import CheckoutPage from "../pages/checkout/CheckoutPage";
import ShoppingCartPage from "../pages/shoppingCart/ShoppingCartPage";

import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
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
import LoyaltyPage from "../pages/profile/LoyaltyPage";
import MyCouponPage from "../pages/profile/MyCouponPage";
import RecentViewPage from "../pages/profile/RecentViewPage";

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
import ContentConfigPage from "../pages/portal/Communication/ContentConfig/ContentConfigPage";

import SystemPage from "../pages/portal/System/SystemPage";

import OverviewPage from "../pages/portal/Dashboard/Overview/OverviewPage";
import RevenueReportPage from "../pages/portal/Dashboard/RevenueReport/RevenueReportPage";
import MarketingAndPromotionPage from "../pages/portal/Dashboard/MarketingAndPromotion/MarketingAndPromotionPage";
import BusinessIntelligencePage from "../pages/portal/Dashboard/BusinessIntelligence/BusinessIntelligencePage";
import InventoryManagementPage from "../pages/portal/Dashboard/InventoryManagement/InventoryManagementPage";

import StockManagementPage from "../pages/portal/Warehouse/StockManagementPage";

import OrderManagementPage from "../pages/portal/OrderManagement/OrderManagement/OrderManagementPage";
import TradeInManagementPage from "../pages/portal/OrderManagement/TradeInManagement/TradeInManagementPage";
import BlogDetailPage from "../pages/blogNews/BlogDetailPage";

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
        index: true,
        element: <HomePage />,
      },
      {
        path: "products",
        element: <ProductListPage />,
      },
      {
        path: "products/:id",
        element: <ProductDetailPage />,
      },
      {
        path: "/loyalty",
        element: <LoyaltyLandingPage />,
      },
      {
        path: "/second-charm-form",
        element: <SecondCharmPage />,
      },
      {
        path: "blog",
        element: <BlogNewsPage />,
      },
      {
        path: "blog/:slug",
        element: <BlogDetailPage />,
      },
      {
        path: "cart",
        element: <ShoppingCartPage />,
      },
      {
        path: "checkout",
        element: <CheckoutPage />,
      },
      // todo: cum route profile nay can duoc boc bang auth guard de kiem tra token khi chay thuc te, hien tai de day de tien hanh thu nghiem
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
        path: "/profile/recent",
        element: <RecentViewPage />,
      },
      {
        path: "/profile/coupon",
        element: <MyCouponPage />,
      },
      {
        path: "/profile/loyalty",
        element: <LoyaltyPage />,
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
      {
        path: "content-config",
        element: <ContentConfigPage />,
      },
      {
        path: "system",
        element: <SystemPage />,
      },
      {
        path: "overview",
        element: <OverviewPage />,
      },
      {
        path: "revenue-report",
        element: <RevenueReportPage />,
      },
      {
        path: "marketing-promotion",
        element: <MarketingAndPromotionPage />,
      },
      {
        path: "bi",
        element: <BusinessIntelligencePage />,
      },
      {
        path: "inventory",
        element: <InventoryManagementPage />,
      },
      {
        path: "warehouse",
        element: <StockManagementPage />,
      },
      {
        path: "orders",
        element: <OrderManagementPage />,
      },
      {
        path: "trade-in",
        element: <TradeInManagementPage />,
      },
    ],
  },
]);
