import { useHits } from "react-instantsearch";
import { Link } from "react-router-dom";
import "./SearchDropdown.css";

interface SearchDropdownProps {
  isOpen: boolean;
  searchQuery: string;
  onClose: () => void;
}

interface AlgoliaProductRecord {
  objectID: string;
  name: string;
  slug: string; // khai báo thêm trường slug để nhận dữ liệu từ algolia
  thumbnail?: string;
  price: number;
}

export default function SearchDropdown({
  isOpen,
  searchQuery,
  onClose,
}: SearchDropdownProps) {
  // Trích xuất kết quả từ ngữ cảnh Algolia InstantSearch
  const { hits } = useHits<AlgoliaProductRecord>();

  // Không hiển thị nếu dropdown đóng hoặc chưa nhập từ khóa
  if (!isOpen || !searchQuery.trim()) return null;

  return (
    <div className="search-dropdown-wrapper">
      {hits.length > 0 ? (
        <>
          <div className="search-dropdown-items">
            {hits.slice(0, 5).map((hit) => (
              <Link
                key={hit.objectID}
                to={`/products/${hit.slug}`} // chuyển hướng bằng slug thay vì objectID
                className="search-hit-item"
                onClick={onClose}
              >
                <div className="search-hit-img-box">
                  <img
                    src={
                      hit.thumbnail ||
                      "https://placehold.co/70x70/f3f4f6/000?text=Img"
                    }
                    alt={hit.name}
                  />
                </div>
                <div className="search-hit-info">
                  <span className="search-hit-name">{hit.name}</span>
                  <span className="search-hit-price">
                    {hit.price.toLocaleString("vi-VN")}đ
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="search-dropdown-footer">
            <Link
              to={`/products?keyword=${encodeURIComponent(searchQuery)}`}
              className="search-view-all-btn"
              onClick={onClose}
            >
              Xem tất cả kết quả
            </Link>
          </div>
        </>
      ) : (
        <div className="search-no-results">
          Không tìm thấy sản phẩm nào phù hợp.
        </div>
      )}
    </div>
  );
}
