import { memo } from "react";
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
import { useSystem } from "../../../hooks/portal/System/useSystem";

type SystemData = ReturnType<typeof useSystem>["data"];

interface CpuRamTabProps {
  data: SystemData;
}

const tooltipStyle = {
  borderRadius: "8px",
  border: "none",
  boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
};

interface ChartCardProps {
  title: string;
  history: { time: string; value: number }[];
  label: string;
  percent: number;
}

const ChartCard = memo(({ title, history, label, percent }: ChartCardProps) => (
  <div className="cr-chart-card">
    <h3 className="cr-section-title">{title}</h3>

    <div
      className="cr-chart-container"
      style={{ width: "100%", height: 240, minHeight: 240 }}
    >
      {/* TRỊ LỖI RECHARTS: 
        1. width="99%" chống lỗi tính toán vòng lặp flexbox
        2. Truyền cứng height={240} và minWidth={100} để chặn tuyệt đối cảnh báo -1
      */}
      <ResponsiveContainer width="99%" height={240} minWidth={100}>
        <LineChart data={history}>
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
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>

    <div className="cr-progress-section">
      <div className="cr-progress-label">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="cr-progress-track">
        <div className="cr-progress-bar" style={{ width: `${percent}%` }} />
      </div>
    </div>
  </div>
));

export default function CpuRamTab({ data }: CpuRamTabProps) {
  const { cpuHistory, ramHistory, overview } = data;

  return (
    <div className="cr-tab-layout">
      <h2 className="cr-section-title mb-0">
        CPU & RAM Details (Real-time & History)
      </h2>
      <div className="cr-bottom-row">
        <ChartCard
          title="CPU Usage History (Last 24h)"
          history={cpuHistory}
          label="Top Processes by CPU"
          percent={overview.gauge.cpu.current}
        />
        <ChartCard
          title="RAM Usage History (Last 24h)"
          history={ramHistory}
          label="Top Processes by RAM"
          percent={overview.gauge.ram.percent}
        />
      </div>
    </div>
  );
}
