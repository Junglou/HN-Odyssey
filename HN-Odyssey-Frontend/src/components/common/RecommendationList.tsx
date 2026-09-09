import { useNavigate } from "react-router-dom";
import { useTracking, BehaviorAction } from "../../hooks/common/useTracking"; // [BỔ SUNG]
import "./RecommendationList.css";
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
  const { trackEvent } = useTracking(); // [BỔ SUNG] Hook tracking

  // [BỔ SUNG] Hàm xử lý click Feedback AI
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
            onClick={() => handleItemClick(item)} // [SỬA LẠI] Dùng hàm onClick mới
            style={{ cursor: "pointer" }}
          >
            {/* Ảnh sản phẩm */}
            <img src={item.image} alt={item.name} className="reco-img" />

            {/* Thông tin */}
            <div className="reco-info">
              {/* Tên sản phẩm */}
              <h4 className="reco-name">{item.name}</h4>

              {/* Mô tả */}
              <div className="reco-desc-block">
                <span className="reco-label">Description: </span>
                <span className="reco-mono-text">{item.description}</span>
              </div>

              {/* Giá */}
              <div className="reco-price-block">
                <div className="reco-label">Price: </div>
                <div className="reco-mono-text price-val">{item.price}$</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecommendationList;
