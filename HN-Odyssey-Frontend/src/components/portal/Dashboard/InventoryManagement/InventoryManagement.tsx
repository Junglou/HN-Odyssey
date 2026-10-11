import "./InventoryManagement.css";
import { CalendarIcon } from "../../../../assets/icons/RevenueIcons";
import InventoryKPIs from "./InventoryKPIs";
import StockMovementTrend from "./StockMovementTrend";
import LowStockAlerts from "./LowStockAlerts";
import StockMovementTable from "./StockMovementTable";
import type {
  InventoryKPI,
  StockTrendData,
  InventoryAlert,
  StockMovementRow,
} from "../../../../hooks/portal/Dashboard/InventoryManagement/useInventoryManagement";

interface InventoryManagementProps {
  activeFilter: string;
  startDate: string;
  endDate: string;
  isLoading: boolean;
  dateError: string | null;
  kpis: InventoryKPI[];
  trendData: StockTrendData[];
  alerts: InventoryAlert[];
  tableData: StockMovementRow[];
  onFilterChange: (val: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onApply: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onAlertAction: (sku: string, type: "PO" | "TRANSFER") => void;
  tablePage: number;
  tableTotalPages: number;
  isTableLoading: boolean;
  onTablePageChange: (page: number) => void;
}

export default function InventoryManagement({
  activeFilter,
  startDate,
  endDate,
  isLoading,
  dateError,
  kpis,
  trendData,
  alerts,
  tableData,
  onFilterChange,
  onStartDateChange,
  onEndDateChange,
  onApply,
  onExportExcel,
  onExportPdf,
  onAlertAction,
  tablePage,
  tableTotalPages,
  isTableLoading,
  onTablePageChange,
}: InventoryManagementProps) {
  const filterOptions = ["Today", "This Week", "This Month", "Custom Range"];

  return (
    <div className="im-wrapper">
      {/* header */}
      <div className="im-header-row">
        <h1 className="im-main-title">Inventory Management</h1>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            className="im-btn-export"
            onClick={onExportExcel}
            disabled={isLoading}
            style={{ backgroundColor: "#10b981" }}
          >
            {isLoading ? "Loading..." : "Export Excel"}
          </button>

          <button
            className="im-btn-export"
            onClick={onExportPdf}
            disabled={isLoading}
            style={{ backgroundColor: "#ef4444" }}
          >
            {isLoading ? "Loading..." : "Export PDF"}
          </button>
        </div>
      </div>

      {/* filter */}
      <div className="im-card">
        <div className="im-section-title">Stock Movement Report</div>

        <div className="im-filter-container">
          <div className="im-filter-group">
            <div className="im-filter-buttons">
              {filterOptions.map((opt) => (
                <button
                  key={opt}
                  className={`im-filter-btn ${activeFilter === opt ? "active" : ""}`}
                  onClick={() => onFilterChange(opt)}
                  disabled={isLoading}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="im-date-group">
            <div
              className={`im-date-wrapper ${dateError ? "im-has-error" : ""}`}
            >
              <CalendarIcon color={dateError ? "#ef4444" : "#64748b"} />
              <input
                type="date"
                className="im-date-input"
                value={startDate}
                onChange={(e) => onStartDateChange(e.target.value)}
                readOnly={activeFilter !== "Custom Range"}
              />
            </div>

            <div
              className={`im-date-wrapper ${dateError ? "im-has-error" : ""}`}
            >
              <CalendarIcon color={dateError ? "#ef4444" : "#64748b"} />
              <input
                type="date"
                className="im-date-input"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                readOnly={activeFilter !== "Custom Range"}
              />
            </div>

            <button
              className="im-apply-btn"
              onClick={onApply}
              disabled={isLoading || !!dateError}
            >
              {isLoading ? "Loading..." : "Apply"}
            </button>
          </div>
        </div>
      </div>

      <div className={`im-content-wrapper ${isLoading ? "im-is-loading" : ""}`}>
        <InventoryKPIs kpis={kpis} />
        <div className="im-middle-wrapper">
          <div className="im-middle-grid">
            <StockMovementTrend data={trendData} />
            <LowStockAlerts alerts={alerts} onActionClick={onAlertAction} />
          </div>
        </div>
        <StockMovementTable
          data={tableData}
          currentPage={tablePage}
          totalPages={tableTotalPages}
          isLoading={isTableLoading}
          onPageChange={onTablePageChange}
        />
      </div>
    </div>
  );
}
