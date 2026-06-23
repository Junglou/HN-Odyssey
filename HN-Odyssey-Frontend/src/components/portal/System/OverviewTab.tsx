import { useState, useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import "./OverviewTab.css";
import { useSystem } from "../../../hooks/portal/System/useSystem";

type SystemData = ReturnType<typeof useSystem>["data"];

interface OverviewTabProps {
  data: SystemData;
}

// Biểu đồ Gauge hiển thị chỉ số
function GradientGauge({
  value,
  threshold = 65,
}: {
  value: number;
  threshold?: number;
}) {
  const radius = 80;
  const circumference = Math.PI * radius;

  const safeValue = Math.min(Math.max(value, 0), 100);
  const strokeDashoffset = circumference - (safeValue / 100) * circumference;
  const angle = (safeValue / 100) * 180 - 180;
  const thresholdAngle = (threshold / 100) * 180 - 180;

  return (
    <svg viewBox="0 0 200 120" width="100%" height="100%">
      <defs>
        <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset={`${threshold}%`} stopColor="#3b82f6" />
          <stop offset={`${threshold}%`} stopColor="#ef4444" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>

      {/* Background track */}
      <path
        d="M 20 100 A 80 80 0 0 1 180 100"
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="16"
        strokeLinecap="butt"
      />

      {/* Active track */}
      <path
        d="M 20 100 A 80 80 0 0 1 180 100"
        fill="none"
        stroke="url(#gaugeGradient)"
        strokeWidth="16"
        strokeLinecap="butt"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        style={{
          transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />

      {/* Vạch chia ngưỡng */}
      <g
        style={{
          transform: `rotate(${thresholdAngle}deg)`,
          transformOrigin: "100px 100px",
        }}
      >
        <line
          x1="171"
          y1="100"
          x2="189"
          y2="100"
          stroke="#ffffff"
          strokeWidth="3"
        />
      </g>

      {/* Min/Max label */}
      <text
        x="20"
        y="118"
        fontSize="12"
        fill="#6b7280"
        textAnchor="middle"
        fontWeight="600"
      >
        0
      </text>
      <text
        x="180"
        y="118"
        fontSize="12"
        fill="#6b7280"
        textAnchor="middle"
        fontWeight="600"
      >
        100
      </text>

      <g
        style={{
          transform: `rotate(${angle}deg)`,
          transformOrigin: "100px 100px",
          transition: "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <polygon points="100,96 100,104 172,100" fill="#111827" />
        <circle cx="100" cy="100" r="8" fill="#111827" />
        <circle cx="100" cy="100" r="3" fill="#ffffff" />
      </g>
    </svg>
  );
}

export default function OverviewTab({ data }: OverviewTabProps) {
  const { overview } = data;

  // Custom logic thay thế ResponsiveContainer
  const [chartWidth, setChartWidth] = useState(0);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element) return;

    // Tự động cập nhật lại chartWidth mỗi khi div cha bị co giãn
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        // Chỉ lưu width khi nó là số dương hợp lệ
        if (width > 0) {
          setChartWidth(width);
        }
      }
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="ov-tab-layout">
      {/* Tổng quan tài nguyên */}
      <div className="ov-gauge-section">
        <h3 className="ov-section-title">Real-time System Overview</h3>
        <div className="ov-gauge-grid">
          <div className="ov-gauge-item">
            <div className="ov-gauge-svg">
              <GradientGauge
                value={overview.gauge.cpu.current}
                threshold={65}
              />
            </div>
            <div className="ov-gauge-label">
              CPU Load: {overview.gauge.cpu.current}%
              <div className="ov-gauge-sub">
                (Peak: {overview.gauge.cpu.peak}%)
              </div>
            </div>
          </div>

          <div className="ov-gauge-item">
            <div className="ov-gauge-svg">
              <GradientGauge
                value={overview.gauge.ram.percent}
                threshold={65}
              />
            </div>
            <div className="ov-gauge-label">
              Ram Usage: {overview.gauge.ram.percent}%
              <div className="ov-gauge-sub">({overview.gauge.ram.text})</div>
            </div>
          </div>

          <div className="ov-gauge-item">
            <div className="ov-gauge-svg">
              <GradientGauge
                value={overview.gauge.disk.percent}
                threshold={65}
              />
            </div>
            <div className="ov-gauge-label">
              Disk Storage: {overview.gauge.disk.percent}%
              <div className="ov-gauge-sub">
                (Used: {overview.gauge.disk.text})
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ov-bottom-row">
        {/* Biểu đồ Page Load */}
        <div className="ov-chart-card">
          <h3 className="ov-section-title sys-mb-0">
            Avg. Page Load Time (ms)
          </h3>
          <div
            className="ov-chart-container"
            ref={chartContainerRef}
            style={{ width: "100%", height: 280 }}
          >
            {/* Truyền trực tiếp pixel thật vào AreaChart, dập tắt tận gốc component gây lỗi */}
            {chartWidth > 0 && (
              <AreaChart
                width={chartWidth}
                height={280}
                data={overview.pageLoad}
              >
                <defs>
                  <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="time" />
                <YAxis width={40} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorLoad)"
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            )}
          </div>
        </div>

        {/* Log sự cố */}
        <div className="ov-table-card">
          <h3 className="ov-section-title">Recent Incident Log</h3>
          <table className="ov-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Severity</th>
                <th>Component</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {overview.logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.time}</td>
                  <td>
                    <span className={`ov-badge ${log.severity.toLowerCase()}`}>
                      {log.severity}
                    </span>
                  </td>
                  <td>{log.component}</td>
                  <td>{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
