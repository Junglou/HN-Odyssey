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
import MyOrderMangementPage from "../pages/profile/OrderManagementPage";
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

import StaticPageView from "../pages/staticPage/StaticPageView";

import AuthGuard from "../guards/AuthGuard";
import GuestGuard from "../guards/GuestGuard";
import SessionBootstrap from "../guards/SessionBootstrap";
import { Resource } from "../types/permissions";

export const router = createBrowserRouter([
  {
    // Đồng bộ quyền mới nhất từ server mỗi lần tải lại trang, rồi mới render các route bên dưới
    element: <SessionBootstrap />,
    children: [
      // route auth
      {
        element: <GuestGuard />,
        children: [
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
        ],
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
            path: "products/:slug",
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
          {
            path: "checkout/success",
            element: <CheckoutPage />,
          },
          {
            path: "checkout/fail",
            element: <CheckoutPage />,
          },
          {
            path: "/pages/:slug",
            element: <StaticPageView />,
          },
          // todo: cum route profile nay can duoc boc bang auth guard de kiem tra token khi chay thuc te, hien tai de day de tien hanh thu nghiem
          {
            element: <AuthGuard />,
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
                element: <MyOrderMangementPage />,
              },
              {
                path: "/profile/orders/detail/:id",
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
        element: (
          <AuthGuard requirePortalAccess={true}>
            <PortalLayout />
          </AuthGuard>
        ),
        children: [
          {
            path: "users",
            element: (
              <AuthGuard requirePermissions={[Resource.SYSTEM_USERS]}>
                <UserManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "roles",
            element: (
              <AuthGuard requirePermissions={[Resource.SYSTEM_ROLES]}>
                <RoleManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "heatmap",
            element: (
              <AuthGuard requirePermissions={[Resource.SYSTEM_USERS]}>
                <UserBehaviorHeatmapPage />
              </AuthGuard>
            ),
          },
          {
            path: "products",
            element: (
              <AuthGuard requirePermissions={[Resource.CATALOG_PRODUCTS]}>
                <ProductManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "products/new",
            element: (
              <AuthGuard requirePermissions={[Resource.CATALOG_PRODUCTS]}>
                <ProductFormPage />
              </AuthGuard>
            ),
          },
          {
            path: "products/:id",
            element: (
              <AuthGuard requirePermissions={[Resource.CATALOG_PRODUCTS]}>
                <ProductFormPage />
              </AuthGuard>
            ),
          },
          {
            path: "products/:id/edit",
            element: (
              <AuthGuard requirePermissions={[Resource.CATALOG_PRODUCTS]}>
                <ProductFormPage />
              </AuthGuard>
            ),
          },
          {
            path: "categories",
            element: (
              <AuthGuard requirePermissions={[Resource.CATALOG_CATEGORIES]}>
                <CategoryManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "variants",
            element: (
              <AuthGuard requirePermissions={[Resource.CATALOG_ATTRIBUTES]}>
                <VariantManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "tags",
            element: (
              <AuthGuard requirePermissions={[Resource.CATALOG_TAGS]}>
                <TagManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "prices",
            element: (
              <AuthGuard requirePermissions={[Resource.CATALOG_PRICING]}>
                <PriceManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "customers",
            element: (
              <AuthGuard requirePermissions={[Resource.CRM_CUSTOMERS]}>
                <CustomerManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "live-chat",
            element: (
              <AuthGuard requirePermissions={[Resource.CRM_CHAT]}>
                <LiveChatSupportPage />
              </AuthGuard>
            ),
          },
          {
            path: "promotion",
            element: (
              <AuthGuard requirePermissions={[Resource.PROMO_FLASH_SALES]}>
                <PromotionManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "review-rating",
            element: (
              <AuthGuard requirePermissions={[Resource.CRM_REVIEWS]}>
                <ReviewAndRatingManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "coupon",
            element: (
              <AuthGuard requirePermissions={[Resource.PROMO_COUPONS]}>
                <CouponManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "static-pages",
            element: (
              <AuthGuard requirePermissions={[Resource.CONTENT_PAGES]}>
                <StaticPageManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "media-management",
            element: (
              <AuthGuard requirePermissions={[Resource.CONTENT_MEDIA]}>
                <MediaManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "banner-management",
            element: (
              <AuthGuard requirePermissions={[Resource.CONTENT_BANNERS]}>
                <BannerManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "blog-news",
            element: (
              <AuthGuard requirePermissions={[Resource.CONTENT_POSTS]}>
                <BlogNewsManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "content-config",
            element: (
              <AuthGuard requirePermissions={[Resource.CONTENT_CONFIG]}>
                <ContentConfigPage />
              </AuthGuard>
            ),
          },
          {
            path: "system",
            element: (
              <AuthGuard
                requirePermissions={[
                  Resource.SYSTEM_MONITORING,
                  Resource.SYSTEM_AUDIT,
                ]}
              >
                <SystemPage />
              </AuthGuard>
            ),
          },
          {
            path: "overview",
            element: (
              <AuthGuard requirePermissions={[Resource.DASHBOARD]}>
                <OverviewPage />
              </AuthGuard>
            ),
          },
          {
            path: "revenue-report",
            element: (
              <AuthGuard requirePermissions={[Resource.REPORT_REVENUE]}>
                <RevenueReportPage />
              </AuthGuard>
            ),
          },
          {
            path: "marketing-promotion",
            element: (
              <AuthGuard requirePermissions={[Resource.REPORT_MARKETING]}>
                <MarketingAndPromotionPage />
              </AuthGuard>
            ),
          },
          {
            path: "bi",
            element: (
              <AuthGuard requirePermissions={[Resource.REPORT_INVENTORY]}>
                <BusinessIntelligencePage />
              </AuthGuard>
            ),
          },
          {
            path: "inventory",
            element: (
              // FIX: Dùng đúng mã quyền REPORT_STOCK cho Báo Cáo Kho
              <AuthGuard requirePermissions={[Resource.REPORT_STOCK]}>
                <InventoryManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "warehouse",
            element: (
              <AuthGuard
                requirePermissions={[
                  Resource.INVENTORY_STOCK, // Vẫn là INVENTORY_STOCK cho WMS
                  Resource.INVENTORY_TRANSFERS,
                ]}
              >
                <StockManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "orders",
            element: (
              <AuthGuard requirePermissions={[Resource.SALES_ORDERS]}>
                <OrderManagementPage />
              </AuthGuard>
            ),
          },
          {
            path: "trade-in",
            element: (
              <AuthGuard requirePermissions={[Resource.SALES_TRADE_IN]}>
                <TradeInManagementPage />
              </AuthGuard>
            ),
          },
        ],
      },
    ],
  },
]);
