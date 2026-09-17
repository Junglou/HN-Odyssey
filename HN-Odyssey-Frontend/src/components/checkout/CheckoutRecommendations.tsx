import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { CheckoutItem } from "../../hooks/checkout/useCheckout";
import axiosClient from "../../api/axiosClient";
import "./CheckoutRecommendations.css";

interface CheckoutRecommendationsProps {
  items: CheckoutItem[];
}

type CheckoutItemWithQueryID = CheckoutItem & {
  query_id?: string;
  queryID?: string;
  __queryID?: string;
};

export default function CheckoutRecommendations({
  items,
}: CheckoutRecommendationsProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    if (!items || items.length === 0 || hasTrackedView.current) return;

    const firstItem = items[0] as CheckoutItemWithQueryID;
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
              path: "/checkout",
              device: window.innerWidth < 768 ? "MOBILE" : "DESKTOP",
              metadata: {
                product_id: displayedIds,
                query_id: qId,
                suggestion_type: "CHECKOUT_RECOMMENDATION",
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

  const handleTrackAndNavigate = (item: CheckoutItem, index: number) => {
    const qId = (item as CheckoutItemWithQueryID).query_id;

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
    <div className="checkout-recommend-container" ref={containerRef}>
      <h3 className="checkout-recommend-title">You might also like</h3>

      <div className="checkout-recommend-list">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="checkout-recommend-card"
            onClick={() => handleTrackAndNavigate(item, index)}
            style={{ cursor: "pointer" }}
          >
            <div className="checkout-recommend-img-box">
              <img src={item.image} alt={item.name} />
            </div>

            <div className="checkout-recommend-info">
              <h4 className="checkout-recommend-name">{item.name}</h4>
              <p className="checkout-recommend-desc">{item.description}</p>

              <div className="checkout-recommend-meta">
                <span className="checkout-recommend-price">
                  Price: {item.price}$
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
