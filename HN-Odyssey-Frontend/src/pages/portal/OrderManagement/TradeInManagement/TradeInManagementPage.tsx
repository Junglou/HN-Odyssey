import TradeInManagement from "../../../../components/portal/OrderManagement/TradeInManagement/TradeInManagement";
import TradeInDetailDrawer from "../../../../components/portal/OrderManagement/TradeInManagement/TradeInDetailDrawer";
import ApproveValueModal from "../../../../components/portal/OrderManagement/TradeInManagement/ApproveValueModal";
import RejectTradeInModal from "../../../../components/portal/OrderManagement/TradeInManagement/RejectTradeInModal";
import FinalizeValueModal from "../../../../components/portal/OrderManagement/TradeInManagement/FinalizeValueModal";
import { useTradeInManagement } from "../../../../hooks/portal/OrderManagement/TradeInManagement/useTradeInManagement";
import "./TradeInManagementPage.css";

// component
export default function TradeInManagementPage() {
  const {
    data,
    filters,
    pagination,
    detailDrawer,
    selectedTradeIn,
    approveModal,
    rejectModal,
    finalizeModal,
    actions,
  } = useTradeInManagement();

  return (
    <div className="tim-page-container">
      <TradeInManagement
        data={data}
        filters={filters}
        pagination={pagination}
        actions={actions}
      />

      <TradeInDetailDrawer
        isOpen={detailDrawer.isOpen}
        onClose={actions.closeDetail}
        tradeInData={selectedTradeIn}
      />

      <ApproveValueModal
        isOpen={approveModal.isOpen}
        tradeInId={approveModal.tradeInId}
        onClose={actions.closeApproveModal}
        onConfirm={actions.confirmApprove}
      />

      <RejectTradeInModal
        isOpen={rejectModal.isOpen}
        tradeInId={rejectModal.tradeInId}
        onClose={actions.closeRejectModal}
        onConfirm={actions.confirmReject}
      />

      <FinalizeValueModal
        isOpen={finalizeModal.isOpen}
        tradeInId={finalizeModal.tradeInId}
        onClose={actions.closeFinalizeModal}
        onConfirm={actions.confirmFinalize}
      />
    </div>
  );
}
