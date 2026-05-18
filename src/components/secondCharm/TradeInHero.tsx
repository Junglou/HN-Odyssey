// imports
import { CheckCircleIcon } from "../../assets/icons/SecondCharmIcons";
import "./TradeInHero.css";

// component
export default function TradeInHero() {
  // render
  return (
    <section className="trade-in-hero-section">
      <div className="trade-in-hero-container">
        {/* Nửa trái: Nội dung text */}
        <div className="trade-in-hero-content">
          <h1 className="trade-in-hero-title">
            Turn Your Old Products Into Rewards
          </h1>
          <p className="trade-in-hero-desc">
            Get instant evaluation and earn loyalty points, exclusive coupons
            for your pre-owned items. Simple, fast, and eco-friendly.
          </p>

          <div className="trade-in-benefits-list">
            <div className="benefit-item">
              <CheckCircleIcon />
              <span>Free Evaluation</span>
            </div>
            <div className="benefit-item">
              <CheckCircleIcon />
              <span>Fast Process</span>
            </div>
            <div className="benefit-item">
              <CheckCircleIcon />
              <span>Eco-Friendly</span>
            </div>
          </div>
        </div>

        {/* Nửa phải: Box thống kê nổi */}
        <div className="trade-in-stats-wrapper">
          <div className="trade-in-stats-box">
            <div className="stat-main">
              <h2 className="stat-number">50M+</h2>
              <p className="stat-label">Points Rewarded</p>
            </div>
            <div className="stat-row">
              <div className="stat-item">
                <h3 className="stat-sub-number">15K+</h3>
                <p className="stat-sub-label">Items Recycled</p>
              </div>
              <div className="stat-item">
                <h3 className="stat-sub-number">98%</h3>
                <p className="stat-sub-label">Satisfaction</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
