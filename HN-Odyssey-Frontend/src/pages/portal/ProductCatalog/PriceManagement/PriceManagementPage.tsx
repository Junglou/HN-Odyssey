import PriceManagement from "../../../../components/portal/ProductCatalog/PriceManagement/PriceManagement";
import SetPriceModal from "../../../../components/portal/ProductCatalog/PriceManagement/SetPriceModal";
import { usePriceManagement } from "../../../../hooks/portal/ProductCatalog/PriceManagement/usePriceManagement";
import "./PriceManagementPage.css";

export default function PriceManagementPage() {
  const {
    currentRecords,
    isLoading,
    pagination,
    search,
    statusFilter,
    currencyFilter,
    priceSort,
    selectedIds,
    modalConfig,
    actions,
    rowActions,
    bulkActions,
    handleSavePrice,
    permissions,
  } = usePriceManagement();

  return (
    <div className="pm-page-container">
      {/* Component chính hiển thị bảng danh sách */}
      <PriceManagement
        data={currentRecords}
        isLoading={isLoading}
        pagination={pagination}
        search={search}
        statusFilter={statusFilter}
        currencyFilter={currencyFilter}
        priceSort={priceSort}
        selectedIds={selectedIds}
        actions={actions}
        rowActions={rowActions}
        bulkActions={bulkActions}
        canApprove={permissions.canApprove}
      />

      {/* Modal cập nhật giá */}
      <SetPriceModal
        isOpen={modalConfig.isOpen}
        productName={modalConfig.editingRecord?.productName || ""}
        sku={modalConfig.editingRecord?.sku || ""}
        initialPrice={modalConfig.editingRecord?.price}
        isSubmitting={modalConfig.isSubmitting}
        onClose={actions.closeSetPriceModal}
        onSave={handleSavePrice}
      />
    </div>
  );
}
