import "./MarketingAndPromotion.css";
import { CalendarIcon } from "../../../../assets/icons/RevenueIcons";
import type {
  AdOverviewMetrics,
  AdCampaign,
  CampaignOption,
  CampaignTrendPoint,
  ChannelStat,
  CouponMetrics,
  CouponData,
  AdSpendLedgerApi,
} from "../../../../hooks/portal/Dashboard/MarketingAndPromotion/useMarketingAndPromotion";

import AdCampaignOverview from "./AdCampaignOverview";
import TopCampaignsTable from "./TopCampaignsTable";
import CouponEffectiveness from "./CouponEffectiveness";
import TopCouponsTable from "./TopCouponsTable";
import {
  CampaignTrendSection,
  ChannelAnalysisSection,
} from "./MarketingCharts";

interface MarketingAndPromotionProps {
  activeFilter: string;
  startDate: string;
  endDate: string;
  isLoading: boolean;
  isExporting?: boolean;
  dateError: string | null;
  adMetrics: AdOverviewMetrics;
  campaigns: AdCampaign[];
  couponMetrics: CouponMetrics;
  coupons: CouponData[];
  period: string;
  channelStats: ChannelStat[];
  campaignOptions: CampaignOption[];
  selectedCampaignId: string;
  onSelectCampaign: (id: string) => void;
  campaignTrend: CampaignTrendPoint[];
  isTrendLoading: boolean;
  onFilterChange: (_filter: string) => void;
  onStartDateChange: (_date: string) => void;
  onEndDateChange: (_date: string) => void;
  onApply: () => void;
  campaignPage: number;
  totalCampaignPages: number;
  onCampaignPageChange: (page: number) => void;
  couponPage: number;
  totalCouponPages: number;
  onCouponPageChange: (page: number) => void;
  handleExportExcel?: () => void;
  adSpendLedger?: AdSpendLedgerApi;
  permissions?: { canExport: boolean; canUpdate: boolean };
}

export default function MarketingAndPromotion({
  activeFilter,
  startDate,
  endDate,
  isLoading,
  isExporting = false,
  dateError,
  adMetrics,
  campaigns,
  couponMetrics,
  coupons,
  period,
  channelStats,
  campaignOptions,
  selectedCampaignId,
  onSelectCampaign,
  campaignTrend,
  isTrendLoading,
  onFilterChange,
  onStartDateChange,
  onEndDateChange,
  onApply,
  campaignPage,
  totalCampaignPages,
  onCampaignPageChange,
  couponPage,
  totalCouponPages,
  onCouponPageChange,
  handleExportExcel,
  adSpendLedger,
  permissions,
}: MarketingAndPromotionProps) {
  const filterOptions = ["Today", "This Week", "This Month", "Custom Range"];
  const canExport = permissions?.canExport ?? false;
  const exportDisabled = isLoading || isExporting || !canExport;

  return (
    <div className="mp-wrapper">
      <h1 className="mp-main-title">Marketing & Promotion</h1>

      <div className="mp-card">
        <div className="mp-section-title">Global Time Filter</div>

        <div className="mp-filter-container">
          <div className="mp-filter-left">
            <span className="mp-filter-label">Time Period:</span>
            <div className="mp-filter-buttons">
              {filterOptions.map((opt) => (
                <button
                  key={opt}
                  className={`mp-filter-btn ${activeFilter === opt ? "mp-active" : ""}`}
                  onClick={() => onFilterChange(opt)}
                >
                  {activeFilter === opt ? opt : `[${opt}]`}
                </button>
              ))}
            </div>
          </div>

          <div className="mp-filter-right">
            <div
              className={`mp-date-wrapper ${dateError ? "mp-has-error" : ""}`}
            >
              <CalendarIcon color={dateError ? "#ef4444" : "#64748b"} />
              <input
                type="date"
                className="mp-date-input"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                readOnly={activeFilter !== "Custom Range"}
              />
            </div>
            <div
              className={`mp-date-wrapper ${dateError ? "mp-has-error" : ""}`}
            >
              <CalendarIcon color={dateError ? "#ef4444" : "#64748b"} />
              <input
                type="date"
                className="mp-date-input"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                readOnly={activeFilter !== "Custom Range"}
              />
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                className="mp-apply-btn"
                onClick={onApply}
                disabled={isLoading || !!dateError}
              >
                {isLoading ? "Loading..." : "Apply"}
              </button>

              {/* US.79 AC6, US.95 AC1: Xuất Excel dữ liệu bảng */}
              <button
                className="mp-export-btn"
                onClick={handleExportExcel}
                disabled={exportDisabled}
                style={{
                  backgroundColor: canExport ? "#10b981" : "#94a3b8",
                  color: "white",
                  padding: "0 16px",
                  borderRadius: "6px",
                  cursor: exportDisabled ? "not-allowed" : "pointer",
                  border: "none",
                  height: "36px",
                  fontWeight: 500,
                }}
                title={
                  !canExport
                    ? "Your account does not have Export permission"
                    : "Export report to Excel"
                }
              >
                {isExporting ? "Exporting..." : "Export Excel"}
              </button>
            </div>
          </div>
        </div>

        {dateError && <div className="mp-error-message">{dateError}</div>}
      </div>

      <div className={`mp-content-wrapper ${isLoading ? "mp-is-loading" : ""}`}>
        <AdCampaignOverview metrics={adMetrics} />

        <ChannelAnalysisSection
          channelStats={channelStats}
          period={period}
          canExport={canExport}
        />

        <TopCampaignsTable
          campaigns={campaigns}
          currentPage={campaignPage}
          totalPages={totalCampaignPages}
          onPageChange={onCampaignPageChange}
          adSpendLedger={adSpendLedger}
          canUpdate={permissions?.canUpdate ?? false}
        />

        <CampaignTrendSection
          campaignOptions={campaignOptions}
          selectedCampaignId={selectedCampaignId}
          onSelectCampaign={onSelectCampaign}
          campaignTrend={campaignTrend}
          isTrendLoading={isTrendLoading}
          period={period}
          canExport={canExport}
        />

        <CouponEffectiveness metrics={couponMetrics} />
        <TopCouponsTable
          coupons={coupons}
          currentPage={couponPage}
          totalPages={totalCouponPages}
          onPageChange={onCouponPageChange}
        />
      </div>
    </div>
  );
}
