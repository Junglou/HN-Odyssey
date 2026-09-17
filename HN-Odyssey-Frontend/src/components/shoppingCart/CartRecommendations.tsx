import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PlusIconSmall } from "../../assets/icons/ShoppingCartIcons";
import type { RecommendItem } from "../../hooks/shoppingCart/useShoppingCart";
import axiosClient from "../../api/axiosClient";
import "./CartRecommendations.css";

interface CartRecommendationsProps {
  items: RecommendItem[];
  onAdd: (item: RecommendItem) => void;
}

type RecommendItemWithQueryID = RecommendItem & {
  query_id?: string;
  queryID?: string;
  __queryID?: string;
};

export default function CartRecommendations({
  items,
  onAdd,
}: CartRecommendationsProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    if (!items || items.length === 0 || hasTrackedView.current) return;

    const firstItem = items[0] as RecommendItemWithQueryID;
    const qId = firstItem.query_id || firstItem.queryID || firstItem.__queryID;

    if (!qId) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasTrackedView.current) {
          const displayedIds = items
            .slice(0, 20)
            .map((i) => i.id)
            .join(",");

          axiosClient
            .post("/tracking/event", {
              session_id: localStorage.getItem("guestSessionId") || "guest",
              action: "VIEW_PAGE",
              path: "/cart",
              device: window.innerWidth < 768 ? "MOBILE" : "DESKTOP",
              metadata: {
                product_id: displayedIds,
                query_id: qId,
                suggestion_type: "CART_RECOMMENDATION",
              },
            })
            .catch(() => {});

          hasTrackedView.current = true;
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [items]);

  const handleTrackAndNavigate = (item: RecommendItem, index: number) => {
    const qId = (item as RecommendItemWithQueryID).query_id;

    axiosClient
      .post("/tracking/event", {
        session_id: localStorage.getItem("guestSessionId") || "guest",
        action: qId ? "CLICK_SEARCH_SUGGESTION" : "VIEW_PRODUCT",
        path: `/product/${item.slug || item.id}`,
        device: window.innerWidth < 768 ? "MOBILE" : "DESKTOP",
        metadata: {
          product_id: item.id,
          query_id: qId,
          position: index + 1,
        },
      })
      .catch((err) => console.error("Tracking Error:", err));

    navigate(`/products/${item.slug || item.id}`);
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="cart-rec-container" ref={containerRef}>
      <h2 className="cart-rec-title">For you</h2>
      <div className="cart-rec-list">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="cart-rec-card"
            onClick={() => handleTrackAndNavigate(item, index)}
            style={{ cursor: "pointer" }}
          >
            <div className="cart-rec-img-box">
              <img src={item.image} alt={item.name} />
            </div>
            <div className="cart-rec-info">
              <h4 className="cart-rec-name">{item.name}</h4>
              <p className="cart-rec-desc">{item.description}</p>

              <div className="cart-rec-action-row">
                <span className="cart-rec-price">Price: {item.price}$</span>
                <button
                  className="cart-rec-add-btn"
                  onClick={(e) => {
                    e.stopPropagation();

                    const qId = (item as RecommendItemWithQueryID).query_id;
                    if (qId) {
                      axiosClient
                        .post("/tracking/event", {
                          session_id:
                            localStorage.getItem("guestSessionId") || "guest",
                          action: "CLICK_ADD_TO_CART",
                          path: `/product/${item.slug || item.id}`,
                          device:
                            window.innerWidth < 768 ? "MOBILE" : "DESKTOP",
                          metadata: {
                            product_id: item.id,
                            query_id: qId,
                            position: index + 1,
                          },
                        })
                        .catch((err) => console.error("Tracking Error:", err));
                    }

                    onAdd(item);
                  }}
                >
                  <PlusIconSmall />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
