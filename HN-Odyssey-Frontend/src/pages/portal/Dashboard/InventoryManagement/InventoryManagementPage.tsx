import "./InventoryManagementPage.css";
import InventoryManagement from "../../../../components/portal/Dashboard/InventoryManagement/InventoryManagement";
import { useInventoryManagement } from "../../../../hooks/portal/Dashboard/InventoryManagement/useInventoryManagement";

export default function InventoryManagementPage() {
  const {
    activeFilter,
    startDate,
    endDate,
    dateError,
    isLoading,
    kpis,
    trendData,
    alerts,
    tableData,
    handleFilterChange,
    handleStartDateChange,
    handleEndDateChange,
    handleApply,
    handleExportExcel,
    handleExportPdf,
    handleAlertAction,
    tablePage,
    tableTotalPages,
    isTableLoading,
    handleTablePageChange,
  } = useInventoryManagement();

  return (
    <div className="imp-container">
      <InventoryManagement
        activeFilter={activeFilter}
        startDate={startDate}
        endDate={endDate}
        dateError={dateError}
        isLoading={isLoading}
        kpis={kpis}
        trendData={trendData}
        alerts={alerts}
        tableData={tableData}
        onFilterChange={handleFilterChange}
        onStartDateChange={handleStartDateChange}
        onEndDateChange={handleEndDateChange}
        onApply={handleApply}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        onAlertAction={handleAlertAction}
        tablePage={tablePage}
        tableTotalPages={tableTotalPages}
        isTableLoading={isTableLoading}
        onTablePageChange={handleTablePageChange}
      />
    </div>
  );
}
