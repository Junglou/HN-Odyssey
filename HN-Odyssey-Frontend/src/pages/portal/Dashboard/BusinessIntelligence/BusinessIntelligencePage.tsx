import BusinessIntelligence from "../../../../components/portal/Dashboard/BusinessIntelligence/BusinessIntelligence";
import { useBusinessIntelligence } from "../../../../hooks/portal/Dashboard/BusinessIntelligence/useBusinessIntelligence";
import "./BusinessIntelligencePage.css";

export default function BusinessIntelligencePage() {
  const {
    activeFilter,
    startDate,
    endDate,
    isLoading,
    dateError,
    metrics,
    trendData,
    retentionData,
    funnelData,
    adMetrics,
    campaigns,
    handleFilterChange,
    handleStartDateChange,
    handleEndDateChange,
    handleApply,
  } = useBusinessIntelligence();

  return (
    <div className="bip-container">
      <BusinessIntelligence
        activeFilter={activeFilter}
        startDate={startDate}
        endDate={endDate}
        isLoading={isLoading}
        dateError={dateError}
        metrics={metrics}
        trendData={trendData}
        retentionData={retentionData}
        funnelData={funnelData}
        adMetrics={adMetrics}
        campaigns={campaigns}
        onFilterChange={handleFilterChange}
        onStartDateChange={handleStartDateChange}
        onEndDateChange={handleEndDateChange}
        onApply={handleApply}
      />
    </div>
  );
}
