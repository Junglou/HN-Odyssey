// imports
import { EditIcon, TrashIcon } from "../../assets/icons/ShoppingCartIcons";
import { MinusIcon, PlusIcon } from "../../assets/icons/CartIcons";
import type { DetailedCartItem } from "../../hooks/shoppingCart/useShoppingCart";
import "./CartItemList.css";

// interface
interface CartItemListProps {
  items: DetailedCartItem[];
  editingItemId: string | null;
  onRemove: (id: string) => void;
  onToggleEdit: (id: string) => void;
  onIncrease: (id: string) => void;
  onDecrease: (id: string) => void;
  onAddToWishlist: (id: string) => void;
}

// component
export default function CartItemList({
  items,
  editingItemId,
  onRemove,
  onToggleEdit,
  onIncrease,
  onDecrease,
  onAddToWishlist,
}: CartItemListProps) {
  // render
  return (
    <div className="cart-list-container">
      <h2 className="cart-list-title">Shopping cart ({items.length})</h2>

      <div className="cart-list-outer-bg">
        <div className="cart-list-white-box">
          {items.map((item) => (
            <div key={item.id} className="cart-list-item">
              <div className="cart-list-item-img">
                <img src={item.image} alt={item.name} />
              </div>

              <div className="cart-list-item-details">
                <div className="cart-list-item-header">
                  <h3 className="cart-list-item-name">{item.name}</h3>
                  <span className="cart-list-item-price">${item.price}</span>
                </div>

                <div className="cart-list-item-specs">
                  <p className="cart-list-item-text">
                    <span>Description:</span> {item.description}
                  </p>
                  <p className="cart-list-item-text">
                    <span>Contents:</span> {item.contents}
                  </p>
                  <p className="cart-list-item-text">
                    <span>Size:</span> {item.size}
                  </p>
                </div>

                <div className="cart-list-qty-wrapper">
                  <span className="cart-list-item-text">
                    <span>Quantity:</span> {item.quantity}
                  </span>
                  {editingItemId === item.id && (
                    <div className="cart-list-qty-controls">
                      <button onClick={() => onDecrease(item.id)}>
                        <MinusIcon />
                      </button>
                      <span>{item.quantity}</span>
                      <button onClick={() => onIncrease(item.id)}>
                        <PlusIcon />
                      </button>
                    </div>
                  )}
                </div>

                <div className="cart-list-item-actions">
                  <button
                    className={`cart-list-btn-black ${
                      editingItemId === item.id ? "active" : ""
                    }`}
                    onClick={() => onToggleEdit(item.id)}
                  >
                    <EditIcon /> {editingItemId === item.id ? "Done" : "Edit"}
                  </button>
                  <button
                    className="cart-list-btn-black"
                    onClick={() => onRemove(item.id)}
                  >
                    <TrashIcon /> Remove
                  </button>
                  <button
                    className="cart-list-link-wishlist"
                    onClick={() => onAddToWishlist(item.id)}
                  >
                    {item.isWishlisted
                      ? "Remove from Wishlist"
                      : "Add to Wishlist"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
