import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./MarketingCharts.css";
import {
  NO_SPEND_TOOLTIP,
  type CampaignOption,
  type CampaignTrendPoint,
  type ChannelStat,
  type ProfitStatus,
} from "../../../../hooks/portal/Dashboard/MarketingAndPromotion/useMarketingAndPromotion";
import {
  formatCompactMoney,
  formatCompactNumber,
  formatMoney,
  toShortVnDate,
  toVnDate,
} from "../../../../utils/reportFormat";
import ChartCard from "../../../../hooks/portal/common/ChartCard/ChartCard";

// US.82 AC3: Xanh = lãi, Vàng = hòa vốn, Đỏ = lỗ
const ROI_COLORS: Record<ProfitStatus, string> = {
  PROFIT: "#16a34a",
  BREAK_EVEN: "#ca8a04",
  LOSS: "#dc2626",
  NO_SPEND: "#94a3b8",
};

const AXIS_TICK = { fontSize: 12, fill: "#64748b" };
// ROI có thể null (kỳ không có chi phí) → dataMin/dataMax có thể không phải số hữu hạn
const roiAxisMin = (dataMin: number) =>
  Number.isFinite(dataMin) ? Math.min(0, Math.floor(dataMin / 50) * 50) : 0;
const roiAxisMax = (dataMax: number) =>
  Number.isFinite(dataMax) ? Math.max(50, Math.ceil(dataMax / 50) * 50) : 50;
const SPEND_COLOR = "#dc2626";

// Tooltip ROI: null → "—"
const formatRoiTooltip = (value: unknown): string =>
  value === null || value === undefined || value === ""
    ? "—"
    : `${Number(value).toFixed(2)}%`;
const GRID_COLOR = "#e2e8f0";
const REVENUE_COLOR = "#334155";
const SESSIONS_COLOR = "#e6d5c3";

function RoiLegend() {
  return (
    <div className="mkc-roi-legend">
      <span>
        <i style={{ backgroundColor: ROI_COLORS.PROFIT }} /> Profit (ROI &gt; 0)
      </span>
      <span>
        <i style={{ backgroundColor: ROI_COLORS.BREAK_EVEN }} /> Break-even (ROI
        = 0)
      </span>
      <span>
        <i style={{ backgroundColor: ROI_COLORS.LOSS }} /> ⚠️ Loss (ROI &lt; 0)
      </span>
      <span title={NO_SPEND_TOOLTIP}>
        <i style={{ backgroundColor: ROI_COLORS.NO_SPEND }} /> No ad spend (ROI
        —)
      </span>
    </div>
  );
}

// ======================= KHỐI 1: THEO KÊNH =======================

interface ChannelAnalysisSectionProps {
  channelStats: ChannelStat[];
  period: string;
  canExport: boolean;
}

