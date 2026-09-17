import { useHits } from "react-instantsearch";
import { Link } from "react-router-dom";
import axiosClient from "../../../api/axiosClient";
import "./SearchDropdown.css";

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

export default function SearchDropdown({
  isOpen,
  searchQuery,
  onClose,
}: SearchDropdownProps) {
  const { hits } = useHits<AlgoliaProductRecord>();

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
          <div className="search-dropdown-items">
            {hits.slice(0, 5).map((hit) => (
              <Link
                key={hit.objectID}
                to={`/products/${hit.slug}`}
                className="search-hit-item"
                onClick={() => handleHitClick(hit)}
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
