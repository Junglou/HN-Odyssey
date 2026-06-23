// imports
import "./CheckoutSuccessCard.css";

// interfaces
interface CheckoutSuccessCardProps {
  onReturnHome: () => void;
}

// component
export default function CheckoutSuccessCard({
  onReturnHome,
}: CheckoutSuccessCardProps) {
  // render
  return (
    <div className="checkout-success-container">
      <div className="checkout-success-card">
        <h2 className="checkout-success-title">Thanks</h2>
        <p className="checkout-success-message">
          Your payment was successful. We'll send you an order confirmation
          shortly.
        </p>
        <button
          type="button"
          className="checkout-success-home-btn"
          onClick={onReturnHome}
        >
          RETURN TO HOME PAGE
        </button>
      </div>
    </div>
  );
}
