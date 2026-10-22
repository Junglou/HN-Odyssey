import { Action, Resource } from "../types/permissions";
import { hasPermission, type PermissionSubject } from "./permission";

// Thứ tự ưu tiên trang đích khi vào Portal (đồng bộ với routes/index.tsx)
const PORTAL_ROUTES: Array<{ path: string; resources: string[] }> = [
  { path: "/portal/overview", resources: [Resource.DASHBOARD] },
  { path: "/portal/revenue-report", resources: [Resource.REPORT_REVENUE] },
  {
    path: "/portal/marketing-promotion",
    resources: [Resource.REPORT_MARKETING],
  },
  { path: "/portal/bi", resources: [Resource.REPORT_INVENTORY] },
  { path: "/portal/inventory", resources: [Resource.REPORT_STOCK] },
  { path: "/portal/orders", resources: [Resource.SALES_ORDERS] },
  { path: "/portal/trade-in", resources: [Resource.SALES_TRADE_IN] },
  {
    path: "/portal/warehouse",
    resources: [Resource.INVENTORY_STOCK, Resource.INVENTORY_TRANSFERS],
  },
  { path: "/portal/products", resources: [Resource.CATALOG_PRODUCTS] },
  { path: "/portal/categories", resources: [Resource.CATALOG_CATEGORIES] },
  { path: "/portal/variants", resources: [Resource.CATALOG_ATTRIBUTES] },
  { path: "/portal/prices", resources: [Resource.CATALOG_PRICING] },
  { path: "/portal/tags", resources: [Resource.CATALOG_TAGS] },
  { path: "/portal/customers", resources: [Resource.CRM_CUSTOMERS] },
  { path: "/portal/live-chat", resources: [Resource.CRM_CHAT] },
  { path: "/portal/promotion", resources: [Resource.PROMO_FLASH_SALES] },
  { path: "/portal/review-rating", resources: [Resource.CRM_REVIEWS] },
  { path: "/portal/coupon", resources: [Resource.PROMO_COUPONS] },
  { path: "/portal/users", resources: [Resource.SYSTEM_USERS] },
  { path: "/portal/roles", resources: [Resource.SYSTEM_ROLES] },
  { path: "/portal/static-pages", resources: [Resource.CONTENT_PAGES] },
  { path: "/portal/media-management", resources: [Resource.CONTENT_MEDIA] },
  { path: "/portal/banner-management", resources: [Resource.CONTENT_BANNERS] },
  { path: "/portal/blog-news", resources: [Resource.CONTENT_POSTS] },
  { path: "/portal/content-config", resources: [Resource.CONTENT_CONFIG] },
  {
    path: "/portal/system",
    resources: [Resource.SYSTEM_MONITORING, Resource.SYSTEM_AUDIT],
  },
];

/** Trang Portal đầu tiên user được phép vào; null nếu không có trang nào */
export const getFirstAllowedPortalPath = (
  user: PermissionSubject | null,
): string | null =>
  PORTAL_ROUTES.find((r) =>
    r.resources.some((res) => hasPermission(user, res, Action.READ)),
  )?.path ?? null;
