// imports
import { useLoyaltyLanding } from "../../hooks/loytalty/useLoyaltyLanding";
import {
  UserSignUpIcon,
  ShopEarnIcon,
  ReachTierIcon,
  GiftRedeemIcon,
} from "../../assets/icons/LoyaltyIcons";
import "./HowItWorks.css";

// component
export default function HowItWorks() {
  // hooks
  const { steps } = useLoyaltyLanding();

  // render icon theo ID
  const renderIcon = (id: number) => {
    switch (id) {
      case 1:
        return <UserSignUpIcon />;
      case 2:
        return <ShopEarnIcon />;
      case 3:
        return <ReachTierIcon />;
      case 4:
        return <GiftRedeemIcon />;
      default:
        return null;
    }
  };

  // render
  return (
    <section className="hiw-section">
      <div className="hiw-container">
        <div className="hiw-header">
          <h2 className="hiw-title">How Explorer Rewards Works</h2>
          <p className="hiw-subtitle">
            Simple steps to start earning rewards on your survival gear
            purchases
          </p>
        </div>

        <div className="hiw-grid">
          {steps.map((step) => (
            <div key={step.id} className="hiw-card">
              <div className="hiw-icon-wrap">{renderIcon(step.id)}</div>
              <h3 className="hiw-card-title">{step.title}</h3>
              <p className="hiw-card-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
