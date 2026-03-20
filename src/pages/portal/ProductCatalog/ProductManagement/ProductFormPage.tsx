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
      />
    </div>
  );
}
