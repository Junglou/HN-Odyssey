// src/components/portal/System/CpuRamTab.tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "./CpuRamTab.css";

const MOCK_CPU_HISTORY = [
  { time: "01h", value: 30 },
  { time: "04h", value: 50 },
  { time: "09h", value: 20 },
  { time: "12h", value: 45 },
  { time: "15h", value: 35 },
  { time: "18h", value: 25 },
  { time: "24h", value: 40 },
];

const MOCK_RAM_HISTORY = [
  { time: "01h", value: 3 },
  { time: "04h", value: 3.5 },
  { time: "09h", value: 4.5 },
  { time: "12h", value: 4.5 },
  { time: "15h", value: 4 },
  { time: "18h", value: 5.5 },
  { time: "24h", value: 5.9 },
];

export default function CpuRamTab() {
  return (
    <div className="cr-tab-layout">
      <h2 className="cr-section-title mb-0">
        CPU & RAM Details (Real-time & History)
      </h2>

      <div className="cr-bottom-row">
        <div className="cr-chart-card">
          <h3 className="cr-section-title">CPU Usage History (Last 24h)</h3>
          <div className="cr-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_CPU_HISTORY}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                />
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  domain={[0, 100]}
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
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="cr-progress-section">
            <div className="cr-progress-label">
              <span>Top Processes by CPU</span>
              <span>50%</span>
            </div>
            <div className="cr-progress-track">
              {/* style width bắt buộc dùng inline vì nó là dữ liệu động, màu sắc đã chuyển qua CSS */}
              <div className="cr-progress-bar" style={{ width: "50%" }}></div>
            </div>
          </div>
        </div>

        <div className="cr-chart-card">
          <h3 className="cr-section-title">RAM Usage History (Last 24h)</h3>
          <div className="cr-chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_RAM_HISTORY}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                />
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  domain={[0, 8]}
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
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="cr-progress-section">
            <div className="cr-progress-label">
              <span>Top Processes by RAM</span>
              <span>85%</span>
            </div>
            <div className="cr-progress-track">
              <div className="cr-progress-bar" style={{ width: "85%" }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
