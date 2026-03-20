import { useState, useRef, useEffect } from "react";
import "./ProductManagement.css";

import {
  ViewIcon,
  EditIcon,
  DotsIcon,
  TrashIcon,
} from "../../../../assets/icons/UserManagementIcons";
import { ChevronDownIcon } from "../../../../assets/icons/HeaderIcons";

// chỉ import type và cấu hình mảng tĩnh từ hook
import {
  type FilterStatus,
  type FilterPrice,
  type BulkAction,
  type ProductRowData,
  type DropdownOption,
  STATUS_OPTIONS,
  PRICE_OPTIONS,
  PAGE_OPTIONS,
} from "../../../../hooks/portal/ProductCatalog/ProductManagement/useProductManagement";

// props
interface ProductManagementProps {
  data: ProductRowData[];
  filters: {
    search: string;
    status: FilterStatus;
    price: FilterPrice;
  };
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    startIndex: number;
    endIndex: number;
    totalFiltered: number;
  };
  actions: {
    changeFilter: (key: "search" | "status" | "price", val: string) => void;
    clearFilter: () => void;
    changePage: (page: number) => void;
    changeLimit: (limit: number) => void;
    selectProduct: (id: number) => void;
    selectAll: (isAll: boolean) => void;
    toggleStatus: (id: number, status: string) => void;
    bulk: (action: BulkAction) => void;
    addProduct: () => void;
    viewProduct: (id: number) => void;
    editProduct: (id: number) => void;
    deleteSingle: (id: number) => void;
  };
}

