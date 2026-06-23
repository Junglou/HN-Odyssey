import "./SecurityLogsTab.css";
import { WarningAlertIcon } from "../../../assets/icons/SystemIcons";
import { useSystem } from "../../../hooks/portal/System/useSystem";

type SystemData = ReturnType<typeof useSystem>["data"];

interface SecurityLogsTabProps {
  data: SystemData;
}

export default function SecurityLogsTab({ data }: SecurityLogsTabProps) {
  const { securityLogs } = data;

  const failedLogins = securityLogs.filter(
    (log) => log.status === "Warning" || log.status === "IP Blocked",
  ).length;
  const blockedIPs = securityLogs.filter(
    (log) => log.status === "IP Blocked",
  ).length;

  return (
    <div className="sys-security-container">
      <div className="sys-card">
        <h3 className="sys-card-title">Security Status</h3>
        <div className="sys-security-kpi-grid">
          <div className="sys-info-card warning">
            <WarningAlertIcon className="sys-info-icon" />
            <div className="sys-info-text">
              <span className="sys-info-label">Failed Logins (Recent)</span>
              <span className="sys-info-value">{failedLogins}</span>
            </div>
          </div>

          <div className="sys-info-card warning">
            <WarningAlertIcon className="sys-info-icon" />
            <div className="sys-info-text">
              <span className="sys-info-label">Active Brute Force Blocks</span>
              <span className="sys-info-value">{blockedIPs} IPs</span>
            </div>
          </div>
        </div>
      </div>

      <div className="sys-card">
        <h3 className="sys-card-title">Access Logs</h3>
        <div className="sys-security-table-wrapper">
          <table className="sys-security-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>IP Address</th>
                <th>Target Account</th>
                <th>Failed Attempts</th>
                <th>Action/Status</th>
              </tr>
            </thead>
            <tbody>
              {securityLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ color: "#6b7280", fontWeight: 600 }}>
                    {log.time}
                  </td>
                  <td
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 800,
                      fontSize: "0.95rem",
                    }}
                  >
                    {log.ip}
                  </td>
                  <td style={{ fontWeight: 600 }}>{log.target}</td>
                  <td
                    style={{
                      textAlign: "center",
                      fontWeight: 800,
                      color: log.attempts > 4 ? "#dc2626" : "inherit",
                    }}
                  >
                    {log.attempts}
                  </td>
                  <td>
                    <span
                      className={`sys-security-badge ${
                        log.status === "IP Blocked"
                          ? "critical"
                          : log.status === "Warning"
                            ? "warning"
                            : "stable"
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
