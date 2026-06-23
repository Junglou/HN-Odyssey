// imports
import { useLoyaltyLanding } from "../../hooks/loytalty/useLoyaltyLanding";
import {
  BronzeMedalIcon,
  SilverMedalIcon,
  GoldMedalIcon,
  CheckIcon,
} from "../../assets/icons/LoyaltyIcons";
import "./MembershipTiers.css";

// component
export default function MembershipTiers() {
  // hooks
  const { tiers } = useLoyaltyLanding();

  // render icon
  const renderMedal = (id: string) => {
    switch (id) {
      case "bronze":
        return <BronzeMedalIcon />;
      case "silver":
        return <SilverMedalIcon />;
      case "gold":
        return <GoldMedalIcon />;
      default:
        return null;
    }
  };

  // render
  return (
    <section className="tiers-section">
      <div className="tiers-container">
        <div className="tiers-header">
          <h2 className="tiers-title">Membership Tiers</h2>
          <p className="tiers-subtitle">
            The more you explore, the more you earn
          </p>
        </div>

        <div className="tiers-grid">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`tier-card ${tier.isPopular ? "popular" : ""}`}
            >
              {tier.isPopular && <div className="tier-badge">Most Popular</div>}

              <div className="tier-card-header">
                {renderMedal(tier.id)}
                <h3 className="tier-card-title">{tier.title}</h3>
                <p className="tier-card-spent">{tier.spent}</p>
              </div>

              <ul className="tier-benefits-list">
                {tier.benefits.map((benefit, idx) => (
                  <li key={idx}>
                    <CheckIcon />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
