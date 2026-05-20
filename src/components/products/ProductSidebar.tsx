// imports
import { useState } from "react";
import { ArrowDownIcon } from "../../assets/icons/ProductIcons";
import "./ProductSidebar.css";

type FilterOption = { id: string; label: string; value: string };
type FilterSection = { id: string; name: string; options: FilterOption[] };

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
  // hooks (chỉ giữ lại UI state đóng mở, bỏ data state)
  const [openIndexes, setOpenIndexes] = useState<number[]>([]);
  const [hasOpenedMap, setHasOpenedMap] = useState<Record<number, boolean>>({});

  // mock data
  const filterSections: FilterSection[] = [
    {
      id: "size",
      name: "Size",
      options: [
        { id: "s1", label: "S", value: "S" },
        { id: "s2", label: "M", value: "M" },
        { id: "s3", label: "L", value: "L" },
        { id: "s4", label: "XL", value: "XL" },
      ],
    },
    {
      id: "color",
      name: "Color",
      options: [
        { id: "c1", label: "Blue", value: "blue" },
        { id: "c2", label: "Red", value: "red" },
        { id: "c3", label: "Green", value: "green" },
        { id: "c4", label: "Black", value: "black" },
      ],
    },
    {
      id: "material",
      name: "Material",
      options: [
        { id: "m1", label: "Cotton", value: "cotton" },
        { id: "m2", label: "Polyester", value: "polyester" },
      ],
    },
    {
      id: "fit",
      name: "Fit",
      options: [
        { id: "f1", label: "Regular", value: "regular" },
        { id: "f2", label: "Slim Fit", value: "slim" },
      ],
    },
    {
      id: "sport",
      name: "Sport",
      options: [
        { id: "sp1", label: "Running", value: "running" },
        { id: "sp2", label: "Training", value: "training" },
      ],
    },
  ];

  // actions
  const toggleSection = (index: number) => {
    setOpenIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
    setHasOpenedMap((prev) => ({ ...prev, [index]: true }));
  };

  // render
  return (
    <>
      {/* mobile backdrop */}
      {isOpen && <div className="pl-sidebar-overlay" onClick={onClose}></div>}

      <aside className={`pl-sidebar-container ${isOpen ? "open" : ""}`}>
        <div className="pl-sidebar-header">
          <h2 className="pl-sidebar-title">Filter</h2>
          <span className="pl-sidebar-close" onClick={onClose}>
            ✕
          </span>
        </div>

        <div className="pl-filter-list">
          {filterSections.map((section, idx) => {
            const isSectionOpen = openIndexes.includes(idx);
            const hasSectionOpened = hasOpenedMap[idx] || false;

            return (
              <div key={section.id} className="pl-filter-item">
                <div
                  className={`pl-filter-trigger ${isSectionOpen ? "active" : ""}`}
                  onClick={() => toggleSection(idx)}
                >
                  <span>{section.name}</span>
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
