import RevenueReport from "../../../../components/portal/Dashboard/RevenueReport/RevenueReport";
import { useRevenueReport } from "../../../../hooks/portal/Dashboard/RevenueReport/useRevenueReport";
import "./RevenueReportPage.css";

export default function RevenueReportPage() {
  const {
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
    paginatedProducts,
    currentPage,
    totalPages,
    isLoading,
    isExporting,
    dateError,
    handleFilterChange,
    setStartDate,
    setEndDate,
    handleApply,
    handlePageChange,
    sortKey,
    sortDirection,
    handleSort,
    handleExportExcel,
    permissions,
  } = useRevenueReport();

  return (
    <div className="rrp-container">
      <RevenueReport
        activeFilter={activeFilter}
        startDate={startDate}
        endDate={endDate}
        metrics={metrics}
        trendData={trendData}
        trendGranularity={trendGranularity}
        period={period}
        comparisonLabel={comparisonLabel}
        paymentShares={paymentShares}
        cashFlow={cashFlow}
        paginatedProducts={paginatedProducts}
        currentPage={currentPage}
        totalPages={totalPages}
        isLoading={isLoading}
        isExporting={isExporting}
        dateError={dateError}
        onFilterChange={handleFilterChange}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={handleApply}
        onPageChange={handlePageChange}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        handleExportExcel={handleExportExcel}
        permissions={permissions}
      />
    </div>
  );
}
