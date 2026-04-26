import { useState, useRef, useEffect } from "react";
import "./InventoryManagement.css";
import { CalendarIcon } from "../../../../assets/icons/RevenueIcons";
import { ChevronDownIcon } from "../../../../assets/icons/HeaderIcons";
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

function CustomDropdown({
  value,
  options,
  onChange,
  disabled = false,
  className = "",
}: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (val: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const handleToggle = () => {
    if (!disabled && !isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMenuStyle({
        position: "fixed",
        top: `${rect.bottom + 6}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 9999,
      });
    }
    if (!disabled) setIsOpen(!isOpen);
  };
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        optionsRef.current &&
        !optionsRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleScroll = () => {
      if (isOpen) setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", handleScroll, true);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || options[0].label;

  return (
    <div
      className={`im-custom-dropdown ${className} ${disabled ? "disabled" : ""}`}
      ref={containerRef}
    >
      <div
        className={`im-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={handleToggle}
      >
        <span>{selectedLabel}</span>
        <ChevronDownIcon
          className={`im-dropdown-arrow ${isOpen ? "open" : ""}`}
        />
      </div>

      {isOpen && !disabled && (
        <div className="im-dropdown-options" style={menuStyle} ref={optionsRef}>
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`im-dropdown-option ${value === opt.value ? "selected" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
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
  selectedWarehouse: string;
  onFilterChange: (val: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onApply: () => void;
  onWarehouseChange: (val: string) => void;
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
  selectedWarehouse,
  onFilterChange,
  onStartDateChange,
  onEndDateChange,
  onApply,
  onWarehouseChange,
}: InventoryManagementProps) {
  const filterOptions = ["Today", "This Week", "This Month", "Custom Range"];

  const warehouseOptions = [
    { label: "All Warehouses", value: "All Warehouses" },
    { label: "Warehouse A", value: "Warehouse A" },
    { label: "Warehouse B", value: "Warehouse B" },
  ];

  return (
    <div className="im-wrapper">
      {/* header */}
      <div className="im-header-row">
        <h1 className="im-main-title">Inventory Management</h1>
        <button
          className="im-btn-export"
          onClick={() => {
            alert(
              "Đang xuất báo cáo ra file Excel...\n(Tính năng này sẽ được kích hoạt khi nối API)",
            );
            console.log(
              "Xuất báo cáo Kho - Thời gian:",
              startDate,
              "đến",
              endDate,
            );
          }}
        >
          Export Report
        </button>
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
            <CustomDropdown
              value={selectedWarehouse}
              options={warehouseOptions}
              onChange={onWarehouseChange}
              disabled={isLoading}
            />

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
            <LowStockAlerts alerts={alerts} />
          </div>
        </div>
        <StockMovementTable data={tableData} />
      </div>
    </div>
  );
}