// component dropdown phụ trợ cho filter
function CustomDropdown({
  value,
  options,
  onChange,
  className = "",
}: {
  value: string;
  options: DropdownOption[];
  onChange: (val: string) => void;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // tắt dropdown khi click ngoài vùng dropdown
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
    <div className={`pm-custom-dropdown ${className}`} ref={dropdownRef}>
      <div
        className={`pm-dropdown-trigger ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedLabel}</span>
        <ChevronDownIcon
          className={`pm-dropdown-arrow ${isOpen ? "open" : ""}`}
        />
      </div>
      {isOpen && (
        <div className="pm-dropdown-options">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`pm-dropdown-option ${value === opt.value ? "selected" : ""}`}
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

export default function ProductManagement({
  data,
  filters,
  pagination,
  actions,
}: ProductManagementProps) {
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  // tắt dropdown menu khi click ra ngoài bảng
  useEffect(() => {
    const handleClickOutside = () => {
      if (openDropdownId !== null) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openDropdownId]);

  // biến ui tính toán trạng thái
  const isAllSelected = data.length > 0 && data.every((p) => p.selected);
  const pageNumbers = Array.from(
    { length: pagination.totalPages },
    (_, i) => i + 1,
  );

  return (
    <div className="pm-container">
      <div className="pm-header">
        <div>
          <h1 className="pm-title">Product Management</h1>
          <p className="pm-breadcrumb">Product Catalog / Product Management</p>
        </div>
        <button
          type="button"
          className="pm-btn-add"
          onClick={actions.addProduct}
        >
          + Add New Product
        </button>
      </div>

      <div className="pm-filters-card">
        <div className="pm-filters-row">
          <input
            type="text"
            className="pm-filter-input"
            placeholder="Search by name, SKU"
            value={filters.search}
            onChange={(e) => actions.changeFilter("search", e.target.value)}
            aria-label="Search products"
          />
          <CustomDropdown
            value={filters.status}
            options={STATUS_OPTIONS}
            onChange={(val) => actions.changeFilter("status", val)}
            className="pm-filter-dropdown"
          />
          <CustomDropdown
            value={filters.price}
            options={PRICE_OPTIONS}
            onChange={(val) => actions.changeFilter("price", val)}
            className="pm-filter-dropdown"
          />
          <button
            type="button"
            className="pm-btn-clear"
            onClick={(e) => {
              actions.clearFilter();
              e.currentTarget.blur();
            }}
          >
            Clear Filter
          </button>
        </div>

        <div className="pm-bulk-actions">
          <button
            type="button"
            className="pm-btn-bulk"
            onClick={(e) => {
              actions.bulk("activate");
              e.currentTarget.blur();
            }}
          >
            Bulk Activate
          </button>
          <button
            type="button"
            className="pm-btn-bulk"
            onClick={(e) => {
              actions.bulk("deactivate");
              e.currentTarget.blur();
            }}
          >
            Bulk Deactivate
          </button>
          <button
            type="button"
            className="pm-btn-bulk delete"
            onClick={(e) => {
              actions.bulk("delete");
              e.currentTarget.blur();
            }}
          >
            Bulk Delete
          </button>
        </div>

        <div className="pm-table-wrapper">
          <table className="pm-table">
            <thead>
              <tr>
                <th>
                  <div className="pm-th-content">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={() => actions.selectAll(isAllSelected)}
                      aria-label="Select all products on this page"
                    />{" "}
                    <span>Image</span>
                  </div>
                </th>
                <th>
                  <div className="pm-th-content pm-sort-th">
                    <span>SKU</span>
                  </div>
                </th>
                <th>
                  <div className="pm-th-content pm-sort-th">
                    <span>Product Name</span>
                  </div>
                </th>
                <th>
                  <div className="pm-th-content pm-sort-th">
                    <span>Status</span>
                  </div>
                </th>
                <th>
                  <div className="pm-th-content pm-sort-th">
                    <span>Price</span>
                  </div>
                </th>
                <th>
                  <div className="pm-th-content">
                    <span>Actions</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? (
                data.map((prod) => (
                  <tr
                    key={prod.id}
                    className={prod.selected ? "pm-selected-row" : ""}
                  >
                    <td data-label="Image">
                      <div className="pm-td-flex">
                        <input
                          type="checkbox"
                          checked={prod.selected}
                          onChange={() => actions.selectProduct(prod.id)}
                          aria-label={`Select product ${prod.name}`}
                        />
                        <div className="pm-img-placeholder" aria-hidden="true">
                          <div className="pm-img-mock"></div>
                        </div>
                      </div>
                    </td>
                    <td data-label="SKU">{prod.sku}</td>
                    <td className="pm-td-name" data-label="Product Name">
                      {prod.name}
                    </td>{" "}
                    <td data-label="Status">
                      <span className={`pm-status-badge status-${prod.status}`}>
                        <span className="pm-dot" aria-hidden="true"></span>{" "}
                        {prod.status}
                      </span>
                    </td>
                    <td data-label="Price">{prod.price}</td>
                    <td data-label="Actions">
                      <div className="pm-action-group">
                        <button
                          type="button"
                          className="pm-icon-btn"
                          onClick={() => actions.viewProduct(prod.id)}
                          aria-label="View product details"
                        >
                          <ViewIcon stroke="#111827" />
                        </button>

                        <button
                          type="button"
                          className="pm-icon-btn"
                          onClick={() => actions.editProduct(prod.id)}
                          aria-label="Edit product"
                        >
                          <EditIcon stroke="#111827" />
                        </button>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={prod.status === "Active"}
                          aria-label="Toggle product status"
                          className={`pm-toggle-switch ${prod.status === "Active" ? "on" : ""} ${prod.status === "Draft" ? "disabled" : ""}`}
                          onClick={() =>
                            actions.toggleStatus(prod.id, prod.status)
                          }
                          disabled={prod.status === "Draft"}
                        ></button>

                        <div
                          className={`pm-dropdown-wrapper ${openDropdownId === prod.id ? "is-open" : ""}`}
                        >
                          <button
                            type="button"
                            className="pm-icon-btn"
                            aria-label="More actions"
                            aria-expanded={openDropdownId === prod.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(
                                openDropdownId === prod.id ? null : prod.id,
                              );
                            }}
                          >
                            <DotsIcon fill="#111827" />
                          </button>
                          {openDropdownId === prod.id && (
                            <div
                              className="pm-dropdown-menu"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="pm-dropdown-item pm-item-delete"
                                onClick={() => {
                                  actions.deleteSingle(prod.id);
                                  setOpenDropdownId(null);
                                }}
                              >
                                <TrashIcon stroke="#ffffff" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="pm-td-empty">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pm-pagination">
          <div>
            Showing{" "}
            {pagination.totalFiltered === 0 ? 0 : pagination.startIndex + 1}-
            {Math.min(pagination.endIndex, pagination.totalFiltered)} of{" "}
            {pagination.totalFiltered} products
          </div>
          <div className="pm-page-numbers">
            <button
              type="button"
              className="pm-page-num"
              style={{
                opacity: pagination.page === 1 ? 0.4 : 1,
                pointerEvents: pagination.page === 1 ? "none" : "auto",
              }}
              onClick={() =>
                actions.changePage(Math.max(pagination.page - 1, 1))
              }
            >
              &lt;
            </button>

            {pageNumbers.map((num) => (
              <button
                key={num}
                type="button"
                aria-label={`Go to page ${num}`}
                aria-current={pagination.page === num ? "page" : undefined}
                className={`pm-page-num ${pagination.page === num ? "active" : ""}`}
                onClick={() => actions.changePage(num)}
              >
                {num}
              </button>
            ))}

            <button
              type="button"
              className="pm-page-num"
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
              onClick={() =>
                actions.changePage(
                  Math.min(pagination.page + 1, pagination.totalPages),
                )
              }
            >
              &gt;
            </button>

            <CustomDropdown
              value={pagination.limit.toString()}
              options={PAGE_OPTIONS}
              onChange={(val) => actions.changeLimit(Number(val))}
              className="pm-page-dropdown"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
