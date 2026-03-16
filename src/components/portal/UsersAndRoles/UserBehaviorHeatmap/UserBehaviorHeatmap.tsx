import "./UserBehaviorHeatmap.css";
import {
  DesktopIcon,
  MobileIcon,
  TabletIcon,
  CalendarIcon,
  UsersIcon,
  CursorIcon,
  ClockIcon,
} from "../../../../assets/icons/HeatmapIcons";
import type {
  DeviceType,
  InteractionType,
} from "../../../../pages/portal/UsersAndRoles/UserBehaviorHeatmap/UserBehaviorHeatmapPage";

// định nghĩa props cho dữ liệu đầu vào
interface UserBehaviorHeatmapProps {
  selectedPage: string;
  onPageChange: (page: string) => void;
  device: DeviceType;
  onDeviceChange: (device: DeviceType) => void;
  interactionType: InteractionType;
  onInteractionChange: (type: InteractionType) => void;
  stats: {
    visits: string;
    clicks: string;
    duration: string;
  };
}

const INTERACTION_OPTIONS: InteractionType[] = ["Click", "Scroll", "Hover"];
// component render UI từ props
export default function UserBehaviorHeatmap({
  selectedPage,
  onPageChange,
  device,
  onDeviceChange,
  interactionType,
  onInteractionChange,
  stats,
}: UserBehaviorHeatmapProps) {
  return (
    <div className="ubh-container">
      <div className="ubh-header">
        <div>
          <h1 className="ubh-title">User Behavior Heatmap</h1>
          <p className="ubh-breadcrumb">
            Users & Roles / User Behavior Heatmap
          </p>
        </div>
      </div>

      {/* chia layout màn hình: bản đồ heatmap, thanh điều khiển */}
      <div className="ubh-layout">
        {/* khung hiện biểu đồ nhiệt */}
        <div className="ubh-left-panel">
          <div className="ubh-visual-preview">
            {/* background giả lập giao diện 1 trang web */}
            <div className="ubh-website-preview">
              <div className="ubh-preview-header"></div>
              <div className="ubh-preview-content">
                {/* Vùng heatmap (hotspot) */}
                <div className="ubh-hotspot header-zone"></div>
                <div className="ubh-hotspot content-zone"></div>
                <div className="ubh-hotspot footer-zone"></div>
              </div>
            </div>

            {/* thanh chú thích màu sắc */}
            <div className="ubh-color-scale-wrapper">
              <div className="ubh-color-bar"></div>
              <div className="ubh-color-labels">
                <span>Low Interaction (Blue)</span>
                <span>High Interaction (Red)</span>
              </div>
              <p className="ubh-scale-desc">
                Colors indicate the density of user interactions. Red shows high
                engagement, blue shows low engagement.
              </p>
            </div>
          </div>
        </div>

        {/* form điều khiển (filter) và bảng tóm tắt số liệu */}
        <div className="ubh-right-panel">
          <div className="ubh-control-group">
            <label className="ubh-label">Select Page</label>
            <select
              className="ubh-select"
              value={selectedPage}
              onChange={(e) => onPageChange(e.target.value)}
            >
              <option value="Homepage (Current)">Homepage (Current)</option>
              <option value="Product Page - Hiking Boots">
                Product Page - Hiking Boots
              </option>
              <option value="Cart">Cart</option>
              <option value="Checkout">Checkout</option>
            </select>
          </div>

          <div className="ubh-control-group">
            <label className="ubh-label">Date Range</label>
            <div className="ubh-date-inputs">
              <div className="ubh-date-box">
                <CalendarIcon />
              </div>
              <span>-</span>
              <div className="ubh-date-box">
                <CalendarIcon />
              </div>
            </div>
          </div>

          {/* Button */}
          <div className="ubh-control-group">
            <label className="ubh-label">Device</label>
            <div className="ubh-device-toggles">
              <button
                className={`ubh-device-btn ${device === "Desktop" ? "active" : ""}`}
                onClick={() => onDeviceChange("Desktop")}
              >
                <DesktopIcon /> Desktop
              </button>
              <button
                className={`ubh-device-btn ${device === "Mobile" ? "active" : ""}`}
                onClick={() => onDeviceChange("Mobile")}
              >
                <MobileIcon /> Mobile
              </button>
              <button
                className={`ubh-device-btn ${device === "Tablet" ? "active" : ""}`}
                onClick={() => onDeviceChange("Tablet")}
              >
                <TabletIcon /> Tablet
              </button>
            </div>
          </div>

          <div className="ubh-control-group">
            <label className="ubh-label">Interaction Type</label>
            <div className="ubh-radio-group">
              {/* 3 radio button */}
              {INTERACTION_OPTIONS.map((type) => (
                <label key={type} className="ubh-radio-label">
                  <div
                    className={`ubh-radio-custom ${interactionType === type ? "checked" : ""}`}
                  >
                    <div className="ubh-radio-dot"></div>
                  </div>
                  <input
                    type="radio"
                    name="interaction"
                    checked={interactionType === type}
                    onChange={() => onInteractionChange(type)}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* render 3 card thống kê */}
          <div className="ubh-control-group" style={{ marginTop: "16px" }}>
            <label className="ubh-label">Statistics Summary</label>
            <div className="ubh-stats-grid">
              <div className="ubh-stat-card">
                <div className="ubh-stat-icon">
                  <UsersIcon />
                </div>
                <div className="ubh-stat-info">
                  <span className="ubh-stat-title">Total Visits</span>
                  <span className="ubh-stat-value">{stats.visits}</span>
                </div>
              </div>
              <div className="ubh-stat-card">
                <div className="ubh-stat-icon">
                  <CursorIcon />
                </div>
                <div className="ubh-stat-info">
                  <span className="ubh-stat-title">Total Clicks</span>
                  <span className="ubh-stat-value">{stats.clicks}</span>
                </div>
              </div>
              <div className="ubh-stat-card">
                <div className="ubh-stat-icon">
                  <ClockIcon />
                </div>
                <div className="ubh-stat-info">
                  <span className="ubh-stat-title">Avg. Session Duration</span>
                  <span className="ubh-stat-value">{stats.duration}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
