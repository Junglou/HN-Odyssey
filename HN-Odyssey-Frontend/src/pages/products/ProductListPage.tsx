import { useState } from "react";
import { useProductList } from "../../hooks/products/useProductList";
import ProductSidebar from "../../components/products/ProductSidebar";
import ProductMainContent from "../../components/products/ProductMainContent";
import "./ProductListPage.css";

export default function ProductListPage() {
  const {
    gridItems,
    filterSections,
    tabs, // Truyền cấu trúc tabs động có mang theo tên và slug
    activeTabSlug, // Slug tab hiện tại
    currentPage,
    totalPages,
    selectedFilters,
    priceRange, // <-- Lấy state priceRange từ hook ra để truyền xuống Sidebar
    sortValue,
    handlePageChange,
    handleTabChange,
    handleFilterToggle,
    handlePriceChange, // <-- Lấy hàm xử lý thay đổi khoảng giá từ hook ra
    handleSortChange,
    handleClearFilters,
  } = useProductList();

  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

  return (
    <div className="pl-page-wrapper">
      <ProductSidebar
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        filterSections={filterSections}
        selectedOptions={selectedFilters}
        priceRange={priceRange} // <-- Truyền thuộc tính dữ liệu khoảng giá
        onOptionToggle={handleFilterToggle}
        onPriceChange={handlePriceChange} // <-- Truyền callback kích hoạt khi nhấn Apply giá
        onClearFilters={handleClearFilters}
      />
      <ProductMainContent
        gridItems={gridItems}
        currentPage={currentPage}
        totalPages={totalPages}
        tabs={tabs}
        activeTabSlug={activeTabSlug}
        sortValue={sortValue}
        onPageChange={handlePageChange}
        onTabChange={handleTabChange}
        onSortChange={handleSortChange}
        onOpenFilter={() => setIsMobileFilterOpen(true)}
      />
    </div>
  );
}
