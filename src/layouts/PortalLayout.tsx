import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import "./PortalLayout.css";

// Icon
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
} from "../assets/icons/PortalIcons";

const PortalLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // state quản lý đóng mở các menu cha
  const [isUsersRolesOpen, setIsUsersRolesOpen] = useState(false);
  const [isProductCatalogOpen, setIsProductCatalogOpen] = useState(true);
  const [isCustomerCRMOpen, setIsCustomerCRMOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMarketingSuiteOpen, setIsMarketingSuiteOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (basePath: string) =>
    location.pathname.includes(basePath);

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="portal-container">
      <button
        className="mobile-menu-toggle"
        onClick={() => setIsMobileSidebarOpen(true)}
      >
        <HamburgerIcon />
      </button>

      <div
        className={`portal-backdrop ${isMobileSidebarOpen ? "open" : ""}`}
        onClick={() => setIsMobileSidebarOpen(false)}
      ></div>

      <aside className={`portal-sidebar ${isMobileSidebarOpen ? "open" : ""}`}>
        <div className="portal-brand">H&N-Portal</div>

        <nav className="sidebar-menu">
          <div
            className="menu-item"
            onClick={() => handleNavigate("/portal/dashboard")}
          >
            <div className="menu-item-left">
              <DashboardIcon /> Dashboard
            </div>
            <ChevronIcon open={false} />
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

          <div className="menu-item">
            <div className="menu-item-left">
              <OrderIcon /> Order Management
            </div>
            <ChevronIcon open={false} />
          </div>

          <div className="menu-item">
            <div className="menu-item-left">
              <WarehouseIcon /> Warehouse (WMS)
            </div>
            <ChevronIcon open={false} />
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
              className={`menu-item ${isParentActive("/portal/promotion") ? "active-parent" : ""}`}
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
                  className={`submenu-item ${isActive("/portal/ReviewAndRating") ? "active" : ""}`}
                  onClick={() => handleNavigate("/portal/ReviewAndRating")}
                >
                  Review & Rating Moderation
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

          <div className="menu-item">
            <div className="menu-item-left">
              <CommunicationIcon /> Communication
            </div>
            <ChevronIcon open={false} />
          </div>

          <div className="menu-item">
            <div className="menu-item-left">
              <SystemIcon /> System
            </div>
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div className="logout-btn" onClick={() => navigate("/profile")}>
            <LogoutIcon /> Exit Portal
          </div>
        </div>
      </aside>

      <main className="portal-main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default PortalLayout;
