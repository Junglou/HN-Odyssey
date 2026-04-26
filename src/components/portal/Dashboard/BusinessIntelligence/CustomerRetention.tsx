import "./CustomerRetention.css";
import type { RetentionData } from "../../../../hooks/portal/Dashboard/BusinessIntelligence/useBusinessIntelligence";

interface CustomerRetentionProps {
  data: RetentionData;
}

export default function CustomerRetention({ data }: CustomerRetentionProps) {
  if (!data) return null;

  const retPercent = data.returningVisitor;
  const newPercent = data.newVisitor;

  // config vẽ donut
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const gap = 5;

  const retDash = Math.max(0, (retPercent / 100) * circumference - gap);
  const newDash = Math.max(0, (newPercent / 100) * circumference - gap);
  const rotationAngle = (retPercent / 100) * 360;

  return (
    <div className="retention-wrapper">
      <div className="retention-title">Customer Retention Analysis</div>
      <div className="retention-card">
        <div className="retention-content">
          <div className="retention-column">
            <div className="retention-section-title">Avg. Revenue per User</div>
            <div className="retention-info">
              <div>
                New: <strong>({data.newRevenue})</strong>
              </div>
              <div>
                Returning: <strong>({data.returningRevenue})</strong>
              </div>
            </div>
          </div>

          <div className="retention-divider" />

          <div className="retention-column">
            <div className="retention-section-title">
              News vs. Returning Visitors
            </div>
            <div className="retention-donut-container">
              <div className="retention-donut-wrapper">
                <svg
                  className="retention-svg"
                  viewBox="0 0 100 100"
                  style={{ transform: "rotate(-90deg)" }}
                >
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke="#ebdcd0"
                    strokeWidth="16"
                    strokeDasharray={`${retDash} ${circumference}`}
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke="#c3aa95"
                    strokeWidth="16"
                    strokeDasharray={`${newDash} ${circumference}`}
                    transform={`rotate(${rotationAngle}, 50, 50)`}
                  />
                </svg>
                <div className="retention-center-text">
                  <span className="retention-center-val">{retPercent}%</span>
                  <span className="retention-center-lbl">Returning</span>
                </div>
              </div>

              <div className="retention-stats">
                <div className="retention-stat-item">
                  <div
                    className="retention-stat-dot"
                    style={{ background: "#ebdcd0" }}
                  />
                  Returning Visitor ({retPercent}%)
                </div>
                <div className="retention-stat-item">
                  <div
                    className="retention-stat-dot"
                    style={{ background: "#c3aa95" }}
                  />
                  New Visitor ({newPercent}%)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
