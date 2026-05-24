import { MinusIcon, PlusIcon } from "../../../assets/icons/CartIcons";
import type { CartItem } from "../../../hooks/common/cartDrop/useCart";
import CartConfirmModal from "./CartConfirmModal";
import "./CartDropdown.css";

interface CartDropdownProps {
  isOpen: boolean;
  items: CartItem[];
  subtotal: string;
  isDeleteModalOpen: boolean;
  onIncrease: (id: string) => void;
  onDecrease: (id: string) => void;
  onCloseDeleteModal: () => void;
  onConfirmDelete: () => void;
}

export default function CartDropdown({
  isOpen,
  items,
  subtotal,
  isDeleteModalOpen,
  onIncrease,
  onDecrease,
  onCloseDeleteModal,
  onConfirmDelete,
}: CartDropdownProps) {
  return (
    <div className={`cart-dropdown-wrapper ${isOpen ? "open" : ""}`}>
      <div className="cart-dropdown-items">
        {items.map((item) => (
          <div key={item.id} className="cart-item">
            <div className="cart-item-img-box">
              <img src={item.image} alt={item.name} />
            </div>
            <div className="cart-item-info">
              <h4 className="cart-item-name">{item.name}</h4>
              <p className="cart-item-desc">Description: {item.description}</p>

              <div className="cart-item-action">
                <span className="cart-item-price">Price: {item.price}$</span>
                <div className="cart-item-qty-box">
                  <span className="cart-item-qty-label">Amount:</span>
                  <div className="cart-item-qty-value">{item.quantity}</div>
                  <div className="cart-item-controls">
                    <button onClick={() => onIncrease(item.id)}>
                      <PlusIcon />
                    </button>
                    <button onClick={() => onDecrease(item.id)}>
                      <MinusIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-dropdown-footer">
        <div className="cart-subtotal">
          <span>Subtotal:</span>
          <span>{subtotal}$</span>
        </div>
        <button className="cart-btn-outline">GO TO SHOPPING CART</button>
        <button className="cart-btn-solid">PROCESS TO CHECKOUT</button>
      </div>

      {/* component modal xác nhận xóa */}
      <CartConfirmModal
        isOpen={isDeleteModalOpen}
        message="Are you sure you want to remove this item from your cart?"
        onClose={onCloseDeleteModal}
        onConfirm={onConfirmDelete}
      />
    </div>
  );
}
