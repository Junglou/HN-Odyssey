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
  return (
    <div className="recommendation-container">
      <h3 className="reco-title">{title}</h3>
      <div className="reco-list">
        {products.map((item) => (
          <div key={item.id} className="reco-card">
            {/* Ảnh sản phẩm */}
            <img src={item.image} alt={item.name} className="reco-img" />

            {/* Thông tin */}
            <div className="reco-info">
              {/* Tên sản phẩm */}
              <h4 className="reco-name">{item.name}</h4>

              {/* Mô tả: Label đậm + Text monospace cùng dòng */}
              <div className="reco-desc-block">
                <span className="reco-label">Description: </span>
                <span className="reco-mono-text">{item.description}</span>
              </div>

              {/* Giá: Label đậm + Text monospace xuống dòng */}
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
