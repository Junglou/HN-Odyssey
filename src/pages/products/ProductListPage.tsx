// imports
import { useState } from "react";
import { useProductList } from "../../hooks/products/useProductList";
import ProductSidebar from "../../components/products/ProductSidebar";
import ProductMainContent from "../../components/products/ProductMainContent";
import "./ProductListPage.css";

// container
export default function ProductListPage() {
  // hooks
  const {
    gridItems,
    currentPage,
    totalPages,
    activeTabs,
    selectedFilters,
    sortValue, // lấy state sort
    handlePageChange,
    handleTabChange,
    handleFilterToggle,
    handleSortChange, // lấy hàm cập nhật sort
  } = useProductList();

  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // render
  return (
    <div className="pl-page-wrapper">
      <ProductSidebar
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        selectedOptions={selectedFilters}
        onOptionToggle={handleFilterToggle}
      />
      <ProductMainContent
        gridItems={gridItems}
        currentPage={currentPage}
        totalPages={totalPages}
        activeTabs={activeTabs}
        sortValue={sortValue} // truyền xuống UI
        onPageChange={handlePageChange}
        onTabChange={handleTabChange}
        onSortChange={handleSortChange} // truyền xuống UI
        onOpenFilter={() => setIsMobileFilterOpen(true)}
      />
    </div>
  );
}
