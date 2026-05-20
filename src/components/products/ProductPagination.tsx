// imports
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
  // Hàm tính toán các nút phân trang cần hiển thị để tránh vỡ layout
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(
          1,
          "...",
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages,
        );
      } else {
        pages.push(
          1,
          "...",
          currentPage - 1,
          currentPage,
          currentPage + 1,
          "...",
          totalPages,
        );
      }
    }
    return pages;
  };

  const pages = getPageNumbers();

  // Ẩn thanh phân trang nếu dữ liệu chỉ có 1 trang
  if (totalPages <= 1) return null;

  // render
  return (
    <div className="pl-pagination-container">
      <div className="pl-pagination-flex">
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
      </div>
    </div>
  );
}
