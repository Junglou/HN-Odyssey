import MarketingAndPromotion from "../../../../components/portal/Dashboard/MarketingAndPromotion/MarketingAndPromotion";
import { useMarketingAndPromotion } from "../../../../hooks/portal/Dashboard/MarketingAndPromotion/useMarketingAndPromotion";
import "./MarketingAndPromotionPage.css";

export default function MarketingAndPromotionPage() {
  const {
    activeFilter,
    startDate,
    endDate,
    isLoading,
    isExporting,
    dateError,
    adMetrics,
    campaigns,
    couponMetrics,
    coupons,
    period,
    channelStats,
    campaignOptions,
    selectedCampaignId,
    setSelectedCampaignId,
    campaignTrend,
    isTrendLoading,
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
    handleExportExcel,
    adSpendLedger,
    permissions,
  } = useMarketingAndPromotion();

  return (
    <div className="mpp-container">
      <MarketingAndPromotion
        activeFilter={activeFilter}
        startDate={startDate}
        endDate={endDate}
        isLoading={isLoading}
        isExporting={isExporting}
        dateError={dateError}
        adMetrics={adMetrics}
        campaigns={campaigns}
        couponMetrics={couponMetrics}
        coupons={coupons}
        period={period}
        channelStats={channelStats}
        campaignOptions={campaignOptions}
        selectedCampaignId={selectedCampaignId}
        onSelectCampaign={setSelectedCampaignId}
        campaignTrend={campaignTrend}
        isTrendLoading={isTrendLoading}
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
        handleExportExcel={handleExportExcel}
        adSpendLedger={adSpendLedger}
        permissions={permissions}
      />
    </div>
  );
}
