import CategoryManagement from "../../../../components/portal/ProductCatalog/CategoryManagement/CategoryManagement";
import CategoryDrawer from "../../../../components/portal/ProductCatalog/CategoryManagement/CategoryDrawer";
import ConfirmDeleteModal from "../../../../components/portal/common/ConfirmDeleteModal";
import { useCategory } from "../../../../hooks/portal/ProductCatalog/CategoryManagement/useCategory";
import "./CategoryManagementPage.css";

export default function CategoryManagementPage() {
  const {
    categories,
    visibleCategories,
    searchQuery,
    setSearchQuery,
    toggleExpand,
    drawerConfig,
    openAddDrawer,
    openEditDrawer,
    closeDrawer,
    saveCategory,
    deleteConfig,
    requestDelete,
    cancelDelete,
    confirmDelete,
    moveCategory,
  } = useCategory();

  return (
    <div className="cm-page-container">
      {/* danh sách và thanh tìm kiếm */}
      <CategoryManagement
        data={visibleCategories}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddClick={openAddDrawer}
        onToggleExpand={toggleExpand}
        onEditClick={openEditDrawer}
        onDeleteClick={requestDelete}
        onMoveCategory={moveCategory}
      />

      {/* Drawer thêm mới/chỉnh sửa danh mục */}
      <CategoryDrawer
        key={
          drawerConfig.isOpen
            ? `drawer-${drawerConfig.mode}-${drawerConfig.editingId || "new"}`
            : "drawer-closed"
        }
        isOpen={drawerConfig.isOpen}
        mode={drawerConfig.mode}
        initialData={drawerConfig.initialData}
        categories={categories}
        editingId={drawerConfig.editingId}
        isSubmitting={drawerConfig.isSubmitting}
        onClose={closeDrawer}
        onSave={saveCategory}
      />

      {/* Modal xác nhận xóa */}
      <ConfirmDeleteModal
        isOpen={deleteConfig.isOpen}
        message="Are you sure you want to delete this category?"
        onClose={cancelDelete}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
