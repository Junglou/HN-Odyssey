import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./RevenueTrendAnalysis.css";
import type {
  TrendDataPoint,
  TrendGranularity,
} from "../../../../hooks/portal/Dashboard/RevenueReport/useRevenueReport";
import {
  formatCompactMoney,
  formatMoney,
  toShortVnDate,
  toVnDate,
} from "../../../../utils/reportFormat";
import ChartCard from "../../../../hooks/portal/common/ChartCard/ChartCard";

interface RevenueTrendAnalysisProps {
  trendData: TrendDataPoint[];
  granularity: TrendGranularity;
  period: string;
  canExport: boolean;
}

const AXIS_TICK = { fontSize: 12, fill: "#64748b" };
const GRID_COLOR = "#e2e8f0";

export default function RevenueTrendAnalysis({
  trendData,
  granularity,
  period,
  canExport,
}: RevenueTrendAnalysisProps) {
  const isHourly = granularity === "hour";

  const tooltipLabel = (label: unknown) =>
    isHourly ? `Hour ${String(label)}` : toVnDate(String(label));

  return (
    <div className="rta-wrapper">
      <div className="rta-section-title">Revenue Trend Analysis</div>

      <ChartCard
        title={isHourly ? "Hourly Revenue (Today)" : "Daily Revenue"}
        period={period}
        pdfTitle="Biểu đồ xu hướng doanh thu"
        fileNamePrefix="RevenueTrend"
        canExport={canExport}
      >
        {trendData.length === 0 ? (
          <div className="rta-empty-state">
            No data available for the selected period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            {isHourly ? (
              // US.87 AC1: Hôm nay → biến động theo từng khung giờ
              <LineChart
                data={trendData}
                margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={GRID_COLOR}
                />
                <XAxis dataKey="date" tick={AXIS_TICK} interval={1} />
                <YAxis
                  tick={AXIS_TICK}
                  width={72}
                  tickFormatter={(v: number) => formatCompactMoney(v)}
                />
                <Tooltip
                  labelFormatter={tooltipLabel}
                  formatter={(value) => [formatMoney(Number(value)), "Revenue"]}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#334155"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              </LineChart>
            ) : (
              // US.87 AC1: Tuần/Tháng → biểu đồ cột doanh thu từng ngày
              <BarChart
                data={trendData}
                margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={GRID_COLOR}
                />
                <XAxis
                  dataKey="date"
                  tick={AXIS_TICK}
                  tickFormatter={toShortVnDate}
                  minTickGap={16}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={AXIS_TICK}
                  width={72}
                  tickFormatter={(v: number) => formatCompactMoney(v)}
                />
                <Tooltip
                  labelFormatter={tooltipLabel}
                  formatter={(value) => [formatMoney(Number(value)), "Revenue"]}
                />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill="#64748b"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  isAnimationActive={false}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
