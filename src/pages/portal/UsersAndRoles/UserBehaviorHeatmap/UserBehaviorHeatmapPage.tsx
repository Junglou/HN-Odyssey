import UserBehaviorHeatmap from "../../../../components/portal/UsersAndRoles/UserBehaviorHeatmap/UserBehaviorHeatmap";
import { useUserBehaviorHeatmap } from "../../../../hooks/portal/UserAndRoles/UserBehaviorHeatmap/useUserBehaviorHeatmap";
import "./UserBehaviorHeatmapPage.css";

// container gọi hook và truyền data xuống ui
export default function UserBehaviorHeatmapPage() {
  const {
    selectedPage,
    setSelectedPage,
    device,
    setDevice,
    interactionType,
    setInteractionType,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    stats,
  } = useUserBehaviorHeatmap();

  return (
    <div className="ubh-page-container">
      <UserBehaviorHeatmap
        selectedPage={selectedPage}
        onPageChange={setSelectedPage}
        device={device}
        onDeviceChange={setDevice}
        interactionType={interactionType}
        onInteractionChange={setInteractionType}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        stats={stats}
      />
    </div>
  );
}
