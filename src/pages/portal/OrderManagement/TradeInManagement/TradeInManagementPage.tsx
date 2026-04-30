import TradeInManagement from "../../../../components/portal/OrderManagement/TradeInManagement/TradeInManagement";
import TradeInDetailDrawer from "../../../../components/portal/OrderManagement/TradeInManagement/TradeInDetailDrawer";
import RejectTradeInModal from "../../../../components/portal/OrderManagement/TradeInManagement/RejectTradeInModal";
import FinalizeValueModal from "../../../../components/portal/OrderManagement/TradeInManagement/FinalizeValueModal";
import { useTradeInManagement } from "../../../../hooks/portal/OrderManagement/TradeInManagement/useTradeInManagement";
import "./TradeInManagementPage.css";

export default function TradeInManagementPage() {
  const {
    data,
    filters,
    pagination,
    detailDrawer,
    selectedTradeIn,
    rejectModal,
    finalizeModal,
    actions,
  } = useTradeInManagement();

  return (
    <div className="tim-page-container">
      {/* Component hiển thị bảng chính */}
      <TradeInManagement
        data={data}
        filters={filters}
        pagination={pagination}
        actions={actions}
      />

      {/* Drawer trượt hiển thị chi tiết */}
      <TradeInDetailDrawer
        isOpen={detailDrawer.isOpen}
        onClose={actions.closeDetail}
        tradeInData={selectedTradeIn}
      />

      {/* Modal từ chối yêu cầu Trade-in */}
      <RejectTradeInModal
        isOpen={rejectModal.isOpen}
        tradeInId={rejectModal.tradeInId}
        onClose={actions.closeRejectModal}
        onConfirm={actions.confirmReject}
      />

      {/* Modal chốt giá và hình thức quy đổi */}
      <FinalizeValueModal
        isOpen={finalizeModal.isOpen}
        tradeInId={finalizeModal.tradeInId}
        onClose={actions.closeFinalizeModal}
        onConfirm={actions.confirmFinalize}
      />
    </div>
  );
}
