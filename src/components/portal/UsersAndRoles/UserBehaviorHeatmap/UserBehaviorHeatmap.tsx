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
} from "../../../../assets/icons/HeatmapIcons";

import type {
  DeviceType,
  InteractionType,
} from "../../../../hooks/portal/UserAndRoles/UserBehaviorHeatmap/useUserBehaviorHeatmap";

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
  // Thêm props mới để nhận data list
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label ||
    value ||
    "Select Page...";

  return (
    <div
      className={`ubh-custom-dropdown ${isOpen ? "is-open" : ""}`}
      ref={dropdownRef}
    >
      <div
        className={`ubh-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedLabel}</span>
        <svg
          className={`ubh-dropdown-arrow ${isOpen ? "open" : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#111827"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      {isOpen && (
        <div className="ubh-dropdown-options">
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
      )}
    </div>
  );
}

export default function UserBehaviorHeatmap({
  selectedPage,
  onPageChange,
  device,
  onDeviceChange,
  interactionType,
  onInteractionChange,
  stats,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  pageOptions,
  interactionOptions,
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

      <div className="ubh-layout">
        <div className="ubh-left-panel">
          <div className="ubh-visual-preview">
            <div className="ubh-website-preview">
              <div className="ubh-preview-header"></div>
              <div className="ubh-preview-content">
                <div className="ubh-hotspot header-zone"></div>
                <div className="ubh-hotspot content-zone"></div>
                <div className="ubh-hotspot footer-zone"></div>
              </div>
            </div>

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

        <div className="ubh-right-panel">
          <div className="ubh-control-group">
            <label className="ubh-label">Select Page</label>
            <CustomHeatmapSelect
              value={selectedPage}
              options={pageOptions}
              onChange={onPageChange}
            />
          </div>

          <div className="ubh-control-group">
            <label className="ubh-label">Date Range</label>
            <div className="ubh-date-inputs">
              <div className="ubh-date-box">
                <CalendarIcon />
                <input
                  type="date"
                  className="ubh-date-input"
                  value={startDate}
                  onChange={(e) => onStartDateChange(e.target.value)}
                />
              </div>
              <span>-</span>
              <div className="ubh-date-box">
                <CalendarIcon />
                <input
                  type="date"
                  className="ubh-date-input"
                  value={endDate}
                  onChange={(e) => onEndDateChange(e.target.value)}
                />
              </div>
            </div>
          </div>

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
            <div
              className="ubh-radio-group"
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {interactionOptions.map((type) => (
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
