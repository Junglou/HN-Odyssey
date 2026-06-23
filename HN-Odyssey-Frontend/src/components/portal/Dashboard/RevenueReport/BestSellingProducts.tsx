import "./BestSellingProducts.css";
import type { TopProduct } from "../../../../hooks/portal/Dashboard/RevenueReport/useRevenueReport";

interface BestSellingProductsProps {
  products: TopProduct[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSort?: (_key: keyof TopProduct) => void;
  sortKey?: keyof TopProduct | null;
  sortDirection?: "asc" | "desc";
}

export default function BestSellingProducts({
  products,
  currentPage,
  totalPages,
  onPageChange,
  onSort,
  sortKey,
  sortDirection,
}: BestSellingProductsProps) {
  // hàm render biểu tượng sort
  const renderSortIcon = (columnKey: keyof TopProduct) => {
    if (sortKey !== columnKey)
      return <span className="bsp-sort-icon bsp-inactive">↕</span>;
    return (
      <span className="bsp-sort-icon bsp-active">
        {sortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  return (
    <div className="bsp-wrapper">
      <div className="bsp-section-title">Best-Selling Products</div>
      <div className="bsp-table-wrapper">
        {!products || products.length === 0 ? (
          <div className="bsp-empty-state">
            không tìm thấy sản phẩm nào trong khoảng thời gian này
          </div>
        ) : (
          <>
            <table className="bsp-table">
              <thead>
                <tr>
                  <th onClick={() => onSort?.("rank")} className="bsp-sortable">
                    Rank {renderSortIcon("rank")}
                  </th>
                  <th onClick={() => onSort?.("name")} className="bsp-sortable">
                    Product Name {renderSortIcon("name")}
                  </th>
                  <th onClick={() => onSort?.("sku")} className="bsp-sortable">
                    SKU {renderSortIcon("sku")}
                  </th>
                  <th onClick={() => onSort?.("qty")} className="bsp-sortable">
                    Quantity Sold {renderSortIcon("qty")}
                  </th>
                  <th
                    onClick={() => onSort?.("revenue")}
                    className="bsp-sortable"
                  >
                    Total Revenue {renderSortIcon("revenue")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.rank}>
                    <td>{product.rank}</td>
                    <td>{product.name}</td>
                    <td>{product.sku}</td>
                    <td>{product.qty}</td>
                    <td className="bsp-revenue-cell">{product.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* điều khiển phân trang */}
            <div className="bsp-pagination-container">
              <button
                className="bsp-page-nav-btn"
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
              >
                Previous
              </button>

              <div className="bsp-page-numbers">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      className={`bsp-page-num-btn ${currentPage === page ? "bsp-active" : ""}`}
                      onClick={() => onPageChange(page)}
                    >
                      {page}
                    </button>
                  ),
                )}
              </div>

              <button
                className="bsp-page-nav-btn"
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
