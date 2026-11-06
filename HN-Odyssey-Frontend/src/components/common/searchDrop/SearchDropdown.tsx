import { useHits, useStats } from "react-instantsearch";
import { Link } from "react-router-dom";
import axiosClient from "../../../api/axiosClient";
import "./SearchDropdown.css";
import SmartImage from "../SmartImage/SmartImage";

interface SearchDropdownProps {
  isOpen: boolean;
  searchQuery: string;
  onClose: () => void;
}

interface AlgoliaProductRecord {
  objectID: string;
  name: string;
  slug: string;
  thumbnail?: string;
  price: number;
  __queryID?: string;
  __position?: number;
}

// Giá lưu bằng USD, hiển thị cùng kiểu với thẻ sản phẩm và giỏ hàng
const formatPrice = (value?: number) =>
  typeof value === "number"
    ? `$${value.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })}`
    : "";

export default function SearchDropdown({
  isOpen,
  searchQuery,
  onClose,
}: SearchDropdownProps) {
  const { hits } = useHits<AlgoliaProductRecord>();
  const { nbHits } = useStats();

  if (!isOpen || !searchQuery.trim()) return null;

  const handleHitClick = (hit: AlgoliaProductRecord) => {
    if (hit.__queryID) {
      axiosClient
        .post("/tracking/event", {
          session_id: localStorage.getItem("guestSessionId") || "guest",
          action: "CLICK_SEARCH_SUGGESTION",
          path: `/product/${hit.slug}`,
          device: window.innerWidth < 768 ? "MOBILE" : "DESKTOP",
          metadata: {
            product_id: hit.objectID,
            query_id: hit.__queryID,
            position: hit.__position || 1,
          },
        })
        .catch((err) => console.error("Search Tracking Error:", err));
    }
    onClose();
  };

  return (
    <div className="search-dropdown-wrapper">
      {hits.length > 0 ? (
        <>
          <div className="search-dropdown-head">
            <span className="search-dropdown-title">Products</span>
            <span className="search-dropdown-count">
              {nbHits} {nbHits === 1 ? "result" : "results"}
            </span>
          </div>

          <div className="search-dropdown-items">
            {hits.slice(0, 5).map((hit) => (
              <Link
                key={hit.objectID}
                to={`/products/${hit.slug}`}
                className="search-hit-item"
                onClick={() => handleHitClick(hit)}
              >
                <div className="search-hit-img-box">
                  <SmartImage
                    src={hit.thumbnail}
                    fallbackSrc="https://placehold.co/72x72/f3f4f6/000?text=Img"
                    alt={hit.name}
                    loading="eager"
                  />
                </div>
                <div className="search-hit-info">
                  <span className="search-hit-name">{hit.name}</span>
                  <span className="search-hit-price">
                    {formatPrice(hit.price)}
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
              View all results
            </Link>
          </div>
        </>
      ) : (
        <div className="search-no-results">
          <span className="search-no-results-title">
            No matching products found.
          </span>
          <span className="search-no-results-hint">
            Try a different keyword.
          </span>
        </div>
      )}
    </div>
  );
}