export function ChannelAnalysisSection({
  channelStats,
  period,
  canExport,
}: ChannelAnalysisSectionProps) {
  return (
    <div className="mkc-wrapper">
      <div className="mkc-section-title">Channel Performance Analysis</div>

      {channelStats.length === 0 ? (
        <div className="mkc-empty">No campaign data for this period.</div>
      ) : (
        <div className="mkc-grid">
          {/* US.79 AC5: so sánh Doanh thu & Lưu lượng giữa các kênh */}
          <ChartCard
            title="Revenue & Sessions by Channel"
            period={period}
            pdfTitle="Hiệu quả theo kênh quảng cáo"
            fileNamePrefix="ChannelPerformance"
            canExport={canExport}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={channelStats}
                margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={GRID_COLOR}
                />
                <XAxis dataKey="channel" tick={AXIS_TICK} />
                <YAxis
                  yAxisId="revenue"
                  tick={AXIS_TICK}
                  width={72}
                  tickFormatter={(v: number) => formatCompactMoney(v)}
                />
                <YAxis
                  yAxisId="sessions"
                  orientation="right"
                  tick={AXIS_TICK}
                  width={48}
                  allowDecimals={false}
                  tickFormatter={(v: number) => formatCompactNumber(v)}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === "Revenue"
                      ? formatMoney(Number(value))
                      : formatCompactNumber(Number(value))
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  yAxisId="revenue"
                  dataKey="revenue"
                  name="Revenue"
                  fill={REVENUE_COLOR}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="sessions"
                  dataKey="sessions"
                  name="Sessions"
                  fill={SESSIONS_COLOR}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* US.82 AC4 + AC3: so sánh ROI giữa các kênh, tô màu lãi/hòa/lỗ */}
          <ChartCard
            title="ROI by Channel"
            period={period}
            legend={<RoiLegend />}
            pdfTitle="So sánh ROI giữa các kênh"
            fileNamePrefix="ChannelROI"
            canExport={canExport}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={channelStats}
                margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={GRID_COLOR}
                />
                <XAxis dataKey="channel" tick={AXIS_TICK} />
                <YAxis
                  tick={AXIS_TICK}
                  width={56}
                  domain={[roiAxisMin, roiAxisMax]}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Tooltip
                  formatter={(value) => [formatRoiTooltip(value), "ROI"]}
                />
                <Bar
                  dataKey="roi"
                  name="ROI"
                  maxBarSize={48}
                  isAnimationActive={false}
                >
                  {channelStats.map((s) => (
                    <Cell key={s.channel} fill={ROI_COLORS[s.profitStatus]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

// ================== KHỐI 2: XU HƯỚNG CHIẾN DỊCH ==================

interface CampaignTrendSectionProps {
  campaignOptions: CampaignOption[];
  selectedCampaignId: string;
  onSelectCampaign: (id: string) => void;
  campaignTrend: CampaignTrendPoint[];
  isTrendLoading: boolean;
  period: string;
  canExport: boolean;
}

export function CampaignTrendSection({
  campaignOptions,
  selectedCampaignId,
  onSelectCampaign,
  campaignTrend,
  isTrendLoading,
  period,
  canExport,
}: CampaignTrendSectionProps) {
  const campaignName =
    campaignOptions.find((c) => c.id === selectedCampaignId)?.name ?? "";

  const renderBody = (chart: ReactNode) => {
    if (isTrendLoading) {
      return <div className="mkc-empty">Loading trend data...</div>;
    }
    if (campaignTrend.length === 0) {
      return <div className="mkc-empty">No data for this period.</div>;
    }
    return chart;
  };

  return (
    <div className="mkc-wrapper">
      <div className="mkc-section-header">
        <div className="mkc-section-title">Campaign Trend Analysis</div>
        {campaignOptions.length > 0 && (
          <label className="mkc-select-label">
            Campaign:
            <select
              className="mkc-select"
              value={selectedCampaignId}
              onChange={(e) => onSelectCampaign(e.target.value)}
            >
              {campaignOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {campaignOptions.length === 0 ? (
        <div className="mkc-empty">No campaigns to analyze yet.</div>
      ) : (
        <div className="mkc-grid">
          {/* US.79 AC8: biến động Lượt truy cập & Doanh thu theo thời gian */}
          <ChartCard
            title={`Sessions, Revenue & Ad Spend — ${campaignName}`}
            period={period}
            pdfTitle={`Xu hướng chiến dịch ${campaignName}`}
            fileNamePrefix="CampaignTrend"
            canExport={canExport}
          >
            {renderBody(
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart
                  data={campaignTrend}
                  margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
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
                    yAxisId="revenue"
                    tick={AXIS_TICK}
                    width={72}
                    tickFormatter={(v: number) => formatCompactMoney(v)}
                  />
                  <YAxis
                    yAxisId="sessions"
                    orientation="right"
                    tick={AXIS_TICK}
                    width={48}
                    allowDecimals={false}
                    tickFormatter={(v: number) => formatCompactNumber(v)}
                  />
                  <Tooltip
                    labelFormatter={(label) => toVnDate(String(label))}
                    formatter={(value, name) =>
                      name === "Revenue" || name === "Ad Spend"
                        ? formatMoney(Number(value))
                        : formatCompactNumber(Number(value))
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    yAxisId="sessions"
                    dataKey="sessions"
                    name="Sessions"
                    fill={SESSIONS_COLOR}
                    maxBarSize={24}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="revenue"
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke={REVENUE_COLOR}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="revenue"
                    type="monotone"
                    dataKey="spend"
                    name="Ad Spend"
                    stroke={SPEND_COLOR}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>,
            )}
          </ChartCard>

          {/* US.82 AC5: biến động ROI theo thời gian (lũy kế) */}
          <ChartCard
            title={`Cumulative ROI — ${campaignName}`}
            subtitle="Cumulative ROI on day d = (Revenue - Ad spend) ÷ Ad spend x 100, both summed from the start of the selected period to day d. No line until ad spend is recorded."
            period={period}
            pdfTitle={`ROI lũy kế chiến dịch ${campaignName}`}
            fileNamePrefix="CampaignROITrend"
            canExport={canExport}
          >
            {renderBody(
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={campaignTrend}
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
                    width={56}
                    domain={[roiAxisMin, roiAxisMax]}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <ReferenceLine
                    y={0}
                    stroke={ROI_COLORS.BREAK_EVEN}
                    strokeDasharray="4 4"
                    label={{
                      value: "Break-even",
                      position: "insideTopRight",
                      fill: ROI_COLORS.BREAK_EVEN,
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    labelFormatter={(label) => toVnDate(String(label))}
                    formatter={(value) => [
                      formatRoiTooltip(value),
                      "Cumulative ROI",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeRoi"
                    name="Cumulative ROI"
                    stroke="#1F4E78"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>,
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}
