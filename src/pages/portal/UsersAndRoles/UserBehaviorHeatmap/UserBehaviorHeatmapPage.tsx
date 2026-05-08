import UserBehaviorHeatmap from "../../../../components/portal/UsersAndRoles/UserBehaviorHeatmap/UserBehaviorHeatmap";
import { useUserBehaviorHeatmap } from "../../../../hooks/portal/UserAndRoles/UserBehaviorHeatmap/useUserBehaviorHeatmap";
import "./UserBehaviorHeatmapPage.css";

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
    pageOptions,
    interactionOptions,
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
        pageOptions={pageOptions}
        interactionOptions={interactionOptions}
      />
    </div>
  );
}
