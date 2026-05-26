import React, { useState, useRef, useEffect } from "react";
import { useStockOverview } from "../../../../hooks/portal/Warehouse/useStockOverview";
import { ChevronDownIcon } from "../../../../assets/icons/HeaderIcons";
import {
  AdjustIcon,
  ExpandRowIcon,
  RefreshIcon,
} from "../../../../assets/icons/StockManagementIcons";
import "./StockOverviewTab.css";

// Options lọc đã được khôi phục 3 trạng thái tốt nhất
const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "IN_STOCK", label: "In Stock" },
  { value: "LOW_STOCK", label: "Low Stock" },
  { value: "OUT_OF_STOCK", label: "Out of Stock" },
];

function CustomDropdown({
  value,
  options = [],
  onChange,
  className = "",
}: {
  value: string;
  options?: { value: string; label: string }[];
  onChange: (val: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
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
    options.find((opt) => opt.value === value)?.label ||
    options[0]?.label ||
    "Select";

  return (
    <div className={`sot-custom-dropdown ${className}`} ref={dropdownRef}>
      <div
        className={`sot-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!hasOpened) setHasOpened(true);
        }}
      >
        <span>{selectedLabel}</span>
        <ChevronDownIcon
          className={`sot-dropdown-arrow ${isOpen ? "open" : ""}`}
        />
      </div>
      <div
        className={`sot-dropdown-options ${isOpen ? "open" : hasOpened ? "closed" : ""}`}
      >
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
    </div>
  );
}

interface StockOverviewTabProps {
  data: ReturnType<typeof useStockOverview>["data"];
  filters: ReturnType<typeof useStockOverview>["filters"];
  pagination: ReturnType<typeof useStockOverview>["pagination"];
  actions: ReturnType<typeof useStockOverview>["actions"];
  categoriesOptions: { value: string; label: string }[];
}

export default function StockOverviewTab({
  data,
  filters,
  pagination,
  actions,
  categoriesOptions,
}: StockOverviewTabProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [closingRows, setClosingRows] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const [hasLimitOpened, setHasLimitOpened] = useState(false);
  const limitRef = useRef<HTMLDivElement>(null);

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
          options={categoriesOptions}
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
            className={`sot-d-flex ${isRefreshing ? "spin-icon-active" : ""}`}
          >
            <RefreshIcon />
          </span>
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="sot-table-wrapper">
        <table className="sot-table">
          <thead>
            <tr>
              <th className="sot-col-expand sot-col-5"></th>
              <th className="sot-col-15">SKU</th>
              <th className="sot-col-25">Product Name</th>
              <th className="sot-col-15">Category</th>
              <th className="sot-col-10">Location</th>
              <th className="sot-col-15">Available / Total</th>
              <th className="sot-col-10">Status</th>
              <th className="sot-col-actions sot-col-5">Actions</th>
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
                <React.Fragment key={item._id}>
                  {/* main row */}
                  <tr className="sot-row-main">
                    <td className="sot-col-expand">
                      {item.has_variants &&
                        item.variants &&
                        item.variants.length > 0 && (
                          <button
                            type="button"
                            className="sot-expand-btn"
                            onClick={(e) => {
                              toggleRow(item._id);
                              e.currentTarget.blur();
                            }}
                          >
                            <ExpandRowIcon
                              isOpen={expandedRows.has(item._id)}
                            />
                          </button>
                        )}
                    </td>
                    <td className="sot-cell-sku">{item.sku}</td>
                    <td>
                      <div className="sot-product-info">
                        {item.thumbnail && (
                          <img
                            src={item.thumbnail}
                            alt=""
                            className="sot-product-img"
                          />
                        )}
                        <span className="sot-product-name">{item.name}</span>
                      </div>
                    </td>
                    <td>{item.category}</td>
                    <td>{item.location}</td>
                    <td className="sot-cell-qty">
                      <span className="sot-highlight-qty">
                        {item.available_quantity}
                      </span>{" "}
                      / {item.total_quantity}
                    </td>
                    <td>
                      <span
                        className={`sot-status-badge status-${item.status_color.toLowerCase()}`}
                      >
                        <span className="sot-dot"></span>
                        {item.status_color.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="sot-col-actions">
                      {!item.has_variants && (
                        <button
                          type="button"
                          className="sot-icon-btn"
                          onClick={() =>
                            actions.openAdjustModal(
                              item._id,
                              item.sku,
                              item.name,
                              item.total_quantity, // Truyền đúng tên biến total_quantity
                              item.min_stock,
                              item.max_stock,
                            )
                          }
                          title="Quick Adjust"
                        >
                          <AdjustIcon />
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* variants row */}
                  {expandedRows.has(item._id) && item.variants && (
                    <tr className="sot-row-variants">
                      <td
                        colSpan={8}
                        className={`sot-variants-container ${closingRows.has(item._id) ? "closing" : ""}`}
                      >
                        <table className="sot-variants-table">
                          <thead>
                            <tr>
                              <th>Variant SKU</th>
                              <th>Available / Total</th>
                              <th>Status</th>
                              <th className="sot-col-actions">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.variants.map((variant) => (
                              <tr key={variant.sku}>
                                <td>{variant.sku}</td>
                                <td
                                  className={`sot-var-qty ${variant.total_stock <= (variant.min_stock || 0) ? "sot-var-qty-low" : ""}`}
                                >
                                  {variant.available_stock} /{" "}
                                  {variant.total_stock}
                                </td>
                                <td>
                                  <span
                                    className={`sot-status-badge status-${variant.statusColor.toLowerCase()}`}
                                  >
                                    <span className="sot-dot"></span>
                                    {variant.statusColor.replaceAll("_", " ")}
                                  </span>
                                </td>
                                <td className="sot-col-actions">
                                  <button
                                    type="button"
                                    className="sot-icon-btn sot-icon-btn-sm"
                                    onClick={() =>
                                      actions.openAdjustModal(
                                        item._id,
                                        variant.sku,
                                        item.name,
                                        variant.total_stock, // Truyền đúng tên biến total_stock
                                        variant.min_stock,
                                        variant.max_stock,
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

      <div className="sot-pagination">
        <div>
          Showing{" "}
          {pagination.total === 0
            ? 0
            : (pagination.page - 1) * pagination.limit + 1}
          - {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
          {pagination.total} items
        </div>
        <div className="sot-page-numbers">
          <button
            type="button"
            className="sot-page-num"
            onClick={(e) => {
              actions.changePage(Math.max(pagination.page - 1, 1));
              e.currentTarget.blur();
            }}
            disabled={pagination.page === 1}
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
            onClick={(e) => {
              actions.changePage(
                Math.min(pagination.page + 1, pagination.totalPages),
              );
              e.currentTarget.blur();
            }}
            disabled={
              pagination.page === pagination.totalPages ||
              pagination.totalPages === 0
            }
          >
            &gt;
          </button>

          <div className="sot-limit-dropdown" ref={limitRef}>
            <div
              className={`sot-limit-trigger ${isLimitOpen ? "active" : ""}`}
              onClick={() => {
                setIsLimitOpen(!isLimitOpen);
                if (!hasLimitOpened) setHasLimitOpened(true);
              }}
            >
              <span>{pagination.limit} / page</span>
              <ChevronDownIcon
                className={`sot-limit-icon ${isLimitOpen ? "open" : ""}`}
              />
            </div>
            <div
              className={`sot-limit-options ${isLimitOpen ? "open" : hasLimitOpened ? "closed" : ""}`}
            >
              {[10, 20, 50].map((val) => (
                <div
                  key={val}
                  className={`sot-limit-option ${pagination.limit === val ? "active" : ""}`}
                  onClick={() => {
                    actions.changeLimit(val);
                    setIsLimitOpen(false);
                  }}
                >
                  {val} / page
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
