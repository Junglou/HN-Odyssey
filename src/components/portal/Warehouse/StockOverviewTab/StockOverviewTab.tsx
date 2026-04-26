import React, { useState, useRef, useEffect } from "react";
import { useStockOverview } from "../../../../hooks/portal/Warehouse/useStockOverview";
import { ChevronDownIcon } from "../../../../assets/icons/HeaderIcons";
import {
  AdjustIcon,
  ExpandRowIcon,
  RefreshIcon,
} from "../../../../assets/icons/StockManagementIcons";
// import component Modal
import "./StockOverviewTab.css";

// options
const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "Gaming Mouse", label: "Gaming Mouse" },
  { value: "Mechanical Keyboard", label: "Mechanical Keyboard" },
  { value: "Accessories", label: "Accessories" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "in_stock", label: "In Stock" },
  { value: "low_stock", label: "Low Stock" },
  { value: "out_of_stock", label: "Out of Stock" },
];

// dropdown
function CustomDropdown({
  value,
  options,
  onChange,
  className = "",
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || options[0].label;

  return (
    <div className={`sot-custom-dropdown ${className}`} ref={dropdownRef}>
      <div
        className={`sot-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedLabel}</span>
        <ChevronDownIcon
          className={`sot-dropdown-arrow ${isOpen ? "open" : ""}`}
        />
      </div>
      {isOpen && (
        <div className="sot-dropdown-options">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`sot-dropdown-option ${value === opt.value ? "selected" : ""}`}
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

// props (đã bổ sung adjustModal)
interface StockOverviewTabProps {
  data: ReturnType<typeof useStockOverview>["data"];
  filters: ReturnType<typeof useStockOverview>["filters"];
  pagination: ReturnType<typeof useStockOverview>["pagination"];
  actions: ReturnType<typeof useStockOverview>["actions"];
}

export default function StockOverviewTab({
  data,
  filters,
  pagination,
  actions,
}: StockOverviewTabProps) {
  // states
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [closingRows, setClosingRows] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const limitRef = useRef<HTMLDivElement>(null);

  // handlers
  const toggleRow = (id: string) => {
    if (expandedRows.has(id)) {
      setClosingRows((prev) => new Set(prev).add(id));

      setTimeout(() => {
        setExpandedRows((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        setClosingRows((prev) => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
      }, 250);
    } else {
      setExpandedRows((prev) => new Set(prev).add(id));
    }
  };

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    actions.refreshData();
    setTimeout(() => setIsRefreshing(false), 500);
  };
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        limitRef.current &&
        !limitRef.current.contains(event.target as Node)
      ) {
        setIsLimitOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="sot-filters-card">
      {/* filters */}
      <div className="sot-filters-row">
        <input
          type="text"
          className="sot-filter-input"
          placeholder="Search SKU, Product Name..."
          value={filters.search}
          onChange={(e) => actions.changeFilter("search", e.target.value)}
        />

        <CustomDropdown
          value={filters.category}
          options={CATEGORY_OPTIONS}
          onChange={(val) => actions.changeFilter("category", val)}
          className="sot-filter-dropdown"
        />

        <CustomDropdown
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={(val) => actions.changeFilter("status", val)}
          className="sot-filter-dropdown"
        />

        <button
          type="button"
          className="sot-btn-clear"
          onClick={(e) => {
            actions.clearFilter();
            e.currentTarget.blur();
          }}
        >
          Clear Filters
        </button>

        <button
          type="button"
          className="sot-btn-clear sot-btn-refresh"
          onClick={(e) => {
            handleRefresh();
            e.currentTarget.blur();
          }}
        >
          <span
            className={isRefreshing ? "spin-icon-active" : ""}
            style={{ display: "flex" }}
          >
            <RefreshIcon />
          </span>
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* table */}
      <div className="sot-table-wrapper">
        <table className="sot-table">
          <thead>
            <tr>
              <th className="sot-col-expand" style={{ width: "5%" }}></th>
              <th style={{ width: "15%" }}>SKU</th>
              <th style={{ width: "25%" }}>Product Name</th>
              <th style={{ width: "15%" }}>Category</th>
              <th style={{ width: "10%" }}>Location</th>
              <th style={{ width: "15%" }}>Available / Total</th>
              <th style={{ width: "10%" }}>Status</th>
              <th className="sot-col-actions" style={{ width: "5%" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={8} className="sot-td-empty">
                  No data found
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <React.Fragment key={item.id}>
                  {/* main row */}
                  <tr className="sot-row-main">
                    <td className="sot-col-expand">
                      {item.variants && item.variants.length > 0 && (
                        <button
                          type="button"
                          className="sot-expand-btn"
                          onClick={(e) => {
                            toggleRow(item.id);
                            e.currentTarget.blur();
                          }}
                        >
                          <ExpandRowIcon isOpen={expandedRows.has(item.id)} />
                        </button>
                      )}
                    </td>
                    <td className="sot-cell-sku">{item.sku}</td>
                    <td className="sot-product-name">{item.productName}</td>
                    <td>{item.category}</td>
                    <td>{item.location}</td>
                    <td className="sot-cell-qty">
                      <span className="sot-highlight-qty">
                        {item.availableQuantity}
                      </span>{" "}
                      / {item.totalQuantity}
                    </td>
                    <td>
                      <span
                        className={`sot-status-badge status-${item.status}`}
                      >
                        <span className="sot-dot"></span>
                        {item.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="sot-col-actions">
                      {(!item.variants || item.variants.length === 0) && (
                        <button
                          type="button"
                          className="sot-icon-btn"
                          onClick={() => actions.openAdjustModal(item.id)}
                          title="Quick Adjust"
                        >
                          <AdjustIcon />
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* variants row */}
                  {expandedRows.has(item.id) && item.variants && (
                    <tr className="sot-row-variants">
                      <td
                        colSpan={8}
                        className={`sot-variants-container ${closingRows.has(item.id) ? "closing" : ""}`}
                      >
                        <table className="sot-variants-table">
                          <thead>
                            <tr>
                              <th>Variant SKU</th>
                              <th>Attributes</th>
                              <th>Stock</th>
                              <th>Min - Max</th>
                              <th className="sot-col-actions">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.variants.map((variant) => (
                              <tr key={variant.sku}>
                                <td>{variant.sku}</td>
                                <td>{variant.attributes}</td>
                                <td
                                  className={`sot-var-qty ${variant.currentStock <= variant.minStock ? "sot-var-qty-low" : ""}`}
                                >
                                  {variant.currentStock}
                                </td>
                                <td>
                                  {variant.minStock} - {variant.maxStock}
                                </td>
                                <td className="sot-col-actions">
                                  <button
                                    type="button"
                                    className="sot-icon-btn sot-icon-btn-sm"
                                    onClick={() =>
                                      actions.openAdjustModal(
                                        item.id,
                                        variant.sku,
                                      )
                                    }
                                    title="Adjust Variant"
                                  >
                                    <AdjustIcon />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className="sot-pagination">
        <div>
          Showing{" "}
          {pagination.total === 0
            ? 0
            : (pagination.page - 1) * pagination.limit + 1}
          -{Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
          {pagination.total} items
        </div>
        <div className="sot-page-numbers">
          <button
            type="button"
            className="sot-page-num"
            style={{
              opacity: pagination.page === 1 ? 0.4 : 1,
              pointerEvents: pagination.page === 1 ? "none" : "auto",
            }}
            onClick={(e) => {
              actions.changePage(Math.max(pagination.page - 1, 1));
              e.currentTarget.blur();
            }}
          >
            &lt;
          </button>

          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
            (num) => (
              <button
                key={num}
                type="button"
                className={`sot-page-num ${pagination.page === num ? "active" : ""}`}
                onClick={(e) => {
                  actions.changePage(num);
                  e.currentTarget.blur();
                }}
              >
                {num}
              </button>
            ),
          )}

          <button
            type="button"
            className="sot-page-num"
            style={{
              opacity:
                pagination.page === pagination.totalPages ||
                pagination.totalPages === 0
                  ? 0.4
                  : 1,
              pointerEvents:
                pagination.page === pagination.totalPages ||
                pagination.totalPages === 0
                  ? "none"
                  : "auto",
            }}
            onClick={(e) => {
              actions.changePage(
                Math.min(pagination.page + 1, pagination.totalPages),
              );
              e.currentTarget.blur();
            }}
          >
            &gt;
          </button>

          {/* limit dropdown */}
          <div className="sot-limit-dropdown" ref={limitRef}>
            <div
              className={`sot-limit-trigger ${isLimitOpen ? "active" : ""}`}
              onClick={() => setIsLimitOpen(!isLimitOpen)}
            >
              <span>{pagination.limit} / page</span>
              <ChevronDownIcon
                className={`sot-limit-icon ${isLimitOpen ? "open" : ""}`}
              />
            </div>
            {isLimitOpen && (
              <div className="sot-limit-options">
                {[10, 20, 50].map((val) => (
                  <div
                    key={val}
                    className={`sot-limit-option ${pagination.limit === val ? "active" : ""}`}
                    onClick={() => {
                      actions.changeLimit?.(val);
                      setIsLimitOpen(false);
                    }}
                  >
                    {val} / page
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
