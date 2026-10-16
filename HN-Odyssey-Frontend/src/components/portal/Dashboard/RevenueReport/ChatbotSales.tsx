import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./ChatbotSales.css";
import type {
  ChatbotSalesView,
  TrendGranularity,
} from "../../../../hooks/portal/Dashboard/RevenueReport/useRevenueReport";
import {
  formatCompactMoney,
  formatMoney,
  toShortVnDate,
  toVnDate,
} from "../../../../utils/reportFormat";
import ChartCard from "../../../../hooks/portal/common/ChartCard/ChartCard";

interface ChatbotSalesProps {
  data: ChatbotSalesView | null;
  granularity: TrendGranularity;
  period: string;
  comparisonLabel: string;
  canExport: boolean;
}

interface SummaryCard {
  key: string;
  title: string;
  value: string;
  note: string;
  trend?: number;
}

const AXIS_TICK = { fontSize: 12, fill: "#64748b" };
const GRID_COLOR = "#e2e8f0";

const formatPercent = (v: number) => `${v.toFixed(1)}%`;
const formatGrowth = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

export default function ChatbotSales({
  data,
  granularity,
  period,
  comparisonLabel,
  canExport,
}: ChatbotSalesProps) {
  // API lỗi -> báo riêng khối này, phần còn lại của trang vẫn hiển thị
  if (!data) {
    return (
      <div className="cbs-wrapper">
        <div className="cbs-section-title">Sales from Chatbot</div>
        <div className="cbs-empty-state">
          Chatbot sales data is unavailable right now.
        </div>
      </div>
    );
  }

  const isHourly = granularity === "hour";
  const tooltipLabel = (label: unknown) =>
    isHourly ? `Hour ${String(label)}` : toVnDate(String(label));

  const cards: SummaryCard[] = [
    {
      key: "revenue",
      title: "Chatbot Revenue",
      value: formatMoney(data.revenue),
      note: `${formatPercent(data.revenueShare)} of total revenue`,
      trend: data.revenueGrowth,
    },
    {
      key: "orders",
      title: "Chatbot Orders",
      value: data.orders.toLocaleString("en-US"),
      note: `${formatPercent(data.ordersShare)} of total orders`,
    },
    {
      key: "aov",
      title: "Chatbot Avg. Order Value",
      value: formatMoney(data.chatbotAov),
      note: `Web: ${formatMoney(data.webAov)}`,
    },
    {
      key: "conversion",
      title: "Suggestion → Order",
      value: formatPercent(data.conversionRate),
      note: `${data.convertedConversations} of ${data.suggestionConversations} chats with product cards`,
    },
  ];

  return (
    <div className="cbs-wrapper">
      <div className="cbs-header">
        <div className="cbs-section-title">Sales from Chatbot</div>
        <div className="cbs-definition">
          Counts orders placed via "Buy Now" on a chatbot product card (same
          tab, within 2 hours). Figures are the minimum attributable value.
        </div>
      </div>

      <div className="cbs-grid">
        {cards.map((card) => (
          <div className="cbs-card" key={card.key}>
            <div className="cbs-card-title">{card.title}</div>
            <div className="cbs-card-value">{card.value}</div>
            <div className="cbs-card-note">{card.note}</div>
            {card.trend !== undefined && (
              <div
                className={`cbs-trend ${card.trend >= 0 ? "cbs-up" : "cbs-down"}`}
              >
                {formatGrowth(card.trend)}
                <span className="cbs-trend-vs">{comparisonLabel}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="cbs-bottom">
        <ChartCard
          title={
            isHourly
              ? "Hourly Chatbot Revenue (Today)"
              : "Daily Chatbot Revenue"
          }
          period={period}
          pdfTitle="Biểu đồ doanh thu từ chatbot"
          fileNamePrefix="ChatbotRevenue"
          canExport={canExport}
        >
          {data.orders === 0 ? (
            <div className="cbs-empty-state">
              No chatbot orders in the selected period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart
                data={data.trend}
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
                  tickFormatter={isHourly ? undefined : toShortVnDate}
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
                  yAxisId="orders"
                  orientation="right"
                  allowDecimals={false}
                  tick={AXIS_TICK}
                  width={40}
                />
                <Tooltip
                  labelFormatter={tooltipLabel}
                  formatter={(value, name) =>
                    name === "Revenue"
                      ? [formatMoney(Number(value)), "Revenue"]
                      : [String(value), "Orders"]
                  }
                />
                <Legend />
                <Bar
                  yAxisId="revenue"
                  dataKey="revenue"
                  name="Revenue"
                  fill="#64748b"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="orders"
                  type="monotone"
                  dataKey="orders"
                  name="Orders"
                  stroke="#0f766e"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <div className="cbs-top">
          <div className="cbs-top-title">Top Products via Chatbot</div>
          {data.topProducts.length === 0 ? (
            <div className="cbs-empty-state">
              No chatbot orders in the selected period.
            </div>
          ) : (
            <table className="cbs-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((p, index) => (
                  <tr key={p.productId}>
                    <td>{index + 1}</td>
                    <td className="cbs-product-name" title={p.name}>
                      {p.name}
                    </td>
                    <td>{p.quantity}</td>
                    <td className="cbs-revenue-cell">
                      {formatMoney(p.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
