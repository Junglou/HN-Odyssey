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
    selectedWarehouse,
    handleFilterChange,
    handleStartDateChange,
    handleEndDateChange,
    handleApply,
    handleWarehouseChange,
    handleExportExcel,
    handleExportPdf,
    handleAlertAction, // <-- 1. Bóc tách hàm xử lý điều hướng từ hook
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
        selectedWarehouse={selectedWarehouse}
        onFilterChange={handleFilterChange}
        onStartDateChange={handleStartDateChange}
        onEndDateChange={handleEndDateChange}
        onApply={handleApply}
        onWarehouseChange={handleWarehouseChange}
        onExportExcel={handleExportExcel}
        onExportPdf={handleExportPdf}
        onAlertAction={handleAlertAction} // <-- 2. Truyền hàm xuống component con
      />
    </div>
  );
}
