import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom"; // <-- Thêm thư viện đọc URL
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

  // [CẬP NHẬT QUAN TRỌNG]: Logic đón thông điệp từ Dashboard
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const sku = searchParams.get("sku");
    const action = searchParams.get("action");

    if (sku && action) {
      // 1. Tự động nhảy sang tab "Ticket History"
      setActiveTab("tickets");

      // 2. Mở Drawer Tạo phiếu Nhập/Xuất và bơm SKU vào
      if (action === "PO") {
        ticketsHook.actions.openCreateDrawer("import", sku);
      } else if (action === "TRANSFER") {
        ticketsHook.actions.openCreateDrawer("export", sku);
      }

      // 3. Xoá param trên URL để nếu người dùng F5 thì không bị tự động mở lại
      searchParams.delete("sku");
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Chỉ chạy 1 lần khi component mount

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
        initialSku={ticketsHook.createDrawer.initialSku} // <-- Truyền SKU vào Drawer
        onClose={ticketsHook.actions.closeCreateDrawer}
        onSubmit={ticketsHook.actions.submitTicket}
      />
    </div>
  );
}
