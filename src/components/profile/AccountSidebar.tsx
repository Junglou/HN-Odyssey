import { useNavigate, useLocation } from "react-router-dom";
import "./AccountSidebar.css";
import {
  UserIcon,
  MapIcon,
  CartIcon,
  HeartIcon,
  HistoryIcon,
  TicketIcon,
  CrownIcon,
  LogoutIcon,
} from "../../assets/icons/ProfileIcons";

const menuItems = [
  { label: "My Profile", path: "/profile", icon: <UserIcon /> },
  {
    label: "Address Management",
    path: "/profile/address-management",
    icon: <MapIcon />,
  },
  { label: "Order Management", path: "/profile/orders", icon: <CartIcon /> },
  {
    label: "Purchase History",
    path: "/profile/history",
    icon: <HistoryIcon />,
  },
  { label: "My Wishlist", path: "/profile/wishlist", icon: <HeartIcon /> },
  { label: "Recently Viewed", path: "/profile/recent", icon: <HistoryIcon /> },
  { label: "My Coupon", path: "/profile/coupon", icon: <TicketIcon /> },
  { label: "Loyalty", path: "/profile/loyalty", icon: <CrownIcon /> },
];

const AccountSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    console.log("Logging out...");
    navigate("/login");
  };

  return (
    <div className="account-sidebar-wrapper">
      {/* ĐÃ XÓA HEADER MÀU XÁM */}

      <div className="sidebar-content">
        <div className="sidebar-menu-list">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <div key={item.path} className="sidebar-row">
                {/* CỘT 1: LINE */}
                <div className="line-column">
                  <div
                    className={`thread-line ${isActive ? "active-line" : ""}`}
                  ></div>
                </div>

                {/* CỘT 2: VIÊN THUỐC */}
                <div
                  className={`sidebar-item-pill ${isActive ? "active" : ""}`}
                  onClick={() => navigate(item.path)}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  <span className="sidebar-label">{item.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* LOGOUT */}
        <div className="sidebar-logout-container" onClick={handleLogout}>
          <div className="line-column"></div>
          <div className="sidebar-logout-btn">
            <span className="sidebar-icon">
              <LogoutIcon />
            </span>
            <span className="sidebar-label">Logout</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSidebar;
