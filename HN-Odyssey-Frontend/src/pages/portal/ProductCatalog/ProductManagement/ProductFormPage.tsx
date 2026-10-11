import ProductForm from "../../../../components/portal/ProductCatalog/ProductManagement/ProductForm/ProductForm";
import { useProductForm } from "../../../../hooks/portal/ProductCatalog/ProductManagement/useProductForm";
import "./ProductFormPage.css";

// container bọc ngoài gọi hook và truyền toàn bộ trạng thái xuống component giao diện
export default function ProductFormPage() {
  const {
    mode,
    formData,
    tags,
    pricingList,
    productVariants,
    categoryError,
    actions,
    AVAILABLE_TAGS,
    MOCK_AVAILABLE_ATTRIBUTES,
    AVAILABLE_CATEGORIES,
    isAuthorized, // Nhận kết quả check quyền từ Hook
  } = useProductForm();

  // CHẶN CHỚP MÀN HÌNH: Trả về một block rỗng lập tức nếu Hook báo không có quyền
  // Hook sẽ tự động bung Toast và Navigate, UI không render gì cả.
  if (!isAuthorized) {
    return null;
  }
  return (
    <div className="pf-page-container">
      <ProductForm
        mode={mode}
        formData={formData}
        tags={tags}
        pricingList={pricingList}
        productVariants={productVariants}
        categoryError={categoryError}
        actions={actions}
        availableTags={AVAILABLE_TAGS} // Truyền xuống
        availableAttributes={MOCK_AVAILABLE_ATTRIBUTES} // Truyền xuống
        availableCategories={AVAILABLE_CATEGORIES}
      />
    </div>
  );
}
