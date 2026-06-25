import { useMemo } from "react";
import "./Loyalty.css";
import type { ProfileUser } from "../../../hooks/profile/useProfileManagement";
import type {
  LoyaltyHistoryItem,
  LoyaltyInfo,
} from "../../../hooks/profile/useLoyaltyManagement";
import { CrownIcon } from "../../../assets/icons/ProfileIcons";
interface TierBenefits {
  display: string;
  min: number;
  max: number | null;
  discount: string;
  freeShipping: boolean;
  birthdayBonus: boolean;
  prioritySupport: boolean;
}

interface LoyaltyProps {
  user: ProfileUser;
  loyaltyInfo: LoyaltyInfo;
  history: LoyaltyHistoryItem[];
}

interface ActivityRow {
  id: string;
  pointsLabel: string;
  description: string;
  timeLabel: string;
  positive: boolean;
}

const TIER_BY_CODE: Record<string, TierBenefits> = {
  BRONZE: {
    display: "Bronze",
    min: 0,
    max: 999,
    discount: "5%",
    freeShipping: false,
    birthdayBonus: false,
    prioritySupport: false,
  },
  SILVER: {
    display: "Silver",
    min: 1000,
    max: 2499,
    discount: "10%",
    freeShipping: true,
    birthdayBonus: false,
    prioritySupport: false,
  },
  GOLD: {
    display: "Gold",
    min: 2500,
    max: 4999,
    discount: "15%",
    freeShipping: true,
    birthdayBonus: true,
    prioritySupport: false,
  },
  PLATINUM: {
    display: "Platinum",
    min: 5000,
    max: null,
    discount: "20%",
    freeShipping: true,
    birthdayBonus: true,
    prioritySupport: true,
  },
};

