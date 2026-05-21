// imports
import { useProductPagination } from "../../hooks/products/useProductPagination";
import "./ProductPagination.css";

// component hiển thị phân trang
export default function ProductPagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const { pages } = useProductPagination(currentPage, totalPages);

  // Ẩn thanh phân trang nếu dữ liệu chỉ có 1 trang
  if (totalPages <= 1) return null;

  // render
  return (
    <div className="pl-pagination-container">
      <div className="pl-pagination-flex">
        {/* Nút lùi trang */}
        <div
          className={`pl-page-item ${currentPage === 1 ? "disabled" : ""}`}
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
        >
          <span>&lt;</span>
        </div>

        {pages.map((page, idx) => {
          // Xử lý render phần tử dấu ba chấm
          if (page === "...") {
            return (
              <div key={`ellipse-${idx}`} className="pl-page-ellipse">
                <span>...</span>
              </div>
            );
          }

          // Xử lý render phần tử số trang
          return (
            <div
              key={page}
              className={`pl-page-item ${currentPage === page ? "active" : ""}`}
              onClick={() => onPageChange(page as number)}
            >
              <span>{page}</span>
            </div>
          );
        })}

        {/* Nút tiến trang */}
        <div
          className={`pl-page-item ${currentPage === totalPages ? "disabled" : ""}`}
          onClick={() =>
            currentPage < totalPages && onPageChange(currentPage + 1)
          }
        >
          <span>&gt;</span>
        </div>
      </div>
    </div>
  );
}
