import "./System.css";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  RefreshIcon,
  MiniApiChartIcon,
  ClockIcon,
  WarningAlertIcon,
} from "../../../assets/icons/SystemIcons";

import OverviewTab from "./OverviewTab";
import CpuRamTab from "./CpuRamTab";
import NetworkApiTab from "./NetworkApiTab";
import PaymentLogsTab from "./PaymentLogsTab";
import SecurityLogsTab from "./SecurityLogsTab";

import { useSystem } from "../../../hooks/portal/System/useSystem";

type SystemHookReturn = ReturnType<typeof useSystem>;

interface SystemProps {
  state: SystemHookReturn["state"];
  data: SystemHookReturn["data"];
  actions: SystemHookReturn["actions"];
}

export default function System({ state, data, actions }: SystemProps) {
  return (
    <div className="sys-container">
      {state.toastMessage && (
        <div className="sys-toast">
          <CheckCircleIcon className="sys-toast-icon" />
          <span>{state.toastMessage}</span>
        </div>
      )}

      <div className="sys-header">
        <div>
          <h1 className="sys-title">H&N Analytics - System Dashboard</h1>
        </div>
        <div className="sys-top-controls">
          <div className="sys-control-group">
            <span>Server Node:</span>
            <div
              className={`sys-dropdown ${state.activeDropdown === "node" ? "active" : ""}`}
              onClick={() => actions.toggleDropdown("node")}
            >
              {state.serverNode} <ChevronDownIcon />
              {state.activeDropdown === "node" && (
                <div className="sys-dropdown-menu">
                  <div
                    className="sys-dropdown-item"
                    onClick={() => actions.setServerNode("Primary Node")}
                  >
                    Primary Node
                  </div>
                  <div
                    className="sys-dropdown-item"
                    onClick={() => actions.setServerNode("Secondary Node")}
                  >
                    Secondary Node
                  </div>
                  <div
                    className="sys-dropdown-item"
                    onClick={() => actions.setServerNode("Backup Node")}
                  >
                    Backup Node
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="sys-control-group">
            <span>Timeframe:</span>
            <div
              className={`sys-dropdown ${state.activeDropdown === "timeframe" ? "active" : ""}`}
              onClick={() => actions.toggleDropdown("timeframe")}
            >
              {state.timeframe} <ChevronDownIcon />
              {state.activeDropdown === "timeframe" && (
                <div className="sys-dropdown-menu">
                  <div
                    className="sys-dropdown-item"
                    onClick={() =>
                      actions.setTimeframe("Last Hour (Real-time)")
                    }
                  >
                    Last Hour (Real-time)
                  </div>
                  <div
                    className="sys-dropdown-item"
                    onClick={() => actions.setTimeframe("Last 24 Hours")}
                  >
                    Last 24 Hours
                  </div>
                  <div
                    className="sys-dropdown-item"
                    onClick={() => actions.setTimeframe("Last 7 Days")}
                  >
                    Last 7 Days
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="sys-control-group">
            <span>Refresh Rate:</span>
            <div
              className={`sys-dropdown ${state.activeDropdown === "refresh" ? "active" : ""}`}
              onClick={() => actions.toggleDropdown("refresh")}
            >
              {state.refreshRate} <ChevronDownIcon />
              {state.activeDropdown === "refresh" && (
                <div className="sys-dropdown-menu">
                  <div
                    className="sys-dropdown-item"
                    onClick={() => actions.setRefreshRate("5s")}
                  >
                    5s
                  </div>
                  <div
                    className="sys-dropdown-item"
                    onClick={() => actions.setRefreshRate("10s")}
                  >
                    10s
                  </div>
                  <div
                    className="sys-dropdown-item"
                    onClick={() => actions.setRefreshRate("30s")}
                  >
                    30s
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="sys-btn-health"
            onClick={actions.runHealthCheck}
          >
            <RefreshIcon /> Run Health Check
          </button>
        </div>
      </div>

      <div className="sys-top-kpi-row">
        <div className="sys-info-card success">
          <CheckCircleIcon className="sys-info-icon" />
          <div className="sys-info-text">
            <span className="sys-info-label">Overall Status</span>
            <span className="sys-info-value">{data.status.overall}</span>
          </div>
        </div>

        <div className="sys-info-card">
          <ClockIcon className="sys-info-icon" />
          <div className="sys-info-text">
            <span className="sys-info-label">Uptime (Last 30 days)</span>
            <span className="sys-info-value">{data.status.uptime}</span>
          </div>
        </div>

        <div className="sys-info-card warning">
          <WarningAlertIcon className="sys-info-icon" />
          <div className="sys-info-text">
            <span className="sys-info-label">Active Incidents</span>
            <span className="sys-info-value">
              {data.status.activeIncidents} Warnings
            </span>
          </div>
        </div>
      </div>

      <div className="sys-main-grid">
        <div className="sys-left-panel">
          <div className="sys-card">
            <h3 className="sys-card-title">Resource Monitoring</h3>
            <button
              type="button"
              className={`sys-tab-btn ${state.visibleSections.overview ? "active" : ""}`}
              onClick={() => actions.toggleSection("overview")}
            >
              <div className="sys-tab-switch"></div>
              <span>Overview</span>
            </button>
            <button
              type="button"
              className={`sys-tab-btn ${state.visibleSections.cpuRam ? "active" : ""}`}
              onClick={() => actions.toggleSection("cpuRam")}
            >
              <div className="sys-tab-switch"></div>
              <span>CPU & RAM Details</span>
            </button>
            <button
              type="button"
              className={`sys-tab-btn ${state.visibleSections.networkApi ? "active" : ""}`}
              onClick={() => actions.toggleSection("networkApi")}
            >
              <div className="sys-tab-switch"></div>
              <span>Network & API Health</span>
            </button>
          </div>

          <div className="sys-card">
            <h3 className="sys-card-title">System Logs & Security</h3>
            <button
              type="button"
              className={`sys-tab-btn ${state.visibleSections.paymentLogs ? "active" : ""}`}
              onClick={() => actions.toggleSection("paymentLogs")}
            >
              <div className="sys-tab-switch"></div>
              <span>Payment Gateway Logs</span>
            </button>
            <button
              type="button"
              className={`sys-tab-btn ${state.visibleSections.securityLogs ? "active" : ""}`}
              onClick={() => actions.toggleSection("securityLogs")}
            >
              <div className="sys-tab-switch"></div>
              <span>Security & Access</span>
            </button>
          </div>

          <div className="sys-card">
            <div className="sys-card-header-flex">
              <h3 className="sys-card-title sys-mb-0">Threshold Settings</h3>
              <button
                className="sys-edit-btn"
                onClick={() =>
                  actions.setIsEditingThresholds(!state.isEditingThresholds)
                }
              >
                {state.isEditingThresholds ? "Save" : "Edit"}
              </button>
            </div>

            <div className="sys-threshold-list">
              <div className="sys-threshold-item">
                <span>CPU Alert:</span>
                {state.isEditingThresholds ? (
                  <input
                    type="number"
                    className="sys-threshold-input"
                    value={state.thresholds.cpu}
                    onChange={(e) =>
                      actions.updateThreshold("cpu", e.target.value)
                    }
                  />
                ) : (
                  <span>&gt;{state.thresholds.cpu}%</span>
                )}
              </div>
              <div className="sys-threshold-item">
                <span>RAM Alert:</span>
                {state.isEditingThresholds ? (
                  <input
                    type="number"
                    className="sys-threshold-input"
                    value={state.thresholds.ram}
                    onChange={(e) =>
                      actions.updateThreshold("ram", e.target.value)
                    }
                  />
                ) : (
                  <span>&gt;{state.thresholds.ram}%</span>
                )}
              </div>
              <div className="sys-threshold-item">
                <span>Disk Alert:</span>
                {state.isEditingThresholds ? (
                  <input
                    type="number"
                    className="sys-threshold-input"
                    value={state.thresholds.disk}
                    onChange={(e) =>
                      actions.updateThreshold("disk", e.target.value)
                    }
                  />
                ) : (
                  <span>&gt;{state.thresholds.disk}%</span>
                )}
              </div>
            </div>

            <div className="sys-mini-chart-box">
              <div className="sys-mini-chart-header">
                <span>API Latency (ms)</span>
                <span className="sys-latency-avg">avg. 120ms</span>
              </div>
              <div className="sys-mini-svg-container">
                <MiniApiChartIcon />
              </div>
            </div>
          </div>
        </div>

        <div className="sys-content-area">
          {state.visibleSections.overview && <OverviewTab data={data} />}
          {state.visibleSections.cpuRam && <CpuRamTab />}
          {state.visibleSections.networkApi && <NetworkApiTab />}
          {state.visibleSections.paymentLogs && <PaymentLogsTab />}
          {state.visibleSections.securityLogs && <SecurityLogsTab />}
        </div>
      </div>
    </div>
  );
}
