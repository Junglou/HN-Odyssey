// imports
import { useNavigate } from "react-router-dom";
import "./LoyaltyHero.css";

// component
export default function LoyaltyHero() {
  const navigate = useNavigate();

  // render
  return (
    <section className="loyalty-hero-section">
      <div className="loyalty-hero-container">
        <h1 className="loyalty-hero-title">Loyalty program</h1>
        <p className="loyalty-hero-desc">
          Join our loyalty program and earn points on every survival gear
          purchase. Get exclusive access to new products, special discounts, and
          expert survival tips.
        </p>
        <button
          className="loyalty-hero-btn"
          onClick={() => navigate("/profile/loyalty")}
        >
          Join Now - It's Free
        </button>
      </div>
    </section>
  );
}
