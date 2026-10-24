import OrderManagement from "../../../../components/portal/OrderManagement/OrderManagement/OrderManagement";
import OrderDetailDrawer from "../../../../components/portal/OrderManagement/OrderManagement/OrderDetailDrawer";
import UpdateStatusModal from "../../../../components/portal/OrderManagement/OrderManagement/UpdateStatusModal";
import { useOrderManagement } from "../../../../hooks/portal/OrderManagement/OrderManagement/useOrderManagement";
import "./OrderManagementPage.css";

export default function OrderManagementPage() {
  const {
    data,
    isLoading,
    filters,
    pagination,
    detailDrawer,
    selectedOrder,
    statusModal,
    actions,
    permissions,
  } = useOrderManagement();

  return (
    <div className="om-page-container">
      {/* Component hiển thị bảng chính */}
      <OrderManagement
        data={data}
        isLoading={isLoading}
        filters={filters}
        pagination={pagination}
        actions={actions}
      />

      {/* Drawer trượt hiển thị chi tiết */}
      <OrderDetailDrawer
        isOpen={detailDrawer.isOpen}
        onClose={actions.closeDetail}
        orderData={selectedOrder}
      />

      {/* Modal cập nhật trạng thái đơn hàng */}
      <UpdateStatusModal
        // Mỗi lần mở là một form mới (không giữ lý do / lựa chọn / Force của lần trước)
        key={statusModal.isOpen ? (statusModal.orderId ?? "open") : "closed"}
        isOpen={statusModal.isOpen}
        orderId={statusModal.orderId}
        currentStatus={statusModal.currentStatus}
        rawStatus={statusModal.rawStatus ?? null}
        canOverride={permissions.canOverride}
        onClose={actions.closeStatusModal}
        onConfirm={actions.confirmUpdateStatus}
      />
    </div>
  );
}