const TIER_ORDER = ["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const;

const formatRelativeTime = (iso?: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-US");
};

const getActivityDescription = (item: LoyaltyHistoryItem): string => {
  // Ưu tiên hiển thị log chi tiết từ Backend nếu có
  if (item.description && item.description.trim() !== "") {
    return item.description;
  }

  // Fallback tiếng Anh nếu Backend không trả về description
  switch (item.type) {
    case "EARN":
      return item.orderId ? "Points earned from order" : "Points earned";
    case "REDEEM":
      return "Points redeemed for reward";
    case "REFUND":
      return item.orderId
        ? "Points adjusted for refund"
        : "Points adjusted for refund";
    case "EXPIRE":
      return "Points expired";
    case "BIRTHDAY":
      return "Birthday bonus points";
    default:
      return "Loyalty activity";
  }
};

const mapHistoryToActivity = (item: LoyaltyHistoryItem): ActivityRow => {
  const positive = item.amount >= 0;
  const absAmount = Math.abs(item.amount);
  return {
    id: item.id,
    pointsLabel: `${positive ? "+" : "-"}${absAmount.toLocaleString()} points`,
    description: getActivityDescription(item),
    timeLabel: formatRelativeTime(item.createdAt),
    positive,
  };
};

const getTierBySpend = (amountSpent: number): TierBenefits => {
  if (amountSpent >= 5000) return TIER_BY_CODE.PLATINUM;
  if (amountSpent >= 2500) return TIER_BY_CODE.GOLD;
  if (amountSpent >= 1000) return TIER_BY_CODE.SILVER;
  return TIER_BY_CODE.BRONZE;
};

const resolveTierBenefits = (
  tierCode: string,
  totalSpent: number,
): TierBenefits => {
  const key = tierCode.trim().toUpperCase();
  return TIER_BY_CODE[key] ?? getTierBySpend(totalSpent);
};

/** English label from tier code — ignores API `name` fields (often Vietnamese). */
const getTierDisplayName = (tierCode: string, totalSpent: number): string =>
  resolveTierBenefits(tierCode, totalSpent).display;

const getNextTierDisplayName = (tierCode: string): string | null => {
  const key = tierCode.trim().toUpperCase();
  const index = TIER_ORDER.indexOf(key as (typeof TIER_ORDER)[number]);
  if (index === -1 || index >= TIER_ORDER.length - 1) return null;
  return TIER_BY_CODE[TIER_ORDER[index + 1]].display;
};

const Loyalty = ({ user, loyaltyInfo, history }: LoyaltyProps) => {
  const tierCode = loyaltyInfo.tier;
  const totalSpent = loyaltyInfo.totalSpent;
  const points = loyaltyInfo.points;
  const amountNeeded = loyaltyInfo.progress.amountNeeded;

  const tierInfo = resolveTierBenefits(tierCode, totalSpent);
  const tierDisplayName = getTierDisplayName(tierCode, totalSpent);
  const nextTierName =
    amountNeeded > 0 ? getNextTierDisplayName(tierCode) : null;

  const activities = useMemo(
    () => history.map(mapHistoryToActivity),
    [history],
  );
  const hasNextTier = Boolean(nextTierName && amountNeeded > 0);
  const nextTarget = hasNextTier ? totalSpent + amountNeeded : null;

  const progressPercent =
    hasNextTier && nextTarget
      ? Math.min(
          100,
          ((totalSpent - tierInfo.min) / (nextTarget - tierInfo.min)) * 100,
        )
      : nextTierName
        ? 0
        : 100;

  const tierLevels = [
    { label: "Bronze", range: "$0 - $999", code: "BRONZE" },
    { label: "Silver", range: "$1,000 - $2,499", code: "SILVER" },
    { label: "Gold", range: "$2,500 - $4,999", code: "GOLD" },
    { label: "Platinum", range: "$5,000+", code: "PLATINUM" },
  ];

  const activeTierCode = tierCode.trim().toUpperCase();

  const benefits = [
    tierInfo.discount && {
      label: `${tierInfo.discount} discount`,
      detail: "On all regular priced items",
    },
    tierInfo.freeShipping && {
      label: "Free shipping",
      detail: "On all orders, no minimum",
    },
    tierInfo.birthdayBonus && {
      label: "Birthday bonus",
      detail: "Special gift on your birthday",
    },
    tierInfo.prioritySupport && {
      label: "Priority support",
      detail: "24/7 dedicated customer service",
    },
  ].filter(Boolean) as { label: string; detail: string }[];

  const displayName =
    user.fullName?.trim() ||
    `${user.first_Name} ${user.last_Name}`.trim() ||
    user.username ||
    "Member";

  return (
    <div className="my-loyalty">
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
                  <span>{tierDisplayName} member</span>
                </div>
                <div className="loyalty-points-label">Reward points</div>
              </div>
              <div className="loyalty-hero-value">
                {points.toLocaleString()}
              </div>
            </div>
            <div className="loyalty-hero-meta">
              <div>Welcome back, {displayName}</div>
              <div>
                Enjoy {tierInfo.discount} off all purchases
                {tierInfo.freeShipping && " and free shipping"}
              </div>
            </div>
          </div>

          <div className="loyalty-grid">
            {hasNextTier && nextTarget ? (
              <section className="my-loyalty-card progress-card">
                <div className="loyalty-card-head">
                  <div className="loyalty-card-title">
                    Progress to {nextTierName}
                  </div>
                  <div className="loyalty-card-subtitle">
                    ${totalSpent.toLocaleString()} of $
                    {nextTarget.toLocaleString()} spent
                  </div>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="progress-summary">
                  Spend ${amountNeeded.toLocaleString()} more to reach the{" "}
                  {nextTierName} tier
                </div>
              </section>
            ) : (
              <section className="my-loyalty-card progress-card">
                <div className="loyalty-card-head">
                  <div className="loyalty-card-title">Highest tier reached</div>
                  <div className="loyalty-card-subtitle">
                    You are at {tierDisplayName} with top benefits unlocked
                  </div>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: "100%" }} />
                </div>
                <div className="progress-summary">
                  You have maximum tier benefits
                </div>
              </section>
            )}

            <section className="my-loyalty-card loyalty-combined-stats-card">
              <div
                className={`loyalty-combined-stats${loyaltyInfo.pendingPoints > 0 ? " has-pending" : ""}`}
              >
                <div className="loyalty-stat-item">
                  <div className="loyalty-card-title">Total amount spent</div>
                  <div className="loyalty-card-value">
                    ${totalSpent.toLocaleString()}
                  </div>
                </div>
                {loyaltyInfo.pendingPoints > 0 && (
                  <>
                    <div className="loyalty-stat-divider" aria-hidden="true" />
                    <div className="loyalty-stat-item">
                      <div className="loyalty-card-title">Pending points</div>
                      <div className="loyalty-card-value">
                        {loyaltyInfo.pendingPoints.toLocaleString()}
                      </div>
                      <div className="loyalty-card-meta">
                        Available after order delivery
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>

          {loyaltyInfo.expiringSoonPoints > 0 && (
            <div className="loyalty-grid loyalty-grid-secondary">
              <section className="my-loyalty-card points-expiring-card">
                <div className="loyalty-card-top">
                  <div className="loyalty-card-title">Expiring soon</div>
                  <div className="loyalty-card-value">
                    {loyaltyInfo.expiringSoonPoints.toLocaleString()}
                  </div>
                </div>
                <div className="loyalty-card-meta">
                  Points expiring within 30 days
                </div>
              </section>
            </div>
          )}

          <section className="my-loyalty-card benefits-card">
            <div className="section-title">Your current benefits</div>
            <div className="benefit-list">
              {benefits.map((benefit) => (
                <div className="benefit-item" key={benefit.label}>
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
          <section className="my-loyalty-card">
            <div className="section-title">Tier levels</div>
            <div className="tier-list">
              {tierLevels.map((tier) => (
                <div
                  key={tier.code}
                  className={`tier-row ${activeTierCode === tier.code ? "active" : ""}`}
                >
                  <div className="tier-name">{tier.label}</div>
                  <div className="tier-range">{tier.range}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="my-loyalty-card activity-card">
            <div className="section-title">Recent activity</div>
            <div className="activity-list">
              {activities.length === 0 ? (
                <div className="loyalty-empty-activity">
                  No loyalty activity yet. Earn points when your orders are
                  completed.
                </div>
              ) : (
                activities.map((item) => (
                  <div key={item.id} className="activity-item">
                    <div
                      className={`activity-points ${item.positive ? "positive" : "negative"}`}
                    >
                      {item.pointsLabel}
                    </div>
                    <div className="activity-details">
                      <div className="activity-desc">{item.description}</div>
                      <div className="activity-time">{item.timeLabel}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Loyalty;
