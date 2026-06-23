// imports
import { Link } from "react-router-dom";
import "./OrderSummary.css";

// interface
interface OrderSummaryProps {
  subtotal: string;
  shippingFee: string;
  taxes: string;
  total: string;
  onCheckout: () => void;
}

// component
export default function OrderSummary({
  subtotal,
  shippingFee,
  taxes,
  total,
  onCheckout,
}: OrderSummaryProps) {
  // render
  return (
    <div className="cart-summary-box">
      <div className="cart-summary-billing">
        <div className="cart-summary-row">
          <span>Subtotal:</span>
          <span>{subtotal}$</span>
        </div>
        <div className="cart-summary-row">
          <span>Shipping fee:</span>
          <span>{shippingFee}</span>
        </div>
        <div className="cart-summary-row">
          <span>Taxes:</span>
          <span>{taxes}$</span>
        </div>
      </div>

      <div className="cart-summary-total-row">
        <span>Total:</span>
        <span>{total}$</span>
      </div>

      <div className="cart-summary-actions">
        <Link to="/profile/wishlist" className="cart-summary-btn-outline">
          GO TO WISHLIST
        </Link>
        <button className="cart-summary-btn-solid" onClick={onCheckout}>
          PROCESS TO CHECKOUT
        </button>
      </div>
    </div>
  );
}
