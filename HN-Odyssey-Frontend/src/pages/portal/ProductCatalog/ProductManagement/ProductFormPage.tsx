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
    AVAILABLE_TAGS, // Lấy mảng tag đã fetch từ backend trong Hook
    MOCK_AVAILABLE_ATTRIBUTES, // Lấy mảng attribute đã fetch từ backend trong Hook
    AVAILABLE_CATEGORIES,
  } = useProductForm();

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
