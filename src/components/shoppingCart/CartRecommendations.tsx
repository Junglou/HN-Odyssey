// imports
import { PlusIconSmall } from "../../assets/icons/ShoppingCartIcons";
import type { RecommendItem } from "../../hooks/shoppingCart/useShoppingCart";
import "./CartRecommendations.css";

// interface
interface CartRecommendationsProps {
  items: RecommendItem[];
  onAdd: (item: RecommendItem) => void;
}

// component
export default function CartRecommendations({
  items,
  onAdd,
}: CartRecommendationsProps) {
  // render
  return (
    <div className="cart-rec-container">
      <h2 className="cart-rec-title">For you</h2>
      <div className="cart-rec-list">
        {items.map((item) => (
          <div key={item.id} className="cart-rec-card">
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
                  onClick={() => onAdd(item)}
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
