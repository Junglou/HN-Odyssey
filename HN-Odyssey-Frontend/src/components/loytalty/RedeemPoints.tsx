// imports
import { useLoyaltyLanding } from "../../hooks/loytalty/useLoyaltyLanding";
import { GiftRedeemIcon } from "../../assets/icons/LoyaltyIcons";
import "./RedeemPoints.css";

// component
export default function RedeemPoints() {
  // hooks
  const { rewards } = useLoyaltyLanding();

  // render
  return (
    <section className="redeem-section">
      <div className="redeem-container">
        <div className="redeem-header">
          <h2 className="redeem-title">Redeem Your Points</h2>
          <p className="redeem-subtitle">
            Turn your points into amazing rewards
          </p>
        </div>

        <div className="redeem-grid">
          {rewards.map((reward) => (
            <div key={reward.id} className="redeem-card">
              <div className="redeem-icon-wrap">
                <GiftRedeemIcon />
              </div>
              <h3 className="redeem-card-title">{reward.title}</h3>
              <p className="redeem-card-points">{reward.points}</p>
              <span className="redeem-card-note">{reward.note}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
