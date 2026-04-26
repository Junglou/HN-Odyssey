// src/components/portal/System/NetworkApiTab.tsx
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./NetworkApiTab.css";

const MOCK_NETWORK = [
  { time: "0", value: 10 },
  { time: "1", value: 50 },
  { time: "2", value: 15 },
  { time: "3", value: 20 },
  { time: "4", value: 10 },
  { time: "5", value: 40 },
  { time: "6", value: 15 },
];

const MOCK_ERROR_RATE = [
  { time: "0", value: 1 },
  { time: "1", value: 1 },
  { time: "2", value: 1 },
  { time: "3", value: 1 },
  { time: "4", value: 1 },
  { time: "5", value: 5 },
  { time: "6", value: 1 },
];

const MOCK_API_STATUS = [
  {
    id: "1",
    service: "Payment Gateway",
    severity: "Stable",
    avgLatency: "120ms",
    lastCheck: "1 min ago",
  },
  {
    id: "2",
    service: "Shipping API",
    severity: "Stable",
    avgLatency: "95ms",
    lastCheck: "1 min ago",
  },
  {
    id: "3",
    service: "SMS Service",
    severity: "Warning",
    avgLatency: "450ms (Slow)",
    lastCheck: "30s ago",
  },
];

export default function NetworkApiTab() {
  return (
    <div className="na-tab-layout">
      <h2 className="na-section-title mb-0">Network & API Health</h2>

      <div className="na-bottom-row">
        {/* Sử dụng class CSS cho flexbox thay vì inline style */}
        <div className="na-chart-card na-chart-flex">
          <div className="na-chart-col">
            <h3 className="na-section-title">Network Throughput (Mbps)</h3>
            <div className="na-chart-container small">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={MOCK_NETWORK}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e5e7eb"
                  />
                  <XAxis dataKey="time" hide />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="na-chart-col">
            <h3 className="na-section-title">API Error Rate</h3>
            <div className="na-chart-container small">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={MOCK_ERROR_RATE}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e5e7eb"
                  />
                  <XAxis dataKey="time" hide />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                  />
                  <Tooltip
                    cursor={{ fill: "#f3f4f6" }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    {MOCK_ERROR_RATE.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.value > 2 ? "#ef4444" : "#3b82f6"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="na-table-card">
          <h3 className="na-section-title">External API Status & Latency</h3>
          <table className="na-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Severity</th>
                <th>Avg Latency</th>
                <th>Last check</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_API_STATUS.map((api) => (
                <tr key={api.id}>
                  <td>{api.service}</td>
                  <td>
                    <span className={`na-badge ${api.severity.toLowerCase()}`}>
                      {api.severity}
                    </span>
                  </td>
                  <td>{api.avgLatency}</td>
                  <td>{api.lastCheck}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
