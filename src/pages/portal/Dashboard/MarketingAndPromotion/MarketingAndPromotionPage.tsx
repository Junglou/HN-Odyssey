import MarketingAndPromotion from "../../../../components/portal/Dashboard/MarketingAndPromotion/MarketingAndPromotion";
import { useMarketingAndPromotion } from "../../../../hooks/portal/Dashboard/MarketingAndPromotion/useMarketingAndPromotion";
import "./MarketingAndPromotionPage.css";

export default function MarketingAndPromotionPage() {
  const {
    activeFilter,
    startDate,
    endDate,
    isLoading,
    dateError,
    adMetrics,
    campaigns,
    couponMetrics,
    coupons,
    handleFilterChange,
    setStartDate,
    setEndDate,
    handleApply,
  } = useMarketingAndPromotion();

  return (
    <div className="mpp-container">
      <MarketingAndPromotion
        activeFilter={activeFilter}
        startDate={startDate}
        endDate={endDate}
        isLoading={isLoading}
        dateError={dateError}
        adMetrics={adMetrics}
        campaigns={campaigns}
        couponMetrics={couponMetrics}
        coupons={coupons}
        onFilterChange={handleFilterChange}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={handleApply}
      />
    </div>
  );
}
