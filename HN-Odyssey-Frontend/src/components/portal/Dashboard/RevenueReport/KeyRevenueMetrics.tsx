import "./KeyRevenueMetrics.css";
import {
  ChartBarIcon,
  TrendingUpIcon,
} from "../../../../assets/icons/RevenueIcons";
import type { RevenueMetric } from "../../../../hooks/portal/Dashboard/RevenueReport/useRevenueReport";

interface KeyRevenueMetricsProps {
  metrics: Record<string, RevenueMetric>;
}

export default function KeyRevenueMetrics({ metrics }: KeyRevenueMetricsProps) {
  // mảng config để map giao diện
  const cards = [
    { key: "totalRevenue", title: "Total Revenue" },
    { key: "totalOrders", title: "Total Orders" },
    { key: "itemsSold", title: "Item Sold" },
    { key: "avgOrderValue", title: "Avg. Order Value" },
  ];

  return (
    <div className="krm-wrapper">
      <div className="krm-section-title">Key Revenue Metrics</div>
      <div className="krm-grid">
        {cards.map((card) => {
          const data = metrics[card.key];
          if (!data) return null;

          return (
            <div className="krm-card" key={card.key}>
              <div className="krm-header">
                <div className="krm-title">{card.title}</div>
                <div className="krm-icon-box">
                  <ChartBarIcon color="#64748b" />
                </div>
              </div>
              <div className="krm-value">{data.value}</div>
              <div className="krm-trend-box">
                <span
                  className={`krm-trend-badge ${data.isUp ? "krm-up" : "krm-down"}`}
                >
                  {data.isUp && <TrendingUpIcon color="#16a34a" />}
                  {data.trend}
                </span>
                <span className="krm-trend-text-vs">vs last month</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
