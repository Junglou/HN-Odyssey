// imports
import { useState, useRef, useEffect } from "react";
import "./UserBehaviorHeatmap.css";
import {
  DesktopIcon,
  MobileIcon,
  TabletIcon,
  CalendarIcon,
  UsersIcon,
  CursorIcon,
  ClockIcon,
  ChevronDownIcon,
} from "../../../../assets/icons/HeatmapIcons";
import type {
  DeviceType,
  InteractionType,
} from "../../../../hooks/portal/UserAndRoles/UserBehaviorHeatmap/useUserBehaviorHeatmap";

// types
interface UserBehaviorHeatmapProps {
  selectedPage: string;
  onPageChange: (page: string) => void;
  device: DeviceType;
  onDeviceChange: (device: DeviceType) => void;
  interactionType: InteractionType;
  onInteractionChange: (type: InteractionType) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  stats: {
    visits: string;
    clicks: string;
    duration: string;
  };
  pageOptions: { label: string; value: string }[];
  interactionOptions: string[];
}

function CustomHeatmapSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || "Select an option";

  return (
    <div className="ubh-custom-dropdown" ref={ref}>
      <div
        className={`ubh-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!hasOpened) setHasOpened(true);
        }}
      >
        <span>{selectedLabel}</span>
        <div className={`ubh-dropdown-arrow ${isOpen ? "open" : ""}`}>
          <ChevronDownIcon />
        </div>
      </div>
      <div
        className={`ubh-dropdown-options ${isOpen ? "open" : hasOpened ? "closed" : ""}`}
      >
        {options.map((opt) => (
          <div
            key={opt.value}
            className={`ubh-dropdown-item ${value === opt.value ? "selected" : ""}`}
            onClick={() => {
              onChange(opt.value);
              setIsOpen(false);
            }}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// component chính
export default function UserBehaviorHeatmap({
  selectedPage,
  onPageChange,
  device,
  onDeviceChange,
  interactionType,
  onInteractionChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  stats,
  pageOptions,
  interactionOptions,
}: UserBehaviorHeatmapProps) {
  return (
    <div className="ubh-container">
      {/* Header */}
      <div className="ubh-header">
        <div>
          <h1 className="ubh-title">User Behavior Heatmap</h1>
          <p className="ubh-breadcrumb">
            Users & Roles / User Behavior Heatmap
          </p>
        </div>
      </div>

      <div className="ubh-layout">
        {/* Bản đồ nhiệt*/}
        <div className="ubh-left-panel" style={{ padding: "24px" }}>
          <div className="ubh-real-heatmap-wrapper">
            {/* 1. Khung hộp xám nét đứt chờ API (Đã khớp với CSS của bạn) */}
            <div className="ubh-heatmap-canvas-container">
              <div className="ubh-heatmap-empty-state">
                <CursorIcon />
                <h3>Bản đồ nhiệt (Heatmap)</h3>
                <p>
                  Hệ thống đã kết nối dữ liệu thống kê từ API.
                  <br />
                  Tính năng vẽ bản đồ trực quan đang chờ tích hợp thư viện thật.
                </p>
              </div>
            </div>

            {/* 2. Thanh chú thích (Legend) của bạn giữ nguyên */}
            <div className="ubh-color-scale-wrapper">
              <div className="ubh-color-bar"></div>
              <div className="ubh-color-labels">
                <span>Cold</span>
                <span>Warm</span>
                <span>Hot</span>
              </div>
              <p className="ubh-scale-desc">
                Heatmap visualization for:{" "}
                <strong>{selectedPage || "All Pages"}</strong> <br />
                Device: <strong>{device}</strong> | Interaction:{" "}
                <strong>{interactionType || "All"}</strong>
                {startDate && endDate && ` | Date: ${startDate} - ${endDate}`}
              </p>
            </div>
          </div>
        </div>

        {/* bộ lọc và thống kê */}
        <div className="ubh-right-panel">
          <h2 className="ubh-panel-title">Filters</h2>

          {/* Lọc Trang */}
          <div className="ubh-control-group">
            <label className="ubh-label">Page/Screen</label>
            <CustomHeatmapSelect
              value={selectedPage}
              options={pageOptions}
              onChange={onPageChange}
            />
          </div>

          {/* Lọc Thiết bị */}
          <div className="ubh-control-group" style={{ marginTop: "16px" }}>
            <label className="ubh-label">Device Type</label>
            <div className="ubh-device-toggles">
              {(["Desktop", "Mobile", "Tablet"] as const).map((type) => (
                <button
                  key={type}
                  className={`ubh-device-btn ${device === type ? "active" : ""}`}
                  onClick={() => onDeviceChange(type)}
                >
                  {type === "Desktop" && <DesktopIcon />}
                  {type === "Mobile" && <MobileIcon />}
                  {type === "Tablet" && <TabletIcon />}
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Lọc Thời gian */}
          <div className="ubh-control-group" style={{ marginTop: "16px" }}>
            <label className="ubh-label">Date Range</label>
            <div className="ubh-date-inputs">
              <div className="ubh-date-box">
                <CalendarIcon />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => onStartDateChange(e.target.value)}
                  className="ubh-date-input"
                />
              </div>
              <span className="ubh-date-separator">-</span>
              <div className="ubh-date-box">
                <CalendarIcon />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  className="ubh-date-input"
                />
              </div>
            </div>
          </div>

          {/* Lọc Tương tác */}
          <div className="ubh-control-group" style={{ marginTop: "16px" }}>
            <label className="ubh-label">Interaction Type</label>
            <div className="ubh-radio-group">
              {interactionOptions.map((type) => (
                <label key={type} className="ubh-radio-label">
                  <input
                    type="radio"
                    name="interactionType"
                    value={type}
                    checked={interactionType === type}
                    onChange={() => onInteractionChange(type)}
                    className="ubh-radio-input"
                  />
                  <div
                    className={`ubh-radio-custom ${interactionType === type ? "checked" : ""}`}
                  >
                    <div className="ubh-radio-dot"></div>
                  </div>
                  <span className="ubh-radio-text">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Thống kê chung */}
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
