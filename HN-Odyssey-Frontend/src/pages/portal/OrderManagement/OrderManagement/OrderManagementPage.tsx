import OrderManagement from "../../../../components/portal/OrderManagement/OrderManagement/OrderManagement";
import OrderDetailDrawer from "../../../../components/portal/OrderManagement/OrderManagement/OrderDetailDrawer";
import UpdateStatusModal from "../../../../components/portal/OrderManagement/OrderManagement/UpdateStatusModal";
import { useOrderManagement } from "../../../../hooks/portal/OrderManagement/OrderManagement/useOrderManagement";
import "./OrderManagementPage.css";

export default function OrderManagementPage() {
  const {
    data,
    filters,
    pagination,
    detailDrawer,
    selectedOrder,
    statusModal,
    actions,
  } = useOrderManagement();

  return (
    <div className="om-page-container">
      {/* Component hiển thị bảng chính */}
      <OrderManagement
        data={data}
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
        isOpen={statusModal.isOpen}
        orderId={statusModal.orderId}
        currentStatus={statusModal.currentStatus}
        onClose={actions.closeStatusModal}
        onConfirm={actions.confirmUpdateStatus}
      />
    </div>
  );
}
