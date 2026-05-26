import { useState } from "react";
import StockManagement from "../../../components/portal/Warehouse/StockManagement";
import QuickAdjustModal from "../../../components/portal/Warehouse/StockOverviewTab/QuickAdjustModal";
import CreateTicketDrawer from "../../../components/portal/Warehouse/StockTicketsTab/CreateTicketDrawer";
import { useStockOverview } from "../../../hooks/portal/Warehouse/useStockOverview";
import { useStockTickets } from "../../../hooks/portal/Warehouse/useStockTickets";
import { useRequestTab } from "../../../hooks/portal/Warehouse/useRequestTab";
import "./StockManagementPage.css";

export type StockTabType = "requests" | "overview" | "tickets";

export default function StockManagementPage() {
  const [activeTab, setActiveTab] = useState<StockTabType>("requests");

  const requestsHook = useRequestTab();
  const overviewHook = useStockOverview();
  const ticketsHook = useStockTickets();

  return (
    <div className="sm-page-container">
      <StockManagement
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        requests={requestsHook}
        overview={overviewHook}
        tickets={ticketsHook}
      />

      <QuickAdjustModal
        isOpen={overviewHook.adjustModal.isOpen}
        sku={overviewHook.adjustModal.variantSku || ""}
        productName={overviewHook.adjustModal.productName}
        currentStock={overviewHook.adjustModal.currentStock}
        minStock={overviewHook.adjustModal.minStock}
        maxStock={overviewHook.adjustModal.maxStock}
        onClose={overviewHook.actions.closeAdjustModal}
        onSubmitAdjust={overviewHook.actions.submitAdjustment}
        onSubmitThreshold={overviewHook.actions.submitThresholds}
      />

      <CreateTicketDrawer
        isOpen={ticketsHook.createDrawer.isOpen}
        type={ticketsHook.createDrawer.defaultType}
        onClose={ticketsHook.actions.closeCreateDrawer}
        onSubmit={ticketsHook.actions.submitTicket}
      />
    </div>
  );
}
