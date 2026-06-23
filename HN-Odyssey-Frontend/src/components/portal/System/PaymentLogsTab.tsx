import "./PaymentLogsTab.css";
import {
  WarningAlertIcon,
  CheckCircleIcon,
} from "../../../assets/icons/SystemIcons";
import { useSystem } from "../../../hooks/portal/System/useSystem";

type SystemData = ReturnType<typeof useSystem>["data"];

interface PaymentLogsTabProps {
  data: SystemData;
}

export default function PaymentLogsTab({ data }: PaymentLogsTabProps) {
  const { paymentLogs } = data;

  const failedTransactionsToday = paymentLogs.length;
  const hasCriticalSpike = paymentLogs.some(
    (log) => log.status === "System Error" || log.status === "Critical",
  );

  return (
    <div className="sys-payment-container">
      <div className="sys-card">
        <h3 className="sys-card-title">Payment Overview</h3>
        <div className="sys-payment-kpi-grid">
          <div className="sys-info-card warning">
            <WarningAlertIcon className="sys-info-icon" />
            <div className="sys-info-text">
              <span className="sys-info-label">
                Failed Transactions (Today)
              </span>
              <span className="sys-info-value">{failedTransactionsToday}</span>
            </div>
          </div>

          <div
            className={`sys-info-card ${hasCriticalSpike ? "warning" : "success"}`}
          >
            {hasCriticalSpike ? (
              <WarningAlertIcon className="sys-info-icon" />
            ) : (
              <CheckCircleIcon className="sys-info-icon" />
            )}
            <div className="sys-info-text">
              <span className="sys-info-label">Spike Alert Status</span>
              <span className="sys-info-value">
                {hasCriticalSpike ? "Alert Triggered" : "Normal"}
              </span>
            </div>
          </div>
        </div>
      </div>

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
              {paymentLogs.map((log) => (
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
                      className={`sys-payment-badge ${
                        log.status === "Critical"
                          ? "critical"
                          : log.status === "System Error"
                            ? "warning"
                            : "neutral"
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
