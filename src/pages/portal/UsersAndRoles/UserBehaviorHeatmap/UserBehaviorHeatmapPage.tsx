import { useState, useEffect } from "react";
import UserBehaviorHeatmap from "../../../../components/portal/UsersAndRoles/UserBehaviorHeatmap/UserBehaviorHeatmap";
import "./UserBehaviorHeatmapPage.css";

// Khai báo Union type
export type DeviceType = "Desktop" | "Mobile" | "Tablet";
export type InteractionType = "Click" | "Scroll" | "Hover";

// Mock data
const DEFAULT_STATS = {
  visits: "15,240",
  clicks: "4,580",
  duration: "3m 45s",
};

// Mock data
const STATS_DATA_MAP: Record<InteractionType, typeof DEFAULT_STATS> = {
  Click: { visits: "15,240", clicks: "4,580", duration: "3m 45s" },
  Scroll: { visits: "12,100", clicks: "1,200", duration: "4m 10s" },
  Hover: { visits: "18,500", clicks: "8,900", duration: "2m 30s" },
};

export default function UserBehaviorHeatmapPage() {
  // State lưu filter user đang chọn
  const [selectedPage, setSelectedPage] =
    useState<string>("Homepage (Current)");
  const [device, setDevice] = useState<DeviceType>("Desktop");
  const [interactionType, setInteractionType] =
    useState<InteractionType>("Click");

  // state lưu dữ liệu thống kế đang hiển thị
  const [stats, setStats] = useState(DEFAULT_STATS);
  useEffect(() => {
    const fetchStatsData = () => {
      setStats(STATS_DATA_MAP[interactionType]);
    };

    fetchStatsData();
  }, [selectedPage, device, interactionType]);

  // render component UI, truyền props
  return (
    <div className="ubh-page-container">
      <UserBehaviorHeatmap
        selectedPage={selectedPage}
        onPageChange={setSelectedPage}
        device={device}
        onDeviceChange={setDevice}
        interactionType={interactionType}
        onInteractionChange={setInteractionType}
        stats={stats}
      />
    </div>
  );
}
