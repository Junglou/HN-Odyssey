import "./KeyPerformanceKPIs.css";
import {
  MiniBarChartIcon,
  TrendingUpIcon,
  TrendingDownIcon,
} from "../../../../assets/icons/BIIcons";
import type { BIMetrics } from "../../../../hooks/portal/Dashboard/BusinessIntelligence/useBusinessIntelligence";

// Props
interface KeyPerformanceKPIsProps {
  metrics: BIMetrics;
}

export default function KeyPerformanceKPIs({
  metrics,
}: KeyPerformanceKPIsProps) {
  // Config
  const cards = [
    { key: "conversionRate", title: "Conversion Rate" },
    { key: "bounceRate", title: "Bounce Rate" },
    { key: "returningCustomerRate", title: "Returning Customer Rate" },
    { key: "totalSessions", title: "Total Sessions" },
  ];

  return (
    <div className="bkpi-wrapper">
      <div className="bkpi-section-title">Key Website Performance KPIs</div>
      <div className="bkpi-grid">
        {cards.map((card) => {
          // Dữ liệu thẻ
          const data = metrics[card.key as keyof BIMetrics];
          if (!data) return null;

          return (
            <div className="bkpi-card" key={card.key}>
              <div className="bkpi-header">
                <div className="bkpi-title">{card.title}</div>
                <div className="bkpi-icon-box">
                  <MiniBarChartIcon color="#64748b" size={20} />
                </div>
              </div>

              <div className="bkpi-value">{data.value}</div>

              <div className="bkpi-trend-box">
                <span
                  className={`bkpi-trend-badge ${
                    data.isPositive ? "bkpi-positive" : "bkpi-negative"
                  }`}
                >
                  {/* Icon */}
                  {data.isUp ? (
                    <TrendingUpIcon
                      color={data.isPositive ? "#16a34a" : "#dc2626"}
                    />
                  ) : (
                    <TrendingDownIcon
                      color={data.isPositive ? "#16a34a" : "#dc2626"}
                    />
                  )}
                  {data.trend}
                </span>
                <span className="bkpi-trend-text-vs">vs previous</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
