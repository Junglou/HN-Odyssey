import { useState, useEffect, useRef, useCallback } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import "./PortalLayout.css";
import "./PortalLayout.notifications.css";
import {
  usePortalNotifications,
  type PortalNotification,
} from "../hooks/portal/usePortalNotifications";
import type { UserProfile } from "../types/user";
import { Action, Resource } from "../types/permissions";
import { hasPermission as checkPermission } from "../utils/permission";

// Icons
import {
  DashboardIcon,
  CatalogIcon,
  OrderIcon,
  WarehouseIcon,
  CRMIcon,
  MarketingIcon,
  UsersRolesIcon,
  CommunicationIcon,
  SystemIcon,
  LogoutIcon,
  HamburgerIcon,
  ChevronIcon,
  BellIcon,
} from "../assets/icons/PortalIcons";
import { getCurrentUser } from "../utils/permission";

const getRelativeTime = (dateString: string) => {
  const diffInSeconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000,
  );
  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${Math.floor(diffInHours / 24)}d ago`;
};

const PRIORITY_LABEL: Record<PortalNotification["priority"], string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "ORDER":
      return <OrderIcon />;
    case "STOCK":
      return <WarehouseIcon />;
    case "SYSTEM":
    case "SECURITY":
      return <SystemIcon />;
    case "SUPPORT":
      return <CRMIcon />;
    case "REVIEW":
    case "LOYALTY":
    case "PROMOTION":
      return <MarketingIcon />;
    default:
      return <BellIcon />;
  }
};

const PortalLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const user = getCurrentUser<UserProfile>();
  const hasPermission = (resource: string) =>
    checkPermission(user, resource, Action.READ);

  // Gom nhóm quyền để quyết định hiển thị Group Menu lớn
  const canSeeDashboard =
    hasPermission(Resource.DASHBOARD) ||
    hasPermission(Resource.REPORT_REVENUE) ||
    hasPermission(Resource.REPORT_MARKETING) ||
    hasPermission(Resource.REPORT_INVENTORY) ||
    hasPermission(Resource.REPORT_STOCK); // <-- FIX: Tách khóa hiển thị Dashboard

  const canSeeCatalog =
    hasPermission(Resource.CATALOG_PRODUCTS) ||
    hasPermission(Resource.CATALOG_CATEGORIES) ||
    hasPermission(Resource.CATALOG_ATTRIBUTES) ||
    hasPermission(Resource.CATALOG_PRICING) ||
    hasPermission(Resource.CATALOG_TAGS);

  const canSeeOrders =
    hasPermission(Resource.SALES_ORDERS) ||
    hasPermission(Resource.SALES_TRADE_IN);

  const canSeeWMS =
    hasPermission(Resource.INVENTORY_STOCK) || // <-- INVENTORY_STOCK CHỈ HIỂN THỊ WAREHOUSE
    hasPermission(Resource.INVENTORY_TRANSFERS);

  const canSeeCRM =
    hasPermission(Resource.CRM_CUSTOMERS) || hasPermission(Resource.CRM_CHAT);

  const canSeeMarketing =
    hasPermission(Resource.PROMO_FLASH_SALES) ||
    hasPermission(Resource.CRM_REVIEWS) ||
    hasPermission(Resource.PROMO_COUPONS);

  const canSeeUsers =
    hasPermission(Resource.SYSTEM_USERS) ||
    hasPermission(Resource.SYSTEM_ROLES);

  const canSeeCommunication =
    hasPermission(Resource.CONTENT_PAGES) ||
    hasPermission(Resource.CONTENT_MEDIA) ||
    hasPermission(Resource.CONTENT_BANNERS) ||
    hasPermission(Resource.CONTENT_POSTS) ||
    hasPermission(Resource.CONTENT_CONFIG);

  // Trang System gồm giám sát hệ thống (SYSTEM_MONITORING) và Audit Logs (SYSTEM_AUDIT)
  const canSeeSystem =
    hasPermission(Resource.SYSTEM_MONITORING) ||
    hasPermission(Resource.SYSTEM_AUDIT);

  // Menu States
  const {
    notifications,
    unreadCount,
    markAsReadAndNavigate,
    markAllAsRead,
    hasMore,
    isLoading,
    loadMore,
    filter: notiFilter,
    changeFilter: changeNotiFilter,
  } = usePortalNotifications();

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 10) {
      if (hasMore && !isLoading) {
        loadMore();
      }
    }
  };

  const [isUsersRolesOpen, setIsUsersRolesOpen] = useState(false);
  const [isProductCatalogOpen, setIsProductCatalogOpen] = useState(false);
  const [isCustomerCRMOpen, setIsCustomerCRMOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMarketingSuiteOpen, setIsMarketingSuiteOpen] = useState(false);
  const [isCommunicationOpen, setIsCommunicationOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isWarehouseOpen, setIsWarehouseOpen] = useState(false);
  const [isOrderManagementOpen, setIsOrderManagementOpen] = useState(false);
  const [isNotiOpen, setIsNotiOpen] = useState(false);

  // Ripple Effect Component
  const RippleSidebarBackground = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const lastPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
      const parent = containerRef.current?.closest(
        ".portal-sidebar",
      ) as HTMLElement;
      if (!parent) return;

      const handleMouseMove = (e: MouseEvent) => {
        const rect = parent.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top + parent.scrollTop;
        const dx = x - lastPos.current.x;
        const dy = y - lastPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 15) return;
        lastPos.current = { x, y };

        const ripple = document.createElement("div");
        ripple.className = "water-ripple-particle";
        const size = 60 + Math.random() * 20;

        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;

        containerRef.current?.appendChild(ripple);

        setTimeout(() => {
          if (ripple && ripple.parentNode) {
            ripple.parentNode.removeChild(ripple);
          }
        }, 2000);
      };

      parent.addEventListener("mousemove", handleMouseMove);
      return () => parent.removeEventListener("mousemove", handleMouseMove);
    }, []);

    return <div className="ripple-surface-wrapper" ref={containerRef}></div>;
  };

  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname],
  );

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsMobileSidebarOpen(false);
  };

  const isParentActive = useCallback(
    (basePath: string) => location.pathname.includes(basePath),
    [location.pathname],
  );

  useEffect(() => {
    if (
      isParentActive("/portal/overview") ||
      isParentActive("/portal/revenue-report") ||
      isParentActive("/portal/marketing-promotion") ||
      isParentActive("/portal/bi") ||
      isParentActive("/portal/inventory")
    ) {
      setIsDashboardOpen(true);
    }
    if (
      isParentActive("/portal/products") ||
      isParentActive("/portal/categories") ||
      isParentActive("/portal/variants") ||
      isParentActive("/portal/prices") ||
      isParentActive("/portal/tags")
    ) {
      setIsProductCatalogOpen(true);
    }
    if (
      isParentActive("/portal/orders") ||
      isParentActive("/portal/trade-in")
    ) {
      setIsOrderManagementOpen(true);
    }
    if (isParentActive("/portal/warehouse")) {
      setIsWarehouseOpen(true);
    }
    if (
      isParentActive("/portal/customers") ||
      isParentActive("/portal/live-chat")
    ) {
      setIsCustomerCRMOpen(true);
    }
    if (
      isParentActive("/portal/promotion") ||
      isParentActive("/portal/review-rating") ||
      isParentActive("/portal/coupon")
    ) {
      setIsMarketingSuiteOpen(true);
    }
    if (
      isParentActive("/portal/users") ||
      isParentActive("/portal/roles") ||
      isParentActive("/portal/heatmap")
    ) {
      setIsUsersRolesOpen(true);
    }
    if (
      isParentActive("/portal/static-pages") ||
      isParentActive("/portal/media-management") ||
      isParentActive("/portal/banner-management") ||
      isParentActive("/portal/blog-news") ||
      isParentActive("/portal/content-config")
    ) {
      setIsCommunicationOpen(true);
    }
  }, [location.pathname, isParentActive]);

  return (
    <div className="portal-container">
      <button
        className="portal-mobile-menu-toggle"
        onClick={() => setIsMobileSidebarOpen(true)}
      >
        <HamburgerIcon />
      </button>

      <div
        className={`portal-backdrop ${isMobileSidebarOpen ? "open" : ""}`}
        onClick={() => setIsMobileSidebarOpen(false)}
      ></div>

      <aside className={`portal-sidebar ${isMobileSidebarOpen ? "open" : ""}`}>
        <RippleSidebarBackground />
        <div className="portal-brand">H&N-Portal</div>

        <nav className="sidebar-menu">
          {/* Dashboard */}
          {canSeeDashboard && (
            <div className="menu-group">
              <div
                className={`menu-item ${
                  isParentActive("/portal/overview") ||
                  isParentActive("/portal/revenue-report") ||
                  isParentActive("/portal/marketing-promotion") ||
                  isParentActive("/portal/bi") ||
                  isParentActive("/portal/inventory")
                    ? "active-parent"
                    : ""
                }`}
                onClick={() => setIsDashboardOpen(!isDashboardOpen)}
              >
                <div className="menu-item-left">
                  <DashboardIcon /> Dashboard
                </div>
                <ChevronIcon open={isDashboardOpen} />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateRows: isDashboardOpen ? "1fr" : "0fr",
                  transition:
                    "grid-template-rows 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
                  overflow: "hidden",
                }}
              >
                <div className="submenu" style={{ minHeight: 0 }}>
                  {hasPermission(Resource.DASHBOARD) && (
                    <div
                      className={`submenu-item ${isActive("/portal/overview") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/overview")}
                    >
                      Overview
                    </div>
                  )}
                  {hasPermission(Resource.REPORT_REVENUE) && (
                    <div
                      className={`submenu-item ${isActive("/portal/revenue-report") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/revenue-report")}
                    >
                      Revenue Report
                    </div>
                  )}
                  {hasPermission(Resource.REPORT_MARKETING) && (
                    <div
                      className={`submenu-item ${isActive("/portal/marketing-promotion") ? "active" : ""}`}
                      onClick={() =>
                        handleNavigate("/portal/marketing-promotion")
                      }
                    >
                      Marketing & Promotion
                    </div>
                  )}
                  {hasPermission(Resource.REPORT_INVENTORY) && (
                    <div
                      className={`submenu-item ${isActive("/portal/bi") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/bi")}
                    >
                      Business Intelligence (BI)
                    </div>
                  )}
                  {/* FIX: Sử dụng đúng quyền REPORT_STOCK */}
                  {hasPermission(Resource.REPORT_STOCK) && (
                    <div
                      className={`submenu-item ${isActive("/portal/inventory") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/inventory")}
                    >
                      Inventory Management
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Product Catalog */}
          {canSeeCatalog && (
            <div className="menu-group">
              <div
                className={`menu-item ${
                  isParentActive("/portal/products") ||
                  isParentActive("/portal/categories") ||
                  isParentActive("/portal/variants") ||
                  isParentActive("/portal/prices") ||
                  isParentActive("/portal/tags")
                    ? "active-parent"
                    : ""
                }`}
                onClick={() => setIsProductCatalogOpen(!isProductCatalogOpen)}
              >
                <div className="menu-item-left">
                  <CatalogIcon /> Product Catalog
                </div>
                <ChevronIcon open={isProductCatalogOpen} />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateRows: isProductCatalogOpen ? "1fr" : "0fr",
                  transition:
                    "grid-template-rows 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
                  overflow: "hidden",
                }}
              >
                <div className="submenu" style={{ minHeight: 0 }}>
                  {hasPermission(Resource.CATALOG_PRODUCTS) && (
                    <div
                      className={`submenu-item ${isActive("/portal/products") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/products")}
                    >
                      Product Management
                    </div>
                  )}
                  {hasPermission(Resource.CATALOG_CATEGORIES) && (
                    <div
                      className={`submenu-item ${isActive("/portal/categories") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/categories")}
                    >
                      Category Management
                    </div>
                  )}
                  {hasPermission(Resource.CATALOG_ATTRIBUTES) && (
                    <div
                      className={`submenu-item ${isActive("/portal/variants") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/variants")}
                    >
                      Variant Management
                    </div>
                  )}
                  {hasPermission(Resource.CATALOG_PRICING) && (
                    <div
                      className={`submenu-item ${isActive("/portal/prices") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/prices")}
                    >
                      Price Management
                    </div>
                  )}
                  {hasPermission(Resource.CATALOG_TAGS) && (
                    <div
                      className={`submenu-item ${isActive("/portal/tags") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/tags")}
                    >
                      Tag Management
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Order Management */}
          {canSeeOrders && (
            <div className="menu-group">
              <div
                className={`menu-item ${
                  isParentActive("/portal/orders") ||
                  isParentActive("/portal/trade-in")
                    ? "active-parent"
                    : ""
                }`}
                onClick={() => setIsOrderManagementOpen(!isOrderManagementOpen)}
              >
                <div className="menu-item-left">
                  <OrderIcon /> Order Management
                </div>
                <ChevronIcon open={isOrderManagementOpen} />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateRows: isOrderManagementOpen ? "1fr" : "0fr",
                  transition:
                    "grid-template-rows 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
                  overflow: "hidden",
                }}
              >
                <div className="submenu" style={{ minHeight: 0 }}>
                  {hasPermission(Resource.SALES_ORDERS) && (
                    <div
                      className={`submenu-item ${isActive("/portal/orders") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/orders")}
                    >
                      Order Management
                    </div>
                  )}
                  {hasPermission(Resource.SALES_TRADE_IN) && (
                    <div
                      className={`submenu-item ${isActive("/portal/trade-in") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/trade-in")}
                    >
                      Trade-in Management
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Warehouse (WMS) */}
          {canSeeWMS && (
            <div className="menu-group">
              <div
                className={`menu-item ${isParentActive("/portal/warehouse") ? "active-parent" : ""}`}
                onClick={() => setIsWarehouseOpen(!isWarehouseOpen)}
              >
                <div className="menu-item-left">
                  <WarehouseIcon /> Warehouse (WMS)
                </div>
                <ChevronIcon open={isWarehouseOpen} />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateRows: isWarehouseOpen ? "1fr" : "0fr",
                  transition:
                    "grid-template-rows 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
                  overflow: "hidden",
                }}
              >
                <div className="submenu" style={{ minHeight: 0 }}>
                  {(hasPermission(Resource.INVENTORY_STOCK) ||
                    hasPermission(Resource.INVENTORY_TRANSFERS)) && (
                    <div
                      className={`submenu-item ${isActive("/portal/warehouse") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/warehouse")}
                    >
                      Stock Management
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Customer CRM */}
          {canSeeCRM && (
            <div className="menu-group">
              <div
                className={`menu-item ${
                  isParentActive("/portal/customers") ||
                  isParentActive("/portal/live-chat")
                    ? "active-parent"
                    : ""
                }`}
                onClick={() => setIsCustomerCRMOpen(!isCustomerCRMOpen)}
              >
                <div className="menu-item-left">
                  <CRMIcon /> Customer CRM
                </div>
                <ChevronIcon open={isCustomerCRMOpen} />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateRows: isCustomerCRMOpen ? "1fr" : "0fr",
                  transition:
                    "grid-template-rows 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
                  overflow: "hidden",
                }}
              >
                <div className="submenu" style={{ minHeight: 0 }}>
                  {hasPermission(Resource.CRM_CUSTOMERS) && (
                    <div
                      className={`submenu-item ${isActive("/portal/customers") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/customers")}
                    >
                      Customer Management
                    </div>
                  )}
                  {hasPermission(Resource.CRM_CHAT) && (
                    <div
                      className={`submenu-item ${isActive("/portal/live-chat") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/live-chat")}
                    >
                      Live Chat Support
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Marketing Suite */}
          {canSeeMarketing && (
            <div className="menu-group">
              <div
                className={`menu-item ${
                  isParentActive("/portal/promotion") ||
                  isParentActive("/portal/review-rating") ||
                  isParentActive("/portal/coupon")
                    ? "active-parent"
                    : ""
                }`}
                onClick={() => setIsMarketingSuiteOpen(!isMarketingSuiteOpen)}
              >
                <div className="menu-item-left">
                  <MarketingIcon /> Marketing Suite
                </div>
                <ChevronIcon open={isMarketingSuiteOpen} />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateRows: isMarketingSuiteOpen ? "1fr" : "0fr",
                  transition:
                    "grid-template-rows 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
                  overflow: "hidden",
                }}
              >
                <div className="submenu" style={{ minHeight: 0 }}>
                  {hasPermission(Resource.PROMO_FLASH_SALES) && (
                    <div
                      className={`submenu-item ${isActive("/portal/promotion") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/promotion")}
                    >
                      Promotion Management
                    </div>
                  )}
                  {hasPermission(Resource.CRM_REVIEWS) && (
                    <div
                      className={`submenu-item ${isActive("/portal/review-rating") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/review-rating")}
                    >
                      Review & Rating Management
                    </div>
                  )}
                  {hasPermission(Resource.PROMO_COUPONS) && (
                    <div
                      className={`submenu-item ${isActive("/portal/coupon") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/coupon")}
                    >
                      Coupon Management
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Users & Roles */}
          {canSeeUsers && (
            <div className="menu-group">
              <div
                className={`menu-item ${
                  isParentActive("/portal/user") ||
                  isParentActive("/portal/role") ||
                  isParentActive("/portal/heatmap")
                    ? "active-parent"
                    : ""
                }`}
                onClick={() => setIsUsersRolesOpen(!isUsersRolesOpen)}
              >
                <div className="menu-item-left">
                  <UsersRolesIcon /> Users & Roles
                </div>
                <ChevronIcon open={isUsersRolesOpen} />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateRows: isUsersRolesOpen ? "1fr" : "0fr",
                  transition:
                    "grid-template-rows 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
                  overflow: "hidden",
                }}
              >
                <div className="submenu" style={{ minHeight: 0 }}>
                  {hasPermission(Resource.SYSTEM_USERS) && (
                    <div
                      className={`submenu-item ${isActive("/portal/users") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/users")}
                    >
                      User Management
                    </div>
                  )}
                  {hasPermission(Resource.SYSTEM_ROLES) && (
                    <div
                      className={`submenu-item ${isActive("/portal/roles") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/roles")}
                    >
                      Role Management
                    </div>
                  )}
                  {hasPermission(Resource.SYSTEM_USERS) && (
                    <div
                      className={`submenu-item ${isActive("/portal/heatmap") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/heatmap")}
                    >
                      User Behavior Heatmap
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Communication */}
          {canSeeCommunication && (
            <div className="menu-group">
              <div
                className={`menu-item ${
                  isParentActive("/portal/static-pages") ||
                  isParentActive("/portal/media-management") ||
                  isParentActive("/portal/banner-management") ||
                  isParentActive("/portal/blog-news") ||
                  isParentActive("/portal/content-config")
                    ? "active-parent"
                    : ""
                }`}
                onClick={() => setIsCommunicationOpen(!isCommunicationOpen)}
              >
                <div className="menu-item-left">
                  <CommunicationIcon /> Communication
                </div>
                <ChevronIcon open={isCommunicationOpen} />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateRows: isCommunicationOpen ? "1fr" : "0fr",
                  transition:
                    "grid-template-rows 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
                  overflow: "hidden",
                }}
              >
                <div className="submenu" style={{ minHeight: 0 }}>
                  {hasPermission(Resource.CONTENT_PAGES) && (
                    <div
                      className={`submenu-item ${isActive("/portal/static-pages") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/static-pages")}
                    >
                      Static Page Management
                    </div>
                  )}
                  {hasPermission(Resource.CONTENT_MEDIA) && (
                    <div
                      className={`submenu-item ${isActive("/portal/media-management") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/media-management")}
                    >
                      Media Management
                    </div>
                  )}
                  {hasPermission(Resource.CONTENT_BANNERS) && (
                    <div
                      className={`submenu-item ${isActive("/portal/banner-management") ? "active" : ""}`}
                      onClick={() =>
                        handleNavigate("/portal/banner-management")
                      }
                    >
                      Banner Management
                    </div>
                  )}
                  {hasPermission(Resource.CONTENT_POSTS) && (
                    <div
                      className={`submenu-item ${isActive("/portal/blog-news") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/blog-news")}
                    >
                      Blog&News Management
                    </div>
                  )}
                  {hasPermission(Resource.CONTENT_CONFIG) && (
                    <div
                      className={`submenu-item ${isActive("/portal/content-config") ? "active" : ""}`}
                      onClick={() => handleNavigate("/portal/content-config")}
                    >
                      Content Config
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* System */}
          {canSeeSystem && (
            <div
              className={`menu-item ${isActive("/portal/system") ? "active-parent" : ""}`}
              onClick={() => handleNavigate("/portal/system")}
            >
              <div className="menu-item-left">
                <SystemIcon /> System
              </div>
            </div>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="notification-btn" onClick={() => setIsNotiOpen(true)}>
            <div className="menu-item-left">
              <BellIcon /> Notifications
            </div>
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
          </div>

          <div className="sidebar-divider"></div>

          <div className="logout-btn" onClick={() => navigate("/profile")}>
            <LogoutIcon /> Exit Portal
          </div>
        </div>
      </aside>

      {/* Drawer Thông Báo */}
      <div
        className={`p-noti-overlay ${isNotiOpen ? "open" : ""}`}
        onClick={() => setIsNotiOpen(false)}
      ></div>
      <div className={`p-noti-drawer ${isNotiOpen ? "open" : ""}`}>
        <div className="p-noti-header">
          <h3 className="p-noti-title">Notifications Center</h3>
          <button className="p-noti-close" onClick={() => setIsNotiOpen(false)}>
            ✕
          </button>
        </div>

        <div className="p-noti-toolbar">
          <div className="p-noti-tabs">
            <button
              type="button"
              className={`p-noti-tab ${notiFilter === "all" ? "active" : ""}`}
              onClick={() => changeNotiFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`p-noti-tab ${notiFilter === "unread" ? "active" : ""}`}
              onClick={() => changeNotiFilter("unread")}
            >
              Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </button>
          </div>
          <button
            type="button"
            className="p-noti-readall"
            disabled={unreadCount === 0}
            onClick={() => void markAllAsRead()}
          >
            Mark all as read
          </button>
        </div>

        <div className="p-noti-body" onScroll={handleScroll}>
          {notifications.length === 0 && !isLoading ? (
            <div className="p-noti-empty">
              {notiFilter === "unread"
                ? "You're all caught up."
                : "No notifications yet."}
            </div>
          ) : (
            notifications.map((noti: PortalNotification) => {
              const isResolved = noti.status === "RESOLVED";
              const isUnread = !noti.is_read && !isResolved;
              return (
                <div
                  key={noti._id}
                  role="button"
                  tabIndex={0}
                  className={`p-noti-item p-noti-prio-${noti.priority.toLowerCase()} ${isUnread ? "unread" : ""} ${isResolved ? "resolved" : ""}`}
                  onClick={() => {
                    void markAsReadAndNavigate(noti);
                    setIsNotiOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void markAsReadAndNavigate(noti);
                      setIsNotiOpen(false);
                    }
                  }}
                >
                  <div className="p-noti-icon-wrapper">
                    {getNotificationIcon(noti.type)}
                  </div>
                  <div className="p-noti-content">
                    <div className="p-noti-item-head">
                      <span
                        className={`p-noti-badge p-noti-badge-${noti.priority.toLowerCase()}`}
                      >
                        {PRIORITY_LABEL[noti.priority]}
                      </span>
                      {noti.occurrence_count > 1 && (
                        <span className="p-noti-count">
                          ×{noti.occurrence_count}
                        </span>
                      )}
                      {isResolved && (
                        <span className="p-noti-resolved">Resolved</span>
                      )}
                    </div>
                    <p className="p-noti-item-title">{noti.title}</p>
                    <p className="p-noti-item-message">{noti.message}</p>
                    <p className="p-noti-item-time">
                      {getRelativeTime(noti.last_occurred_at)}
                    </p>
                  </div>
                  {isUnread && <div className="p-noti-dot"></div>}
                </div>
              );
            })
          )}
          {isLoading && <div className="p-noti-empty">Loading…</div>}
        </div>
      </div>

      <main className="portal-main-content">
        <div key={location.pathname} className="page-transition-wrapper">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default PortalLayout;
