import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import "./PortalLayout.css";

// IMPORT TOÀN BỘ ICON TỪ FILE RIÊNG
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

  const [isUsersRolesOpen, setIsUsersRolesOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

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

          <div className="menu-item">
            <div className="menu-item-left">
              <CatalogIcon /> Product Catalog
            </div>
            <ChevronIcon open={false} />
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

          <div className="menu-item">
            <div className="menu-item-left">
              <CRMIcon /> Customer CRM
            </div>
            <ChevronIcon open={false} />
          </div>

          <div className="menu-item">
            <div className="menu-item-left">
              <MarketingIcon /> Marketing Suite
            </div>
            <ChevronIcon open={false} />
          </div>

          <div
            className={`menu-item ${isParentActive("/portal/user") ? "active-parent" : ""}`}
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
              <div className="submenu-item">Role Management</div>
              <div className="submenu-item">User Behavior Heatmap</div>
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
