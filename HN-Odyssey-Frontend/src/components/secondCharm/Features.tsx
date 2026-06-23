import { useSecondCharm } from "../../hooks/secondCharm/useSecondCharm";
import {
  DollarIcon,
  ZapIcon,
  ShieldIcon,
  LeafIcon,
} from "../../assets/icons/SecondCharmIcons";
import "./Features.css";

export default function Features() {
  const { features } = useSecondCharm();

  const renderIcon = (id: string) => {
    switch (id) {
      case "best_prices":
        return (
          <div className="sc-feature-icon green">
            <DollarIcon />
          </div>
        );
      case "fast_process":
        return (
          <div className="sc-feature-icon blue">
            <ZapIcon />
          </div>
        );
      case "secure":
        return (
          <div className="sc-feature-icon purple">
            <ShieldIcon />
          </div>
        );
      case "eco_friendly":
        return (
          <div className="sc-feature-icon green-light">
            <LeafIcon />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section className="sc-features-section">
      <div className="sc-features-container">
        <h2 className="sc-features-title">Why Choose Our Buy-Back Program?</h2>

        <div className="sc-features-grid">
          {features.map((feature) => (
            <div key={feature.id} className="sc-feature-card">
              {renderIcon(feature.id)}
              <h3 className="sc-feature-card-title">{feature.title}</h3>
              <p className="sc-feature-card-desc">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
