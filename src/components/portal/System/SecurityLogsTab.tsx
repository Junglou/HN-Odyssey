import "./SecurityLogsTab.css";
import { WarningAlertIcon } from "../../../assets/icons/SystemIcons";

const MOCK_SECURITY_LOGS = [
  {
    id: 1,
    time: "11:20 AM",
    ip: "192.168.1.45",
    target: "admin@hn.com",
    attempts: 6,
    status: "IP Blocked",
  },
  {
    id: 2,
    time: "11:05 AM",
    ip: "114.22.54.12",
    target: "staff@hn.com",
    attempts: 3,
    status: "Warning",
  },
  {
    id: 3,
    time: "08:10 AM",
    ip: "103.11.2.99",
    target: "manager@hn.com",
    attempts: 1,
    status: "New Device",
  },
  {
    id: 4,
    time: "07:45 AM",
    ip: "45.33.22.11",
    target: "unknown",
    attempts: 15,
    status: "IP Blocked",
  },
];

export default function SecurityLogsTab() {
  return (
    <div className="sys-security-container">
      {/* khối cảnh báo hệ thống và các địa chỉ ip bị chặn */}
      <div className="sys-card">
        <h3 className="sys-card-title">Security Status</h3>
        <div className="sys-security-kpi-grid">
          {/* thẻ kpi thứ nhất báo lỗi đăng nhập */}
          <div className="sys-info-card warning">
            <WarningAlertIcon className="sys-info-icon" />
            <div className="sys-info-text">
              <span className="sys-info-label">Failed Logins (Last 1hr)</span>
              <span className="sys-info-value">24</span>
            </div>
          </div>

          {/* thẻ kpi thứ hai báo số lượng ip bị khóa */}
          <div className="sys-info-card warning">
            <WarningAlertIcon className="sys-info-icon" />
            <div className="sys-info-text">
              <span className="sys-info-label">Active Brute Force Blocks</span>
              <span className="sys-info-value">2 IPs</span>
            </div>
          </div>
        </div>
      </div>

      {/* bảng ghi nhận chi tiết lượt truy cập */}
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
              {MOCK_SECURITY_LOGS.map((log) => (
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
                      className={`sys-security-badge ${log.status === "IP Blocked" ? "critical" : log.status === "Warning" ? "warning" : "stable"}`}
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
