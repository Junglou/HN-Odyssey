import "./MarketingAndPromotion.css";
import { CalendarIcon } from "../../../../assets/icons/RevenueIcons";
import type {
  AdOverviewMetrics,
  AdCampaign,
  CouponMetrics,
  CouponData,
} from "../../../../hooks/portal/Dashboard/MarketingAndPromotion/useMarketingAndPromotion";

import AdCampaignOverview from "./AdCampaignOverview";
import TopCampaignsTable from "./TopCampaignsTable";
import CouponEffectiveness from "./CouponEffectiveness";
import TopCouponsTable from "./TopCouponsTable";

interface MarketingAndPromotionProps {
  activeFilter: string;
  startDate: string;
  endDate: string;
  isLoading: boolean;
  dateError: string | null;
  adMetrics: AdOverviewMetrics;
  campaigns: AdCampaign[];
  couponMetrics: CouponMetrics;
  coupons: CouponData[];
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
}

export default function MarketingAndPromotion({
  activeFilter,
  startDate,
  endDate,
  isLoading,
  dateError,
  adMetrics,
  campaigns,
  couponMetrics,
  coupons,
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
}: MarketingAndPromotionProps) {
  const filterOptions = ["Today", "This Week", "This Month", "Custom Range"];

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

            <button
              className="mp-apply-btn"
              onClick={onApply}
              disabled={isLoading || !!dateError}
            >
              {isLoading ? "Loading..." : "Apply"}
            </button>
          </div>
        </div>

        {dateError && <div className="mp-error-message">{dateError}</div>}
      </div>

      <div className={`mp-content-wrapper ${isLoading ? "mp-is-loading" : ""}`}>
        <AdCampaignOverview metrics={adMetrics} />
        {/* Nối dây Props phân trang vào các Table */}
        <TopCampaignsTable
          campaigns={campaigns}
          currentPage={campaignPage}
          totalPages={totalCampaignPages}
          onPageChange={onCampaignPageChange}
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
