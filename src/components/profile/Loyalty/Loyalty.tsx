import "./Loyalty.css";
import type { UserProfile } from "../../../types/user";
import { CrownIcon } from "../../../assets/icons/ProfileIcons";
interface LoyaltyProps {
  user: UserProfile;
}

const Loyalty = ({ user }: LoyaltyProps) => {
  const tierLevels = [
    { label: "Bronze", range: "$0 - $999" },
    { label: "Silver", range: "$1,000 - $2,499" },
    { label: "Gold", range: "$2,500 - $4,999", active: true },
    { label: "Platinum", range: "$5,000+" },
  ];

  const benefits = [
    { label: "15% Discount", detail: "On all regular priced items" },
    { label: "Free Shipping", detail: "On all orders, no minimum" },
    { label: "Birthday Bonus", detail: "Special gift on your birthday" },
  ];

  const recentActivities = [
    {
      points: "+150 points",
      description: "Purchase #ORD-001234",
      time: "2 days ago",
      positive: true,
    },
    {
      points: "-200 points",
      description: "Redeemed for discount",
      time: "1 week ago",
      positive: false,
    },
    {
      points: "+300 points",
      description: "Purchase #ORD-001189",
      time: "2 weeks ago",
      positive: true,
    },
  ];

  return (
    <div className="loyalty-card">
      <div className="loyalty-header">
        <h1 className="loyalty-title">Loyalty</h1>
      </div>

      <div className="loyalty-internal-grid">
        <div className="grid-section section-loyalty">
          <div className="loyalty-hero-card">
            <div className="loyalty-hero-header">
              <div className="loyalty-badge-row">
                <div className="loyalty-status-chip">
                  <CrownIcon width={18} height={18} />
                  <span>Gold Member</span>
                </div>
                <div className="loyalty-points-label">Points Balance</div>
              </div>
              <div className="loyalty-hero-value">2,450</div>
            </div>
            <div className="loyalty-hero-meta">
              <div>Member since January 2023</div>
              <div>Enjoy 15% off all purchases and free shipping</div>
            </div>
          </div>

          <div className="loyalty-grid">
            <section className="loyalty-card progress-card">
              <div className="loyalty-card-head">
                <div className="loyalty-card-title">Progress to Platinum</div>
                <div className="loyalty-card-subtitle">
                  $2,400 of $5,000 spent
                </div>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: "48%" }} />
              </div>
              <div className="progress-summary">
                Spend $2,600 more to reach Platinum tier
              </div>
            </section>

            <section className="loyalty-card points-expiring-card">
              <div className="loyalty-card-top">
                <div className="loyalty-card-title">Points Expiring Soon</div>
                <div className="loyalty-card-value">150 points</div>
              </div>
              <div className="loyalty-card-meta">Expire on March 15, 2024</div>
            </section>
          </div>

          <section className="loyalty-card benefits-card">
            <div className="section-title">Your Current Benefits</div>
            <div className="benefit-list">
              {benefits.map((benefit) => (
                <div className="benefit-item" key={benefit.label}>
                  <div className="benefit-icon" />
                  <div>
                    <div className="benefit-name">{benefit.label}</div>
                    <div className="benefit-detail">{benefit.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid-section section-progress">
          <section className="loyalty-card tier-card">
            <div className="section-title">Tier Levels</div>
            <div className="tier-list">
              {tierLevels.map((tier) => (
                <div
                  key={tier.label}
                  className={`tier-row ${tier.active ? "active" : ""}`}
                >
                  <div className="tier-name">{tier.label}</div>
                  <div className="tier-range">{tier.range}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="loyalty-card activity-card">
            <div className="section-title">Recent Activity</div>
            <div className="activity-list">
              {recentActivities.map((item) => (
                <div key={item.description} className="activity-item">
                  <div
                    className={`activity-points ${item.positive ? "positive" : "negative"}`}
                  >
                    {item.points}
                  </div>
                  <div className="activity-details">
                    <div className="activity-desc">{item.description}</div>
                    <div className="activity-time">{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Loyalty;
