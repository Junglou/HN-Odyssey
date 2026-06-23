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
    paginatedProducts,
    currentPage,
    totalPages,
    isLoading,
    dateError,
    handleFilterChange,
    setStartDate,
    setEndDate,
    handleApply,
    handlePageChange,
    sortKey,
    sortDirection,
    handleSort,
  } = useRevenueReport();

  return (
    <div className="rrp-container">
      <RevenueReport
        activeFilter={activeFilter}
        startDate={startDate}
        endDate={endDate}
        metrics={metrics}
        trendData={trendData}
        paginatedProducts={paginatedProducts}
        currentPage={currentPage}
        totalPages={totalPages}
        isLoading={isLoading}
        dateError={dateError}
        onFilterChange={handleFilterChange}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={handleApply}
        onPageChange={handlePageChange}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
    </div>
  );
}
