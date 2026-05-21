// imports
import { useState } from "react";
import { ArrowDownIcon } from "../../assets/icons/ProductIcons";
import { useProductSidebar } from "../../hooks/products/useProductSidebar";
import "./ProductSidebar.css";

// component
export default function ProductSidebar({
  isOpen,
  onClose,
  selectedOptions,
  onOptionToggle,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedOptions: string[];
  onOptionToggle: (id: string) => void;
}) {
  const { filterSections } = useProductSidebar();

  // hooks (chỉ giữ lại UI state đóng mở, bỏ data state)
  const [openIndexes, setOpenIndexes] = useState<number[]>([]);
  const [hasOpenedMap, setHasOpenedMap] = useState<Record<number, boolean>>({});

  const toggleSection = (index: number) => {
    setOpenIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
    setHasOpenedMap((prev) => ({ ...prev, [index]: true }));
  };

  // render
  return (
    <>
      {isOpen && <div className="pl-sidebar-overlay" onClick={onClose}></div>}
      <aside className={`pl-sidebar-container ${isOpen ? "open" : ""}`}>
        <div className="pl-sidebar-header">
          <h2 className="pl-sidebar-title">Filters</h2>
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
                      {section.options.map((option) => {
                        const isChecked = selectedOptions.includes(option.id);
                        return (
                          <label
                            key={option.id}
                            className="pl-filter-checkbox-label"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => onOptionToggle(option.id)}
                              className="pl-filter-checkbox"
                            />
                            <span className="pl-filter-checkbox-text">
                              {option.label}
                            </span>
                          </label>
                        );
                      })}
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
