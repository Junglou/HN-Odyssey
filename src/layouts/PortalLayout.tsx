import { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import "./PortalLayout.css";

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

// mock data thông báo
const MOCK_NOTIFICATIONS = [
  {
    title: "New RMA Request",
    time: "(20m ago)",
    unread: true,
    icon: <CatalogIcon />,
    link: "/portal/trade-in",
  },
  {
    title: "Order #1198 Received",
    time: "(15m ago)",
    unread: true,
    icon: <WarehouseIcon />,
    link: "/portal/orders",
  },
  {
    title: "System Update Complete",
    time: "(1d ago)",
    unread: false,
    icon: <SystemIcon />,
    link: "/portal/system",
  },
];

const PortalLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Menu States
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

  // Active Route Helpers
  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (basePath: string) =>
    location.pathname.includes(basePath);

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="portal-container">
      {/* Mobile Toggle */}
      <button
        className="mobile-menu-toggle"
        onClick={() => setIsMobileSidebarOpen(true)}
      >
        <HamburgerIcon />
      </button>

      {/* Mobile Backdrop */}
      <div
        className={`portal-backdrop ${isMobileSidebarOpen ? "open" : ""}`}
        onClick={() => setIsMobileSidebarOpen(false)}
      ></div>

      {/* Sidebar */}
      <aside className={`portal-sidebar ${isMobileSidebarOpen ? "open" : ""}`}>
        <RippleSidebarBackground />
        <div className="portal-brand">H&N-Portal</div>

        <nav className="sidebar-menu">
          {/* Dashboard */}
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
                <div
                  className={`submenu-item ${isActive("/portal/overview") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/overview")}
                >
                  Overview
                </div>
                <div
                  className={`submenu-item ${isActive("/portal/revenue-report") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/revenue-report")}
                >
                  Revenue Report
                </div>
                <div
                  className={`submenu-item ${isActive("/portal/marketing-promotion") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/marketing-promotion")}
                >
                  Marketing & Promotion
                </div>
                <div
                  className={`submenu-item ${isActive("/portal/bi") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/bi")}
                >
                  Business Intelligence (BI)
                </div>
                <div
                  className={`submenu-item ${isActive("/portal/inventory") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/inventory")}
                >
                  Inventory Management
                </div>
              </div>
            </div>
          </div>

          {/* Product Catalog */}
          <div className="menu-group">
            <div
              className={`menu-item ${isParentActive("/portal/products") || isParentActive("/portal/categories") || isParentActive("/portal/variants") || isParentActive("/portal/prices") || isParentActive("/portal/tags") ? "active-parent" : ""}`}
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
                <div
                  className={`submenu-item ${isActive("/portal/products") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/products")}
                >
                  Product Management
                </div>
                <div
                  className={`submenu-item ${isActive("/portal/categories") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/categories")}
                >
                  Category Management
                </div>
                <div
                  className={`submenu-item ${isActive("/portal/variants") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/variants")}
                >
                  Variant Management
                </div>
                <div
                  className={`submenu-item ${isActive("/portal/prices") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/prices")}
                >
                  Price Management
                </div>
                <div
                  className={`submenu-item ${isActive("/portal/tags") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/tags")}
                >
                  Tag Management
                </div>
              </div>
            </div>
          </div>

          {/* Order Management */}
          <div className="menu-group">
            <div
              className={`menu-item ${isParentActive("/portal/orders") || isParentActive("/portal/trade-in") ? "active-parent" : ""}`}
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
                <div
                  className={`submenu-item ${isActive("/portal/orders") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/orders")}
                >
                  Order Management
                </div>
                <div
                  className={`submenu-item ${isActive("/portal/trade-in") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/trade-in")}
                >
                  Trade-in Management
                </div>
              </div>
            </div>
          </div>

          {/* Warehouse (WMS) */}
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
                <div
                  className={`submenu-item ${isActive("/portal/warehouse") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/warehouse")}
                >
                  Stock Management
                </div>
              </div>
            </div>
          </div>

          {/* Customer CRM */}
          <div className="menu-group">
            <div
              className={`menu-item ${isParentActive("/portal/customers") || isParentActive("/portal/live-chat") ? "active-parent" : ""}`}
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
                <div
                  className={`submenu-item ${isActive("/portal/customers") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/customers")}
                >
                  Customer Management
                </div>
                <div
                  className={`submenu-item ${isActive("/portal/live-chat") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/live-chat")}
                >
                  Live Chat Support
                </div>
              </div>
            </div>
          </div>

          {/* Marketing Suite */}
          <div className="menu-group">
            <div
              className={`menu-item ${isParentActive("/portal/promotion") || isParentActive("/portal/review-rating") || isParentActive("/portal/coupon") ? "active-parent" : ""}`}
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
                <div
                  className={`submenu-item ${isActive("/portal/promotion") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/promotion")}
                >
                  Promotion Management
                </div>
                <div
                  className={`submenu-item ${isActive("/portal/review-rating") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/review-rating")}
                >
                  Review & Rating Management
                </div>
                <div
                  className={`submenu-item ${isActive("/portal/coupon") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/coupon")}
                >
                  Coupon Management
                </div>
              </div>
            </div>
          </div>

          {/* Users & Roles */}
          <div className="menu-group">
            <div
              className={`menu-item ${isParentActive("/portal/user") || isParentActive("/portal/role") || isParentActive("/portal/heatmap") ? "active-parent" : ""}`}
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
                <div
                  className={`submenu-item ${isActive("/portal/users") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/users")}
                >
                  User Management
                </div>

                <div
                  className={`submenu-item ${isActive("/portal/roles") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/roles")}
                >
                  Role Management
                </div>

                <div
                  className={`submenu-item ${isActive("/portal/heatmap") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/heatmap")}
                >
                  User Behavior Heatmap
                </div>
              </div>
            </div>
          </div>

          {/* Communication */}
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
                <div
                  className={`submenu-item ${isActive("/portal/static-pages") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/static-pages")}
                >
                  Static Page Management
                </div>
                <div
                  className={`submenu-item ${isActive("/portal/media-management") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/media-management")}
                >
                  Media Management
                </div>
                <div
                  className={`submenu-item ${isActive("/portal/banner-management") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/banner-management")}
                >
                  Banner Management
                </div>
                <div
                  className={`submenu-item ${isActive("/portal/blog-news") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/blog-news")}
                >
                  Blog&News Management
                </div>
                <div
                  className={`submenu-item ${isActive("/portal/content-config") ? "active" : ""}`} // Mới
                  onClick={() => handleNavigate("/portal/content-config")} // Mới
                >
                  Content Config
                </div>
              </div>
            </div>
          </div>

          {/* System */}
          <div
            className={`menu-item ${isActive("/portal/system") ? "active-parent" : ""}`}
            onClick={() => handleNavigate("/portal/system")}
          >
            <div className="menu-item-left">
              <SystemIcon /> System
            </div>
          </div>
        </nav>

        <div className="sidebar-bottom">
          {/* nút thông báo */}
          <div className="notification-btn" onClick={() => setIsNotiOpen(true)}>
            <div className="menu-item-left">
              <BellIcon /> Notifications
            </div>
            <span className="notification-badge">
              {MOCK_NOTIFICATIONS.filter((n) => n.unread).length}
            </span>
          </div>

          <div className="sidebar-divider"></div>

          <div className="logout-btn" onClick={() => navigate("/profile")}>
            <LogoutIcon /> Exit Portal
          </div>
        </div>
      </aside>

      {/* drawer thông báo */}
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
        <div className="p-noti-body">
          {MOCK_NOTIFICATIONS.map((noti, idx) => (
            <div
              key={idx}
              className={`p-noti-item ${noti.unread ? "unread" : ""}`}
              onClick={() => {
                if (noti.link) navigate(noti.link);
                setIsNotiOpen(false);
              }}
            >
              <div className="p-noti-icon-wrapper">{noti.icon}</div>
              <div className="p-noti-content">
                <p className="p-noti-item-title">{noti.title}</p>
                <p className="p-noti-item-time">{noti.time}</p>
              </div>
              <div className="p-noti-dot"></div>
            </div>
          ))}
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
