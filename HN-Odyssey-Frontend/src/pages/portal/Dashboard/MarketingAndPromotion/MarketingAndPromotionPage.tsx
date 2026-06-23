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
    campaignPage,
    totalCampaignPages,
    setCampaignPage,
    couponPage,
    totalCouponPages,
    setCouponPage,
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
        campaignPage={campaignPage}
        totalCampaignPages={totalCampaignPages}
        onCampaignPageChange={setCampaignPage}
        couponPage={couponPage}
        totalCouponPages={totalCouponPages}
        onCouponPageChange={setCouponPage}
      />
    </div>
  );
}
