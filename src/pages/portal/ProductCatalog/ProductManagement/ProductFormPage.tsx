import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import ProductForm, {
  type ProductData,
  type PricingItem,
} from "../../../../components/portal/ProductCatalog/ProductManagement/ProductForm/ProductForm";
import "./ProductFormPage.css";
import { toast } from "react-toastify";

// kho dữ liệu giả lập có bổ sung thêm categoryId
const MOCK_DB = [
  {
    id: "1",
    sku: "CWT-001",
    name: "Grey Slim Jacket",
    status: "Active",
    price: 20.5,
    categoryId: "c1-1-1",
  },
  {
    id: "2",
    sku: "SHR-012",
    name: "Classic White Shirt",
    status: "Inactive",
    price: 15.0,
    categoryId: "c2-1",
  },
  {
    id: "3",
    sku: "PNT-008",
    name: "Denim Jeans",
    status: "Draft",
    price: 35.0,
    categoryId: "c2-2",
  },
  {
    id: "4",
    sku: "SHS-004",
    name: "Running Sneakers",
    status: "Active",
    price: 50.0,
    categoryId: "c1-2",
  },
  {
    id: "5",
    sku: "ACC-099",
    name: "Leather Belt",
    status: "Inactive",
    price: 12.0,
    categoryId: "c2-2",
  },
  {
    id: "6",
    sku: "HAT-002",
    name: "Summer Fedora",
    status: "Draft",
    price: 8.5,
    categoryId: "c1-1-2",
  },
];

// page container quản lý state data và call api cho form sản phẩm
export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // check mode hiện tại truyền xuống component
  const mode = location.pathname.includes("/edit")
    ? "edit"
    : location.pathname.endsWith("/add") || id === "add"
      ? "add"
      : "view";

  // state data chính của form
  const [productData, setProductData] = useState<ProductData>({
    sku: "",
    name: "",
    status: "Draft",
    description: "",
    categoryId: "",
  });

  // state danh sách giá
  const [pricingList, setPricingList] = useState<PricingItem[]>([
    {
      id: "p1",
      variantName: "Default / Base Product",
      price: 0,
      status: "draft",
    },
  ]);

  // state list thẻ tag
  const [tags, setTags] = useState<string[]>([]);

  // hook fetch data chi tiết khi truy cập bằng id
  useEffect(() => {
    if (mode === "edit" || mode === "view") {
      const loadProductData = async () => {
        const foundProduct = MOCK_DB.find((p) => p.id === id);

        if (foundProduct) {
          // nhồi data tương ứng vào form, bổ sung categoryId
          setProductData({
            sku: foundProduct.sku,
            name: foundProduct.name,
            status: foundProduct.status as "Active" | "Inactive" | "Draft",
            description: `Đây là mô tả chi tiết của sản phẩm ${foundProduct.name}.`,
            categoryId: foundProduct.categoryId,
          });
          setPricingList([
            {
              id: "p1",
              variantName: "Default / Base Product",
              price: foundProduct.price,
              status: foundProduct.status === "Draft" ? "draft" : "approved",
            },
          ]);
          setTags(["New Arrival"]);
        } else {
          // fallback nếu người dùng gõ bừa 1 id không có thật
          setProductData({
            sku: `UNKNOWN-${id}`,
            name: "Sản phẩm không tồn tại",
            status: "Draft",
            description: "Không tìm thấy dữ liệu",
            categoryId: "",
          });
        }
      };
      loadProductData();
    }
  }, [mode, id]);

  // handler quay về trang danh sách
  const handleCancel = () => {
    navigate("/portal/products");
  };

  // handler gom data từ form con lên và call api save
  const handleSaveProduct = (
    data: ProductData,
    currentTags: string[],
    currentPricing: PricingItem[],
  ) => {
    console.log("Saving payload:", {
      data,
      tags: currentTags,
      pricing: currentPricing,
    });
    toast.success(
      mode === "edit" ? "Cập nhật thành công!" : "Thêm thành công!",
    );
    navigate("/portal/products");
  };

  // handler chuyển toàn bộ giá đang pending sang approved
  const handleApprovePrices = () => {
    setPricingList((prev) =>
      prev.map((item) =>
        item.status === "pending_approval"
          ? { ...item, status: "approved" as const }
          : item,
      ),
    );
    toast.success("Đã phê duyệt giá!");
  };

  return (
    <div className="pf-page-container">
      <ProductForm
        mode={mode}
        initialData={productData}
        pricingList={pricingList}
        initialTags={tags}
        onCancel={handleCancel}
        onSave={handleSaveProduct}
        onApprovePrices={handleApprovePrices}
      />
    </div>
  );
}
