import "./AdCampaignOverview.css";
import {
  DollarSignIcon,
  CashIcon,
  ShoppingCartIcon,
  ChartROIIcon,
} from "../../../../assets/icons/MarketingAndPromotionIcons";
import type { AdOverviewMetrics } from "../../../../hooks/portal/Dashboard/MarketingAndPromotion/useMarketingAndPromotion";

interface AdCampaignOverviewProps {
  metrics: AdOverviewMetrics;
}

export default function AdCampaignOverview({
  metrics,
}: AdCampaignOverviewProps) {
  // mảng cấu hình thẻ
  const cards = [
    {
      key: "totalAdSpend",
      label: "Total Ad Spend",
      value: metrics?.totalAdSpend || "0",
      icon: <DollarSignIcon color="#475569" size={28} />,
    },
    {
      key: "adRevenue",
      label: "Ad Revenue",
      value: metrics?.adRevenue || "0",
      icon: <CashIcon color="#475569" size={28} />,
    },
    {
      key: "totalConversions",
      label: "Total Conversions",
      value: metrics?.totalConversions || "0",
      icon: <ShoppingCartIcon color="#475569" size={28} />,
    },
    {
      key: "overallROI",
      label: "Overall ROI",
      value: metrics?.overallROI || "0",
      icon: <ChartROIIcon color="#475569" size={28} />,
    },
  ];

  return (
    <div className="aco-wrapper">
      <div className="aco-section-title">Ad Campaign Performance Overview</div>
      <div className="aco-grid">
        {cards.map((card) => (
          <div className="aco-card" key={card.key}>
            <div className="aco-icon-box">{card.icon}</div>
            <div className="aco-info">
              <div className="aco-label">{card.label}</div>
              <div className="aco-value">{card.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
