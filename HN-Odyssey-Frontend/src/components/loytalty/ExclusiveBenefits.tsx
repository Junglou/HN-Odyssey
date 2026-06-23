// imports
import { useLoyaltyLanding } from "../../hooks/loytalty/useLoyaltyLanding";
import {
  EarlyAccessIcon,
  ExpertGuideIcon,
  CommunityIcon,
} from "../../assets/icons/LoyaltyIcons";
import "./ExclusiveBenefits.css";

// component
export default function ExclusiveBenefits() {
  // hooks
  const { benefits } = useLoyaltyLanding();

  // render icon
  const renderIcon = (id: number) => {
    switch (id) {
      case 1:
        return <EarlyAccessIcon />;
      case 2:
        return <ExpertGuideIcon />;
      case 3:
        return <CommunityIcon />;
      default:
        return null;
    }
  };

  // render
  return (
    <section className="eb-section">
      <div className="eb-container">
        <div className="eb-header">
          <h2 className="eb-title">Exclusive Member Benefits</h2>
          <p className="eb-subtitle">
            More than just points - get access to exclusive perks
          </p>
        </div>

        <div className="eb-grid">
          {benefits.map((benefit) => (
            <div key={benefit.id} className="eb-card">
              <div className="eb-icon">{renderIcon(benefit.id)}</div>
              <h3 className="eb-card-title">{benefit.title}</h3>
              <p className="eb-card-desc">{benefit.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
