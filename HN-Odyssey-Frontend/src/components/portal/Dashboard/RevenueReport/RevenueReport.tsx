import "./RevenueReport.css";
import { CalendarIcon } from "../../../../assets/icons/RevenueIcons";
import type {
  CashFlow,
  PaymentShare,
  RevenueMetric,
  TrendDataPoint,
  TrendGranularity,
  TopProduct,
  ChatbotSalesView,
} from "../../../../hooks/portal/Dashboard/RevenueReport/useRevenueReport";

import KeyRevenueMetrics from "./KeyRevenueMetrics";
import RevenueTrendAnalysis from "./RevenueTrendAnalysis";
import BestSellingProducts from "./BestSellingProducts";
import PaymentAnalysis from "./PaymentAnalysis";
import ChatbotSales from "./ChatbotSales";

interface RevenueReportProps {
  activeFilter: string;
  startDate: string;
  endDate: string;
  metrics: Record<string, RevenueMetric>;
  trendData: TrendDataPoint[];
  trendGranularity: TrendGranularity;
  period: string;
  comparisonLabel: string;
  paymentShares: PaymentShare[];
  cashFlow: CashFlow;
  chatbotSales?: ChatbotSalesView | null;
  paginatedProducts: TopProduct[];
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  isExporting?: boolean;
  dateError: string | null;
  sortKey: keyof TopProduct | null;
  sortDirection: "asc" | "desc";
  onSort: (_key: keyof TopProduct) => void;
  onFilterChange: (_filter: string) => void;
  onStartDateChange: (_date: string) => void;
  onEndDateChange: (_date: string) => void;
  onApply: () => void;
  onPageChange: (page: number) => void;
  handleExportExcel?: () => void;
  permissions?: { canExport: boolean };
}

export default function RevenueReport({
  activeFilter,
  startDate,
  endDate,
  metrics,
  trendData,
  trendGranularity,
  period,
  comparisonLabel,
  paymentShares,
  cashFlow,
  chatbotSales = null,
  paginatedProducts,
  currentPage,
  totalPages,
  isLoading,
  isExporting = false,
  dateError,
  sortKey,
  sortDirection,
  onSort,
  onFilterChange,
  onStartDateChange,
  onEndDateChange,
  onApply,
  onPageChange,
  handleExportExcel,
  permissions,
}: RevenueReportProps) {
  const filterOptions = ["Today", "This Week", "This Month", "Custom Range"];
  const canExport = permissions?.canExport ?? false;
  const exportDisabled = isLoading || isExporting || !canExport;

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

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                className="rr-apply-btn"
                onClick={onApply}
                disabled={isLoading || !!dateError}
              >
                {isLoading ? "Loading..." : "Apply"}
              </button>

              {/* US.95 AC1: Xuất Excel dữ liệu bảng */}
              <button
                className="rr-export-btn"
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

        {dateError && <div className="rr-error-message">{dateError}</div>}
      </div>

      <div className={`rr-content-wrapper ${isLoading ? "rr-is-loading" : ""}`}>
        {/* US.87 AC4: nhãn so sánh đúng theo kỳ đang xem */}
        <KeyRevenueMetrics
          metrics={metrics}
          comparisonLabel={comparisonLabel}
        />
        {/* US.95 AC2: nút Xuất PDF nằm ngay tại biểu đồ */}
        <RevenueTrendAnalysis
          trendData={trendData}
          granularity={trendGranularity}
          period={period}
          canExport={canExport}
        />
        {/* US.87 AC6, AC7: thanh toán & thực thu */}
        <PaymentAnalysis
          paymentShares={paymentShares}
          cashFlow={cashFlow}
          period={period}
          canExport={canExport}
        />
        {/* Doanh thu & đơn từ chatbot (dựa trên sales_channel) */}
        <ChatbotSales
          data={chatbotSales}
          granularity={trendGranularity}
          period={period}
          comparisonLabel={comparisonLabel}
          canExport={canExport}
        />
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
