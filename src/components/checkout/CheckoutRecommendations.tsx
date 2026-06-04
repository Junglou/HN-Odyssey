// imports
import { useNavigate } from "react-router-dom"; // 1. Thêm import
import type { CheckoutItem } from "../../hooks/checkout/useCheckout";
import "./CheckoutRecommendations.css";

// interfaces
interface CheckoutRecommendationsProps {
  items: CheckoutItem[];
}

// component
export default function CheckoutRecommendations({
  items,
}: CheckoutRecommendationsProps) {
  const navigate = useNavigate(); // 2. Khởi tạo navigate

  // render
  return (
    <div className="checkout-recommend-container">
      <h3 className="checkout-recommend-title">You might also like</h3>

      <div className="checkout-recommend-list">
        {items.map((item) => (
          <div
            key={item.id}
            className="checkout-recommend-card"
            onClick={() => navigate(`/products/${item.slug || item.id}`)} // 3. Gắn click chuyển trang
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
