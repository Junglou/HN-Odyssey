import "./CouponEffectiveness.css";
import {
  CouponIcon,
  DivideIcon,
  DollarSignIcon,
} from "../../../../assets/icons/MarketingAndPromotionIcons";
import type { CouponMetrics } from "../../../../hooks/portal/Dashboard/MarketingAndPromotion/useMarketingAndPromotion";

interface CouponEffectivenessProps {
  metrics: CouponMetrics;
}

export default function CouponEffectiveness({
  metrics,
}: CouponEffectivenessProps) {
  const cards = [
    {
      key: "totalUsage",
      label: "Total Coupon Usage",
      value: metrics?.totalUsage || "0",
      icon: <CouponIcon color="#475569" size={28} />,
    },
    {
      key: "totalDiscount",
      label: "Total Discount Given",
      value: metrics?.totalDiscount || "$0.00",
      icon: <DivideIcon color="#475569" size={28} />,
    },
    {
      key: "revenueGenerated",
      label: "Revenue from Coupons",
      value: metrics?.revenueGenerated || "$0.00",
      icon: <DollarSignIcon color="#475569" size={28} />,
    },
  ];

  return (
    <div className="ce-wrapper">
      <div className="ce-section-title">Coupon & Promotion Effectiveness</div>
      <div className="ce-grid">
        {cards.map((card) => (
          <div className="ce-card" key={card.key}>
            <div className="ce-icon-box">{card.icon}</div>
            <div className="ce-info">
              <div className="ce-label">{card.label}</div>
              <div className="ce-value">{card.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
