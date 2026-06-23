import { useState } from "react";
import { ArrowDownIcon } from "../../assets/icons/ProductIcons";
import type { FilterSection } from "../../hooks/products/useProductList";
import "./ProductSidebar.css";

// 1. ĐỊNH NGHĨA INTERFACE CHO SUB-COMPONENT (CHẶN LỖI ESLINT 'ANY')
interface PriceRangeFilterProps {
  sectionMin: number;
  sectionMax: number;
  priceRange: [number, number] | null;
  onPriceChange: (min: number, max: number) => void;
}

// 2. SUB-COMPONENT RIÊNG CHO PRICE RANGE ĐỂ CÔ LẬP VÀ RESET STATE TỰ ĐỘNG QUA 'KEY'
function PriceRangeFilter({
  sectionMin,
  sectionMax,
  priceRange,
  onPriceChange,
}: PriceRangeFilterProps) {
  const [localMin, setLocalMin] = useState<string>(
    priceRange ? priceRange[0].toString() : "",
  );
  const [localMax, setLocalMax] = useState<string>(
    priceRange ? priceRange[1].toString() : "",
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "4px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <input
          type="number"
          placeholder={`$${sectionMin}`}
          value={localMin}
          onChange={(e) => setLocalMin(e.target.value)}
          style={{
            width: "100%",
            padding: "8px",
            border: "1px solid #e5e7eb",
            borderRadius: "4px",
            outline: "none",
          }}
        />
        <span style={{ color: "#6b7280" }}>-</span>
        <input
          type="number"
          placeholder={`$${sectionMax}`}
          value={localMax}
          onChange={(e) => setLocalMax(e.target.value)}
          style={{
            width: "100%",
            padding: "8px",
            border: "1px solid #e5e7eb",
            borderRadius: "4px",
            outline: "none",
          }}
        />
      </div>
      <button
        onClick={() => {
          const min = Number(localMin) || sectionMin;
          const max = Number(localMax) || sectionMax;
          onPriceChange(min, max);
        }}
        style={{
          width: "100%",
          padding: "8px",
          backgroundColor: "#111827",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        Apply
      </button>
    </div>
  );
}

// 3. COMPONENT CHÍNH PRODUCT SIDEBAR
export default function ProductSidebar({
  isOpen,
  onClose,
  filterSections,
  selectedOptions,
  priceRange,
  onOptionToggle,
  onPriceChange,
  onClearFilters,
}: {
  isOpen: boolean;
  onClose: () => void;
  filterSections: FilterSection[];
  selectedOptions: string[];
  priceRange: [number, number] | null;
  onOptionToggle: (id: string) => void;
  onPriceChange: (min: number, max: number) => void;
  onClearFilters: () => void;
}) {
  const [openIndexes, setOpenIndexes] = useState<number[]>([]);
  const [hasOpenedMap, setHasOpenedMap] = useState<Record<number, boolean>>({});

  const toggleSection = (index: number) => {
    setOpenIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
    setHasOpenedMap((prev) => ({ ...prev, [index]: true }));
  };

  const hasActiveFilters = selectedOptions.length > 0 || priceRange !== null;

  return (
    <>
      {isOpen && <div className="pl-sidebar-overlay" onClick={onClose}></div>}
      <aside className={`pl-sidebar-container ${isOpen ? "open" : ""}`}>
        <div className="pl-sidebar-header">
          <h2 className="pl-sidebar-title">Filters</h2>
          {/* 4. CHÈN NÚT CLEAR ALL VÀO ĐÂY */}
          {hasActiveFilters && (
            <button className="pl-sidebar-clear" onClick={onClearFilters}>
              Clear All
            </button>
          )}

          <span className="pl-sidebar-close" onClick={onClose}>
            &times;
          </span>
        </div>
        <div className="pl-filter-list">
          {filterSections.map((section, index) => {
            const isSectionOpen = openIndexes.includes(index);
            const hasSectionOpened = hasOpenedMap[index];
            return (
              <div key={section.id} className="pl-filter-item">
                <div
                  className={`pl-filter-trigger ${isSectionOpen ? "active" : ""}`}
                  onClick={() => toggleSection(index)}
                >
                  <span className="pl-filter-name">{section.name}</span>
                  <div
                    className={`pl-filter-icon ${isSectionOpen ? "rotated" : ""}`}
                  >
                    <ArrowDownIcon />
                  </div>
                </div>
                <div
                  className={`pl-filter-options-box ${
                    isSectionOpen ? "open" : hasSectionOpened ? "closed" : ""
                  }`}
                >
                  <div className="pl-filter-options-inner">
                    <div className="pl-filter-options-content">
                      {/* NẾU LÀ BỘ LỌC GIÁ -> VẼ SUB-COMPONENT VỚI KEY ĐỂ RESET STATE TỰ ĐỘNG */}
                      {section.type === "range_slider" ? (
                        <PriceRangeFilter
                          key={
                            priceRange
                              ? `${priceRange[0]}-${priceRange[1]}`
                              : "empty"
                          }
                          sectionMin={section.min || 0}
                          sectionMax={section.max || 999999}
                          priceRange={priceRange}
                          onPriceChange={onPriceChange}
                        />
                      ) : (
                        /* NẾU LÀ THUỘC TÍNH BÌNH THƯỜNG -> VẼ CHECKBOX */
                        section.options.map((option) => {
                          const isChecked = selectedOptions.includes(option.id);
                          return (
                            <label
                              key={option.id}
                              className="pl-filter-checkbox-label"
                              style={{
                                opacity: option.disabled ? 0.5 : 1,
                                cursor: option.disabled
                                  ? "not-allowed"
                                  : "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={option.disabled}
                                onChange={() => onOptionToggle(option.id)}
                                className="pl-filter-checkbox"
                              />
                              <span className="pl-filter-checkbox-text">
                                {option.label} ({option.count})
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
