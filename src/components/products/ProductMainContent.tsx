// imports
import { useState, useRef, useEffect } from "react";
import type { GridItem } from "../../hooks/products/useProductList";
import { ArrowDownIcon } from "../../assets/icons/ProductIcons";
import ProductCard from "./ProductCard";
import PromoCard from "./PromoCard";
import ProductPagination from "./ProductPagination";
import "./ProductMainContent.css";

// component
export default function ProductMainContent({
  gridItems,
  currentPage,
  totalPages,
  activeTabs,
  sortValue,
  onPageChange,
  onTabChange,
  onSortChange,
  onOpenFilter,
}: {
  gridItems: GridItem[];
  currentPage: number;
  totalPages: number;
  activeTabs: string[];
  sortValue: string;
  onPageChange: (page: number) => void;
  onTabChange: (tab: string) => void;
  onSortChange: (val: string) => void;
  onOpenFilter: () => void;
}) {
  // hooks - chỉ giữ state phục vụ đóng mở dropdown UI
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [hasSortOpened, setHasSortOpened] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tabs = ["All", "New arrivals", "Best sellers", "Tops", "Bottoms"];
  const sortOptions = ["Price: Low to High", "Price: High to Low", "Newest"];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // render
  return (
    <div className="pl-main-container">
      <div className="pl-header-bar">
        <div className="pl-quick-filters">
          <span
            className="pl-filter-label"
            onClick={onOpenFilter}
            style={{ cursor: "pointer" }}
          >
            Filter
          </span>
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              className={`pl-chip ${activeTabs.includes(tab) ? "active" : ""}`}
              onClick={() => onTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="pl-sort-wrapper" ref={dropdownRef}>
          <div
            className={`pl-sort-trigger ${isSortOpen ? "active" : ""}`}
            onClick={() => {
              setIsSortOpen(!isSortOpen);
              if (!hasSortOpened) setHasSortOpened(true);
            }}
          >
            <span>{sortValue}</span>
            <div className={`pl-sort-icon ${isSortOpen ? "rotated" : ""}`}>
              <ArrowDownIcon />
            </div>
          </div>
          <div
            className={`pl-sort-options ${
              isSortOpen ? "open" : hasSortOpened ? "closed" : ""
            }`}
          >
            {sortOptions.map((opt, idx) => (
              <div
                key={idx}
                className={`pl-sort-option ${sortValue === opt ? "active" : ""}`}
                onClick={() => {
                  onSortChange(opt);
                  setIsSortOpen(false);
                }}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pl-grid">
        {gridItems.map((item) => {
          if (item.type === "product")
            return <ProductCard key={item.id} product={item} />;
          if (item.type === "banner")
            return <PromoCard key={item.id} banner={item} />;
          return null;
        })}
      </div>

      <ProductPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
