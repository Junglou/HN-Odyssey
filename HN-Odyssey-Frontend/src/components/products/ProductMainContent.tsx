import { useState, useRef, useEffect } from "react";
import type {
  GridItem,
  CategoryTab,
} from "../../hooks/products/useProductList";
import { ArrowDownIcon, FilterIcon } from "../../assets/icons/ProductIcons";
import ProductCard from "./ProductCard";
import PromoCard from "./PromoCard";
import ProductPagination from "./ProductPagination";
import { useProductMain } from "../../hooks/products/useProductMain";
import "./ProductMainContent.css";

export default function ProductMainContent({
  gridItems,
  currentPage,
  totalPages,
  tabs,
  activeTabSlug,
  sortValue,
  onPageChange,
  onTabChange,
  onSortChange,
  onOpenFilter,
}: {
  gridItems: GridItem[];
  currentPage: number;
  totalPages: number;
  tabs: CategoryTab[];
  activeTabSlug: string;
  sortValue: string;
  onPageChange: (page: number) => void;
  onTabChange: (slug: string) => void;
  onSortChange: (val: string) => void;
  onOpenFilter: () => void;
}) {
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [hasSortOpened, setHasSortOpened] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Chỉ còn lấy sortOptions từ Mock, phần tabs đã được thay thế bằng dữ liệu động
  const { sortOptions } = useProductMain();

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

  return (
    <div className="pl-main-container">
      <div className="pl-header-bar">
        <div className="pl-quick-filters">
          <span className="pl-filter-label" onClick={onOpenFilter}>
            <FilterIcon />
            Filter
          </span>
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              className={`pl-chip ${activeTabSlug === tab.slug ? "active" : ""}`}
              onClick={() => onTabChange(tab.slug)}
            >
              {tab.name}
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
