import RequestTab from "./RequestTab/RequestTab";
import StockOverviewTab from "./StockOverviewTab/StockOverviewTab";
import StockTicketsTab from "./StockTicketsTab/StockTicketsTab";
import type { StockTabType } from "../../../pages/portal/Warehouse/StockManagementPage";
import { useRequestTab } from "../../../hooks/portal/Warehouse/useRequestTab";
import { useStockOverview } from "../../../hooks/portal/Warehouse/useStockOverview";
import { useStockTickets } from "../../../hooks/portal/Warehouse/useStockTickets";
import "./StockManagement.css";

// props
interface StockManagementProps {
  activeTab: StockTabType;
  onChangeTab: (tab: StockTabType) => void;
  requests: ReturnType<typeof useRequestTab>;
  overview: ReturnType<typeof useStockOverview>;
  tickets: ReturnType<typeof useStockTickets>;
}

export default function StockManagement({
  activeTab,
  onChangeTab,
  requests,
  overview,
  tickets,
}: StockManagementProps) {
  // main render
  return (
    <div className="sm-container">
      {/* header & breadcrumb */}
      <div className="sm-header">
        <div>
          <h1 className="sm-title">Stock Management (WMS)</h1>
          <p className="sm-breadcrumb">Warehouse (WMS) / Stock Management</p>
        </div>

        <div className="sm-header-actions">
          {activeTab === "tickets" && (
            <button
              className="sm-btn-primary"
              onClick={(e) => {
                tickets.actions.openCreateDrawer("import");
                e.currentTarget.blur();
              }}
            >
              + Create Ticket
            </button>
          )}
        </div>
      </div>

      {/* tabs navigation */}
      <div className="sm-tabs-nav">
        <button
          className={`sm-tab-btn ${activeTab === "requests" ? "sm-tab-active" : ""}`}
          onClick={() => onChangeTab("requests")}
        >
          Request Queue
        </button>
        <button
          className={`sm-tab-btn ${activeTab === "overview" ? "sm-tab-active" : ""}`}
          onClick={() => onChangeTab("overview")}
        >
          Total Stock Overview
        </button>
        <button
          className={`sm-tab-btn ${activeTab === "tickets" ? "sm-tab-active" : ""}`}
          onClick={() => onChangeTab("tickets")}
        >
          Ticket History
        </button>
      </div>

      {/* tab content */}
      <div className="sm-body">
        {activeTab === "requests" && (
          <RequestTab
            data={requests.data}
            filters={requests.filters}
            pagination={requests.pagination}
            actions={requests.actions}
            showHeader={false}
          />
        )}
        {activeTab === "overview" && (
          <StockOverviewTab
            data={overview.data}
            filters={overview.filters}
            pagination={overview.pagination}
            actions={overview.actions}
          />
        )}
        {activeTab === "tickets" && (
          <StockTicketsTab
            data={tickets.data}
            filters={tickets.filters}
            pagination={tickets.pagination}
            actions={tickets.actions}
          />
        )}
      </div>
    </div>
  );
}
