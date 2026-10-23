import { useRef, useState } from "react";
import "./PortalPagination.css";
import { useClickOutside } from "../../../../hooks/common/useClickOutside";
import { getPageItems } from "../../../../utils/pagination";

interface PortalPaginationProps {
  page: number;
  totalPages: number;
  // không truyền -> chế độ gọn: ẩn dòng "Showing ..." (bảng nhỏ trong Dashboard)
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  // không truyền -> ẩn dropdown "/ page"
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  // đơn vị hiển thị: "reviews", "users", "logs"...
  itemLabel?: string;
  // đang tải -> khóa thao tác
  disabled?: boolean;
}

const formatNumber = (n: number) => n.toLocaleString("en-US");

const ChevronLeft = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRight = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ChevronDown = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export default function PortalPagination({
  page,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  itemLabel,
  disabled = false,
}: PortalPaginationProps) {
  const [isLimitOpen, setIsLimitOpen] = useState(false);
  const [hasLimitOpened, setHasLimitOpened] = useState(false);
  const limitRef = useRef<HTMLDivElement>(null);
  useClickOutside(limitRef, () => setIsLimitOpen(false));

  // luôn có ít nhất 1 trang để UI không bị trống khi không có dữ liệu
  const safeTotalPages = Math.max(totalPages, 1);
  const currentPage = Math.min(Math.max(page, 1), safeTotalPages);
  const hasInfo = typeof totalItems === "number";
  const total = totalItems ?? 0;
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, total);
  const pageItems = getPageItems(currentPage, safeTotalPages);

  const goTo = (target: number) => {
    if (
      disabled ||
      target < 1 ||
      target > safeTotalPages ||
      target === currentPage
    )
      return;
    onPageChange(target);
  };

  return (
    <div
      className={`pp-pagination ${hasInfo ? "" : "no-info"} ${disabled ? "is-disabled" : ""}`}
    >
      {hasInfo && (
        <span className="pp-info">
          Showing {formatNumber(from)} to {formatNumber(to)} of{" "}
          {formatNumber(total)}
          {itemLabel ? ` ${itemLabel}` : ""}
        </span>
      )}

      <div className="pp-controls">
        <nav className="pp-pages" aria-label="Pagination">
          <button
            type="button"
            className="pp-page-btn pp-arrow"
            onClick={() => goTo(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </button>

          {pageItems.map((item, idx) =>
            item === "..." ? (
              <span key={`ellipsis-${idx}`} className="pp-ellipsis">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={`pp-page-btn ${item === currentPage ? "active" : ""}`}
                onClick={() => goTo(item)}
                aria-current={item === currentPage ? "page" : undefined}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            className="pp-page-btn pp-arrow"
            onClick={() => goTo(currentPage + 1)}
            disabled={currentPage >= safeTotalPages}
            aria-label="Next page"
          >
            <ChevronRight />
          </button>
        </nav>

        {onPageSizeChange && (
          <div className="pp-limit" ref={limitRef}>
            <button
              type="button"
              className={`pp-limit-trigger ${isLimitOpen ? "active" : ""}`}
              onClick={() => {
                setIsLimitOpen(!isLimitOpen);
                if (!hasLimitOpened) setHasLimitOpened(true);
              }}
            >
              <span>{pageSize} / page</span>
              <span className={`pp-limit-icon ${isLimitOpen ? "open" : ""}`}>
                <ChevronDown />
              </span>
            </button>

            <div
              className={`pp-limit-options ${isLimitOpen ? "open" : hasLimitOpened ? "closed" : ""}`}
              role="listbox"
            >
              {pageSizeOptions.map((size) => (
                <div
                  key={size}
                  role="option"
                  aria-selected={size === pageSize}
                  className={`pp-limit-option ${size === pageSize ? "active" : ""}`}
                  onClick={() => {
                    onPageSizeChange(size);
                    setIsLimitOpen(false);
                  }}
                >
                  {size} / page
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
