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
import { useSystem } from "../../../hooks/portal/System/useSystem";

type SystemData = ReturnType<typeof useSystem>["data"];

interface NetworkApiTabProps {
  data: SystemData;
}

export default function NetworkApiTab({ data }: NetworkApiTabProps) {
  const { networkData, errorRateData, apiStatusList } = data;

  return (
    <div className="na-tab-layout">
      <h2 className="na-section-title mb-0">Network & API Health</h2>

      <div className="na-bottom-row">
        <div className="na-chart-card na-chart-flex">
          {/* Cột 1: Biểu đồ Line */}
          <div className="na-chart-col">
            <h3 className="na-section-title">Network Throughput (Mbps)</h3>
            <div
              className="na-chart-container small"
              style={{ width: "100%", height: 240, minHeight: 240 }}
            >
              {/* FIX RECHARTS BUG: Dùng width 99% và truyền trực tiếp height dạng số */}
              <ResponsiveContainer width="99%" height={240} minWidth={100}>
                <LineChart data={networkData}>
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

          {/* Cột 2: Biểu đồ Bar */}
          <div className="na-chart-col">
            <h3 className="na-section-title">API Error Rate</h3>
            <div
              className="na-chart-container small"
              style={{ width: "100%", height: 240, minHeight: 240 }}
            >
              {/* FIX RECHARTS BUG: Dùng width 99% và truyền trực tiếp height dạng số */}
              <ResponsiveContainer width="99%" height={240} minWidth={100}>
                <BarChart data={errorRateData}>
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
                    {errorRateData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.value > 10 ? "#ef4444" : "#3b82f6"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bảng Table Log */}
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
              {apiStatusList.map((api) => (
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
