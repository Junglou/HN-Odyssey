import { useState } from "react";
import StockManagement from "../../../components/portal/Warehouse/StockManagement";
import QuickAdjustModal from "../../../components/portal/Warehouse/StockOverviewTab/QuickAdjustModal";
import CreateTicketDrawer from "../../../components/portal/Warehouse/StockTicketsTab/CreateTicketDrawer";
import { useStockOverview } from "../../../hooks/portal/Warehouse/useStockOverview";
import { useStockTickets } from "../../../hooks/portal/Warehouse/useStockTickets";
import { useRequestTab } from "../../../hooks/portal/Warehouse/useRequestTab";
import "./StockManagementPage.css";

// Thêm "requests" vào type
export type StockTabType = "requests" | "overview" | "tickets";

export default function StockManagementPage() {
  // states
  const [activeTab, setActiveTab] = useState<StockTabType>("requests");

  // hooks
  const requestsHook = useRequestTab();
  const overviewHook = useStockOverview();
  const ticketsHook = useStockTickets();

  const selectedItem = overviewHook.data.find(
    (item) => item.id === overviewHook.adjustModal.productId,
  );
  const displaySku =
    overviewHook.adjustModal.variantSku || selectedItem?.sku || "";
  const displayName = selectedItem?.productName || "";
  let currentStock = 0;
  let minStock: number | undefined = undefined;
  let maxStock: number | undefined = undefined;

  if (selectedItem) {
    if (overviewHook.adjustModal.variantSku && selectedItem.variants) {
      const variant = selectedItem.variants.find(
        (v) => v.sku === overviewHook.adjustModal.variantSku,
      );
      if (variant) {
        currentStock = variant.currentStock;
        minStock = variant.minStock;
        maxStock = variant.maxStock;
      }
    } else {
      currentStock = selectedItem.availableQuantity;
    }
  }

  // main render
  return (
    <div className="sm-page-container">
      {/* component layout */}
      <StockManagement
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        requests={requestsHook}
        overview={overviewHook}
        tickets={ticketsHook}
      />

      {/* modal tồn kho */}
      <QuickAdjustModal
        isOpen={overviewHook.adjustModal.isOpen}
        sku={displaySku}
        productName={displayName}
        currentStock={currentStock}
        minStock={minStock}
        maxStock={maxStock}
        onClose={overviewHook.actions.closeAdjustModal}
        onSubmit={overviewHook.actions.submitAdjustment}
      />

      {/* drawer tạo phiếu nhập/xuất */}
      <CreateTicketDrawer
        isOpen={ticketsHook.createDrawer.isOpen}
        type={ticketsHook.createDrawer.defaultType}
        onClose={ticketsHook.actions.closeCreateDrawer}
        onSubmit={ticketsHook.actions.submitTicket}
      />
    </div>
  );
}
