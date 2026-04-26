import "./PaymentLogsTab.css";
import {
  WarningAlertIcon,
  CheckCircleIcon,
} from "../../../assets/icons/SystemIcons";

const MOCK_PAYMENT_LOGS = [
  {
    id: 1,
    time: "10:45 AM",
    orderId: "#DH10025",
    gateway: "VNPAY",
    code: "99",
    reason: "Khách hàng hủy giao dịch",
    status: "User Error",
  },
  {
    id: 2,
    time: "10:30 AM",
    orderId: "#DH10024",
    gateway: "Momo",
    code: "11",
    reason: "Giao dịch Timeout (API Disconnected)",
    status: "System Error",
  },
  {
    id: 3,
    time: "09:15 AM",
    orderId: "#DH10021",
    gateway: "VNPAY",
    code: "97",
    reason: "Sai Checksum / Chữ ký không hợp lệ",
    status: "Critical",
  },
  {
    id: 4,
    time: "08:50 AM",
    orderId: "#DH10018",
    gateway: "ZaloPay",
    code: "-49",
    reason: "Khách hàng nhập sai OTP quá số lần",
    status: "User Error",
  },
];

export default function PaymentLogsTab() {
  return (
    <div className="sys-payment-container">
      {/* khối thông tin tổng quan các lỗi thanh toán */}
      <div className="sys-card">
        <h3 className="sys-card-title">Payment Overview</h3>
        <div className="sys-payment-kpi-grid">
          <div className="sys-info-card warning">
            <WarningAlertIcon className="sys-info-icon" />
            <div className="sys-info-text">
              <span className="sys-info-label">
                Failed Transactions (Today)
              </span>
              <span className="sys-info-value">12</span>
            </div>
          </div>

          <div className="sys-info-card success">
            <CheckCircleIcon className="sys-info-icon" />
            <div className="sys-info-text">
              <span className="sys-info-label">Spike Alert Status</span>
              <span className="sys-info-value">Normal</span>
            </div>
          </div>
        </div>
      </div>

      {/* bảng danh sách chi tiết các giao dịch bị lỗi */}
      <div className="sys-card">
        <h3 className="sys-card-title">Recent Error Logs</h3>
        <div className="sys-payment-table-wrapper">
          <table className="sys-payment-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Order ID</th>
                <th>Gateway</th>
                <th>Error Code & Reason</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_PAYMENT_LOGS.map((log) => (
                <tr key={log.id}>
                  <td style={{ color: "#6b7280", fontWeight: 600 }}>
                    {log.time}
                  </td>
                  <td style={{ fontWeight: 800, color: "#3b82f6" }}>
                    {log.orderId}
                  </td>
                  <td style={{ fontWeight: 600 }}>{log.gateway}</td>
                  <td>
                    <strong style={{ color: "#dc2626" }}>[{log.code}]</strong>{" "}
                    {log.reason}
                  </td>
                  <td>
                    <span
                      className={`sys-payment-badge ${log.status === "Critical" ? "critical" : log.status === "System Error" ? "warning" : "neutral"}`}
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
