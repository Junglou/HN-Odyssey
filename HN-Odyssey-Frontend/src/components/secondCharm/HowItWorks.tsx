import { useSecondCharm } from "../../hooks/secondCharm/useSecondCharm";
import {
  CameraIcon,
  TruckIcon,
  RewardIcon,
} from "../../assets/icons/SecondCharmIcons";
import "./HowItWorks.css";

export default function HowItWorks() {
  const { steps } = useSecondCharm();

  const renderIcon = (id: number) => {
    switch (id) {
      case 1:
        return <CameraIcon />;
      case 2:
        return <TruckIcon />;
      case 3:
        return <RewardIcon />;
      default:
        return null;
    }
  };

  return (
    <section className="sc-hiw-section">
      <div className="sc-hiw-container">
        <div className="sc-hiw-header">
          <h2 className="sc-hiw-title">How It Works</h2>
          <p className="sc-hiw-subtitle">
            Three simple steps to get credit for your items
          </p>
        </div>

        <div className="sc-hiw-grid">
          {steps.map((step) => (
            <div key={step.id} className="sc-hiw-card">
              {/* boc icon va so */}
              <div className="sc-hiw-icon-wrapper">
                <div className="sc-hiw-icon-circle">{renderIcon(step.id)}</div>
                <div className="sc-hiw-step-number">{step.id}</div>
              </div>
              <h3 className="sc-hiw-card-title">{step.title}</h3>
              <p className="sc-hiw-card-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
