import Overview from "../../../../components/portal/Dashboard/Overview/Overview";
import { useOverview } from "../../../../hooks/portal/Dashboard/Overview/useOverview";
import "./OverviewPage.css";

export default function OverviewPage() {
  const {
    revenue,
    pipeline,
    alerts,
    inventoryBatches,
    inventoryHealth,
    recentTickets,
    pendingReturns,
    activities,
  } = useOverview();

  return (
    <div className="op-container">
      <Overview
        revenue={revenue}
        pipeline={pipeline}
        alerts={alerts}
        inventoryBatches={inventoryBatches}
        inventoryHealth={inventoryHealth}
        recentTickets={recentTickets}
        pendingReturns={pendingReturns}
        activities={activities}
      />
    </div>
  );
}
