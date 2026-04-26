import "./BusinessIntelligence.css";
import { CalendarIcon } from "../../../../assets/icons/RevenueIcons";
import KeyPerformanceKPIs from "./KeyPerformanceKPIs";
import TrafficConversionTrend from "./TrafficConversionTrend";
import CustomerRetention from "./CustomerRetention";
import ConversionFunnel from "./ConversionFunnel";
import CampaignROIAnalysis from "./CampaignROIAnalysis";
import CampaignPerformanceTable from "./CampaignPerformanceTable";
import type {
  BIMetrics,
  TrendDataPoint,
  RetentionData,
  FunnelStage,
  AdMetrics,
  CampaignData,
} from "../../../../hooks/portal/Dashboard/BusinessIntelligence/useBusinessIntelligence";

interface BusinessIntelligenceProps {
  activeFilter: string;
  startDate: string;
  endDate: string;
  isLoading: boolean;
  dateError: string | null;
  metrics: BIMetrics;
  trendData: TrendDataPoint[];
  retentionData: RetentionData;
  funnelData: FunnelStage[];
  adMetrics: AdMetrics;
  campaigns: CampaignData[];
  onFilterChange: (filter: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onApply: () => void;
}

export default function BusinessIntelligence({
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
  onFilterChange,
  onStartDateChange,
  onEndDateChange,
  onApply,
}: BusinessIntelligenceProps) {
  const filterOptions = ["Today", "This Week", "This Month", "Custom Range"];

  return (
    <div className="bi-wrapper">
      <h1 className="bi-main-title">Business Intelligence (BI)</h1>

      {/* bộ lọc */}
      <div className="bi-card">
        <div className="bi-section-title">Global Time Filter</div>

        <div className="bi-filter-container">
          {/* chọn nhanh */}
          <div className="bi-filter-left">
            <span className="bi-filter-label">Time Period:</span>
            <div className="bi-filter-buttons">
              {filterOptions.map((opt) => (
                <button
                  key={opt}
                  className={`bi-filter-btn ${activeFilter === opt ? "bi-active" : ""}`}
                  onClick={() => onFilterChange(opt)}
                >
                  {activeFilter === opt ? opt : `[${opt}]`}
                </button>
              ))}
            </div>
          </div>

          {/* chọn ngày */}
          <div className="bi-filter-right">
            <div
              className={`bi-date-wrapper ${dateError ? "bi-has-error" : ""}`}
            >
              <CalendarIcon color={dateError ? "#ef4444" : "#64748b"} />
              <input
                type="date"
                className="bi-date-input"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                readOnly={activeFilter !== "Custom Range"}
              />
            </div>
            <div
              className={`bi-date-wrapper ${dateError ? "bi-has-error" : ""}`}
            >
              <CalendarIcon color={dateError ? "#ef4444" : "#64748b"} />
              <input
                type="date"
                className="bi-date-input"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                readOnly={activeFilter !== "Custom Range"}
              />
            </div>

            {/* nút apply */}
            <button
              className="bi-apply-btn"
              onClick={onApply}
              disabled={isLoading || !!dateError}
            >
              {isLoading ? "Loading..." : "Apply"}
            </button>
          </div>
        </div>

        {/* báo lỗi */}
        {dateError && <div className="bi-error-message">{dateError}</div>}
      </div>

      {/* render biểu đồ */}
      <div className={`bi-content-wrapper ${isLoading ? "bi-is-loading" : ""}`}>
        <KeyPerformanceKPIs metrics={metrics} />

        <TrafficConversionTrend data={trendData} />

        {/* dùng class grid thay cho inline css */}
        <div className="bi-grid-2-cols">
          <CustomerRetention data={retentionData} />
          <ConversionFunnel data={funnelData} />
        </div>

        <CampaignROIAnalysis data={adMetrics} />

        {/* render bảng dữ liệu duy nhất của BI */}
        <CampaignPerformanceTable data={campaigns} />
      </div>
    </div>
  );
}
