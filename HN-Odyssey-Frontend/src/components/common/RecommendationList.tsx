import { useNavigate } from "react-router-dom";
import { useTracking, BehaviorAction } from "../../hooks/common/useTracking";
import "./RecommendationList.css";
import SmartImage from "./SmartImage/SmartImage";
import type { Product } from "../../types/product";

interface RecommendationListProps {
  title?: string;
  products: Product[];
}

const RecommendationList = ({
  title = "Recommend for you",
  products,
}: RecommendationListProps) => {
  const navigate = useNavigate();
  const { trackEvent } = useTracking();

  // Click vào gợi ý: gửi tracking (feedback cho AI) rồi chuyển trang
  const handleItemClick = (item: Product) => {
    trackEvent({
      action: BehaviorAction.CLICK_SEARCH_SUGGESTION,
      path: window.location.pathname,
      metadata: {
        product_id: item.id,
        suggestion_type: "PRODUCT",
        source_widget: title, // Dùng title làm context
      },
    });

    navigate(`/products/${item.slug || item.id}`);
  };

  return (
    <div className="recommendation-container">
      <h3 className="reco-title">{title}</h3>
      <div className="reco-list">
        {products.map((item) => (
          <div
            key={item.id}
            className="reco-card"
            role="button"
            tabIndex={0}
            onClick={() => handleItemClick(item)}
            onKeyDown={(e) => e.key === "Enter" && handleItemClick(item)}
          >
            <SmartImage src={item.image} alt={item.name} className="reco-img" />

            <div className="reco-info">
              <h4 className="reco-name">{item.name}</h4>
              {item.description ? (
                <p className="reco-desc">{item.description}</p>
              ) : null}
              <div className="reco-price-block">
                <span className="reco-label">Price: </span>
                <span className="reco-price">{item.price}$</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecommendationList;
