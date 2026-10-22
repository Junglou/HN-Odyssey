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
import AuditLogsTab from "./AuditLogsTab";

import {
  useSystem,
  type Thresholds,
} from "../../../hooks/portal/System/useSystem";

type SystemHookReturn = ReturnType<typeof useSystem>;

interface SystemProps {
  state: SystemHookReturn["state"];
  data: SystemHookReturn["data"];
  actions: SystemHookReturn["actions"];
}

const TIMEFRAME_OPTIONS = [
  "Last Hour (Real-time)",
  "Last 24 Hours",
  "Last 7 Days",
];
const REFRESH_OPTIONS = ["5s", "10s", "30s"];
const THRESHOLD_FIELDS: { key: keyof Thresholds; label: string }[] = [
  { key: "cpu", label: "CPU Alert:" },
  { key: "ram", label: "RAM Alert:" },
  { key: "disk", label: "Disk Alert:" },
];

export default function System({ state, data, actions }: SystemProps) {
  const { canViewMonitoring, canViewAudit } = state;
  const isOperational = data.status.overall === "Operational";
  const incidentCount = data.status.activeIncidents;

  return (
    <div className="sys-container">
      <div className="sys-header">
        <div>
          <h1 className="sys-title">H&N Analytics - System Dashboard</h1>
        </div>

        {canViewMonitoring && (
          <div className="sys-top-controls">
            <div className="sys-control-group">
              <span>Timeframe:</span>
              <div
                className={`sys-dropdown ${state.activeDropdown === "timeframe" ? "active" : ""}`}
                onClick={() => actions.toggleDropdown("timeframe")}
              >
                {state.timeframe} <ChevronDownIcon />
                {state.activeDropdown === "timeframe" && (
                  <div className="sys-dropdown-menu">
                    {TIMEFRAME_OPTIONS.map((option) => (
                      <div
                        key={option}
                        className="sys-dropdown-item"
                        onClick={() => actions.setTimeframe(option)}
                      >
                        {option}
                      </div>
                    ))}
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
                    {REFRESH_OPTIONS.map((option) => (
                      <div
                        key={option}
                        className="sys-dropdown-item"
                        onClick={() => actions.setRefreshRate(option)}
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              className="sys-btn-health"
              onClick={() => void actions.runHealthCheck()}
              disabled={state.isCheckingHealth}
            >
              <RefreshIcon />{" "}
              {state.isCheckingHealth ? "Checking..." : "Run Health Check"}
            </button>
          </div>
        )}
      </div>

      {canViewMonitoring && (
        <div className="sys-top-kpi-row">
          <div
            className={`sys-info-card ${isOperational ? "success" : "warning"}`}
          >
            {isOperational ? (
              <CheckCircleIcon className="sys-info-icon" />
            ) : (
              <WarningAlertIcon className="sys-info-icon" />
            )}
            <div className="sys-info-text">
              <span className="sys-info-label">Overall Status</span>
              <span className="sys-info-value">{data.status.overall}</span>
            </div>
          </div>

          <div className="sys-info-card">
            <ClockIcon className="sys-info-icon" />
            <div className="sys-info-text">
              <span className="sys-info-label">Uptime (Last 7 days)</span>
              <span className="sys-info-value">{data.status.uptime}</span>
            </div>
          </div>

          <div
            className={`sys-info-card ${incidentCount > 0 ? "warning" : "success"}`}
          >
            {incidentCount > 0 ? (
              <WarningAlertIcon className="sys-info-icon" />
            ) : (
              <CheckCircleIcon className="sys-info-icon" />
            )}
            <div className="sys-info-text">
              <span className="sys-info-label">Active Incidents</span>
              <span className="sys-info-value">
                {incidentCount} {incidentCount === 1 ? "Incident" : "Incidents"}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="sys-main-grid">
        <div className="sys-left-panel">
          {canViewMonitoring && (
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
          )}

          <div className="sys-card">
            <h3 className="sys-card-title">System Logs & Security</h3>
            {canViewMonitoring && (
              <>
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
              </>
            )}
            {canViewAudit && (
              <button
                type="button"
                className={`sys-tab-btn ${state.visibleSections.auditLogs ? "active" : ""}`}
                onClick={() => actions.toggleSection("auditLogs")}
              >
                <div className="sys-tab-switch"></div>
                <span>Audit Logs</span>
              </button>
            )}
          </div>

          {canViewMonitoring && (
            <div className="sys-card">
              <div className="sys-card-header-flex">
                <h3 className="sys-card-title sys-mb-0">Threshold Settings</h3>
                {state.canUpdateThresholds && !state.isEditingThresholds && (
                  <button
                    type="button"
                    className="sys-edit-btn"
                    onClick={actions.startEditThresholds}
                  >
                    Edit
                  </button>
                )}
              </div>

              <div className="sys-threshold-list">
                {THRESHOLD_FIELDS.map(({ key, label }) => (
                  <div className="sys-threshold-item" key={key}>
                    <span>{label}</span>
                    {state.isEditingThresholds ? (
                      <input
                        type="number"
                        min={1}
                        max={100}
                        className="sys-threshold-input"
                        value={state.draftThresholds[key]}
                        onChange={(e) =>
                          actions.updateThresholdDraft(key, e.target.value)
                        }
                      />
                    ) : (
                      <span>&gt;{state.thresholds[key]}%</span>
                    )}
                  </div>
                ))}
              </div>

              {state.isEditingThresholds && (
                <div className="sys-threshold-actions">
                  <button
                    type="button"
                    className="sys-threshold-btn"
                    onClick={actions.cancelEditThresholds}
                    disabled={state.isSavingThresholds}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="sys-threshold-btn primary"
                    onClick={() => void actions.saveThresholds()}
                    disabled={state.isSavingThresholds}
                  >
                    {state.isSavingThresholds ? "Saving..." : "Save"}
                  </button>
                </div>
              )}

              <div className="sys-mini-chart-box">
                <div className="sys-mini-chart-header">
                  <span>API Latency (ms)</span>
                  <span className="sys-latency-avg">
                    avg. {data.avgLatency}ms
                  </span>
                </div>
                <div className="sys-mini-svg-container">
                  <MiniApiChartIcon />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sys-content-area">
          {canViewMonitoring && state.visibleSections.overview && (
            <OverviewTab data={data} />
          )}
          {canViewMonitoring && state.visibleSections.cpuRam && (
            <CpuRamTab data={data} />
          )}
          {canViewMonitoring && state.visibleSections.networkApi && (
            <NetworkApiTab data={data} />
          )}
          {canViewMonitoring && state.visibleSections.paymentLogs && (
            <PaymentLogsTab data={data} />
          )}
          {canViewMonitoring && state.visibleSections.securityLogs && (
            <SecurityLogsTab data={data} />
          )}
          {canViewAudit && state.visibleSections.auditLogs && (
            <AuditLogsTab canExport={state.canExportAudit} />
          )}
        </div>
      </div>
    </div>
  );
}
