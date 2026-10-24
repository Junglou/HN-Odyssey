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

  // Deep link vào trang Kho:
  //  - Từ Dashboard:  ?sku=XXX&action=PO|TRANSFER → mở phiếu Nhập/Xuất ở tab Ticket History
  //  - Từ thông báo:  ?sku=XXX (không có action)  → tab Total Stock Overview, lọc sẵn theo SKU
  const [searchParams, setSearchParams] = useSearchParams();

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    const sku = searchParams.get("sku");
    if (!sku) return;
    const action = searchParams.get("action");

    if (action === "PO" || action === "TRANSFER") {
      setActiveTab("tickets");
      ticketsHook.actions.openCreateDrawer(
        action === "PO" ? "import" : "export",
        sku,
      );
    } else {
      setActiveTab("overview");
      overviewHook.actions.changeFilter("search", sku);
    }

    // Xóa tham số để F5 không mở lại
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("sku");
        next.delete("action");
        return next;
      },
      { replace: true },
    );
    // Chạy lại mỗi khi URL đổi: bấm thông báo khi đang đứng sẵn ở trang Kho vẫn hoạt động
  }, [searchParams]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

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
