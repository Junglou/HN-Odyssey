import "./LiveActivityFeed.css";
import {
  ServerIcon,
  OrderIcon,
  AnnouncementIcon,
  AlertTriangleIcon,
} from "../../../../assets/icons/OverviewIcons";

interface SystemStage {
  id: string;
  type: string;
  title: string;
  desc: string;
  status: "active" | "offline";
}

interface LiveActivityFeedProps {
  activities: SystemStage[];
}

// lấy theme theo loại sự kiện
const getThemeClass = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes("order")) return "laf-theme-order";
  if (t.includes("announcement")) return "laf-theme-announcement";
  if (t.includes("alert")) return "laf-theme-alert";
  return "laf-theme-server";
};

// render icon tương ứng
const renderActivityIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes("order")) return <OrderIcon width={22} height={22} />;
  if (t.includes("announcement"))
    return <AnnouncementIcon width={22} height={22} />;
  if (t.includes("alert")) return <AlertTriangleIcon width={22} height={22} />;
  return <ServerIcon width={22} height={22} />;
};

export default function LiveActivityFeed({
  activities,
}: LiveActivityFeedProps) {
  return (
    <div className="laf-card">
      <div className="laf-card-title">System Pipeline Status</div>

      <div className="laf-wrapper">
        <div className="laf-container">
          {activities?.map((stage, idx) => {
            const themeClass = getThemeClass(stage.type);
            const isFirst = idx === 0;
            const isLast = idx === activities.length - 1;
            const offlineClass =
              stage.status === "offline" ? "laf-offline" : "";

            return (
              <div className={`laf-item ${offlineClass}`} key={stage.id}>
                {/* đường ngang */}
                {isFirst && <div className="laf-segment-start"></div>}
                {!isLast && (
                  <div className={`laf-segment-main ${themeClass}`}></div>
                )}
                {isLast && <div className="laf-segment-end"></div>}

                {/* node tròn và đường gióng */}
                <div className={`laf-node ${themeClass}`}></div>
                <div className="laf-drop-line"></div>

                {/* nội dung */}
                <div className="laf-content">
                  <div className={`laf-icon-box ${themeClass}`}>
                    {renderActivityIcon(stage.type)}
                  </div>
                  <div className="laf-text-wrapper">
                    <div className="laf-title">{stage.title}</div>
                    <div className="laf-desc">{stage.desc}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
