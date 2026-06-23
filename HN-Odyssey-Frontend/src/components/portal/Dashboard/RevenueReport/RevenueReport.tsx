import "./RevenueReport.css";
import { CalendarIcon } from "../../../../assets/icons/RevenueIcons";
import type {
  RevenueMetric,
  TrendDataPoint,
  TopProduct,
} from "../../../../hooks/portal/Dashboard/RevenueReport/useRevenueReport";

// import 3 component con
import KeyRevenueMetrics from "./KeyRevenueMetrics";
import RevenueTrendAnalysis from "./RevenueTrendAnalysis";
import BestSellingProducts from "./BestSellingProducts";

interface RevenueReportProps {
  activeFilter: string;
  startDate: string;
  endDate: string;
  metrics: Record<string, RevenueMetric>;
  trendData: TrendDataPoint[];
  paginatedProducts: TopProduct[];
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  dateError: string | null;
  sortKey: keyof TopProduct | null;
  sortDirection: "asc" | "desc";
  onSort: (_key: keyof TopProduct) => void;
  onFilterChange: (_filter: string) => void;
  onStartDateChange: (_date: string) => void;
  onEndDateChange: (_date: string) => void;
  onApply: () => void;
  onPageChange: (page: number) => void;
}

export default function RevenueReport({
  activeFilter,
  startDate,
  endDate,
  metrics,
  trendData,
  paginatedProducts,
  currentPage,
  totalPages,
  isLoading,
  dateError,
  sortKey,
  sortDirection,
  onSort,
  onFilterChange,
  onStartDateChange,
  onEndDateChange,
  onApply,
  onPageChange,
}: RevenueReportProps) {
  const filterOptions = ["Today", "This Week", "This Month", "Custom Range"];

  return (
    <div className="rr-wrapper">
      <h1 className="rr-main-title">Revenue Report</h1>

      <div className="rr-card">
        <div className="rr-section-title">Global Time Filter</div>

        <div className="rr-filter-container">
          <div className="rr-filter-left">
            <span className="rr-filter-label">Time Period:</span>
            <div className="rr-filter-buttons">
              {filterOptions.map((opt) => (
                <button
                  key={opt}
                  className={`rr-filter-btn ${activeFilter === opt ? "rr-active" : ""}`}
                  onClick={() => onFilterChange(opt)}
                >
                  {activeFilter === opt ? opt : `[${opt}]`}
                </button>
              ))}
            </div>
          </div>

          <div className="rr-filter-right">
            <div
              className={`rr-date-wrapper ${dateError ? "rr-has-error" : ""}`}
            >
              <CalendarIcon color={dateError ? "#ef4444" : "#64748b"} />
              <input
                type="date"
                className="rr-date-input"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                readOnly={activeFilter !== "Custom Range"}
              />
            </div>
            <div
              className={`rr-date-wrapper ${dateError ? "rr-has-error" : ""}`}
            >
              <CalendarIcon color={dateError ? "#ef4444" : "#64748b"} />
              <input
                type="date"
                className="rr-date-input"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                readOnly={activeFilter !== "Custom Range"}
              />
            </div>

            <button
              className="rr-apply-btn"
              onClick={onApply}
              disabled={isLoading || !!dateError}
            >
              {isLoading ? "Loading..." : "Apply"}
            </button>
          </div>
        </div>

        {dateError && <div className="rr-error-message">{dateError}</div>}
      </div>

      <div className={`rr-content-wrapper ${isLoading ? "rr-is-loading" : ""}`}>
        {/* render 3 component con */}
        <KeyRevenueMetrics metrics={metrics} />
        <RevenueTrendAnalysis trendData={trendData} />
        <BestSellingProducts
          products={paginatedProducts}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={onSort}
        />
      </div>
    </div>
  );
}
