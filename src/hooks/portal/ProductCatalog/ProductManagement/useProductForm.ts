import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";

// interface
export interface ProductData {
  sku: string;
  name: string;
  status: "Active" | "Inactive" | "Draft";
  description: string;
  categoryId: string;
}

export interface PricingItem {
  id: string;
  variantName: string;
  price: number;
  status: "draft" | "pending" | "approved" | "rejected";
}

export interface CategoryNode {
  id: string;
  name: string;
  children?: CategoryNode[];
}

export interface VariantAttribute {
  id: string;
  name: string;
  values: string[];
}

// mock data
export const AVAILABLE_TAGS = ["New Arrival", "Winter", "Summer", "Sale"];

export const MOCK_AVAILABLE_ATTRIBUTES: VariantAttribute[] = [
  { id: "1", name: "Size", values: ["S", "M", "L", "XL", "XXL", "XXXL"] },
  {
    id: "2",
    name: "Color",
    values: ["Navy", "Grey", "Olive", "Black", "White"],
  },
  {
    id: "3",
    name: "Material",
    values: ["Cotton", "Polyester", "Silk", "Denim"],
  },
];

export const MOCK_CATEGORIES: CategoryNode[] = [
  {
    id: "c1",
    name: "Women",
    children: [
      {
        id: "c1-1",
        name: "Outerwear",
        children: [{ id: "c1-1-1", name: "Jackets" }],
      },
    ],
  },
];

// mock data
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
];

const generatePricingVariants = (
  variants: VariantAttribute[],
  currentPricing: PricingItem[],
): PricingItem[] => {
  const validAttrs = variants.filter((v) => v.values.length > 0);
  let variantNames: string[] = [];

  if (validAttrs.length === 0) {
    variantNames = ["Default / Base Product"];
  } else {
    const combinations = validAttrs.reduce((acc: string[][], attr) => {
      if (acc.length === 0) return attr.values.map((v) => [v]);
      const newAcc: string[][] = [];
      acc.forEach((combo) => {
        attr.values.forEach((val) => {
          newAcc.push([...combo, val]);
        });
      });
      return newAcc;
    }, []);
    variantNames = combinations.map((combo) => combo.join(" / "));
  }

  return variantNames.map((name, index) => {
    const existing = currentPricing.find((p) => p.variantName === name);
    if (existing) return existing;

    return {
      id: `p-${Date.now()}-${index}`,
      variantName: name,
      price: 0, // Giá mặc định cho biến thể mới
      status: "draft",
    };
  });
};

export function useProductForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // xác định mode dựa trên URL
  const mode: "add" | "edit" | "view" = location.pathname.includes("/edit")
    ? "edit"
    : location.pathname.endsWith("/add") || id === "add"
      ? "add"
      : "view";

  // state quản lý form
  const [formData, setFormData] = useState<ProductData>({
    sku: "",
    name: "",
    status: "Draft",
    description: "",
    categoryId: "",
  });

  const [pricingList, setPricingList] = useState<PricingItem[]>([
    {
      id: "p1",
      variantName: "Default / Base Product",
      price: 0,
      status: "draft",
    },
  ]);

  const [tags, setTags] = useState<string[]>([]);
  const [productVariants, setProductVariants] = useState<VariantAttribute[]>(
    [],
  );
  const [categoryError, setCategoryError] = useState<string>("");

  // fetch data chi tiết ở chế độ xem hoặc sửa
  useEffect(() => {
    if (mode === "edit" || mode === "view") {
      const loadProductData = () => {
        const foundProduct = MOCK_DB.find((p) => p.id === id);

        if (foundProduct) {
          setFormData({
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
          setFormData({
            sku: `UNKNOWN-${id}`,
            name: "N/a",
            status: "Draft",
            description: "No data available",
            categoryId: "",
          });
          setPricingList([
            {
              id: "p1",
              variantName: "Default / Base Product",
              price: 0,
              status: "draft",
            },
          ]);
          setTags([]);
        }
      };
      loadProductData();
    }
  }, [mode, id]);

  // tính toán đường dẫn danh mục
  const actions = {
    changeInput: (name: keyof ProductData, value: string) => {
      setFormData((prev) => ({ ...prev, [name]: value }));
    },
    changeCategory: (categoryId: string) => {
      setFormData((prev) => ({ ...prev, categoryId }));
      setCategoryError("");
    },
    updateTags: (newTags: string[]) => {
      setTags(newTags);
    },
    removeTag: (tagToRemove: string) => {
      setTags((prev) => prev.filter((tag) => tag !== tagToRemove));
    },

    // logic variant
    confirmVariant: (
      updatedAttributes: VariantAttribute[],
      editingVariantId?: string,
    ) => {
      setProductVariants((prev) => {
        let nextVariants: VariantAttribute[];
        if (editingVariantId) {
          nextVariants = prev.map((v) =>
            v.id === updatedAttributes[0]?.id ? updatedAttributes[0] : v,
          );
        } else {
          nextVariants = updatedAttributes;
        }

        setPricingList((currentPricing) =>
          generatePricingVariants(nextVariants, currentPricing),
        );

        return nextVariants;
      });
    },

    savePrice: (priceId: string, newPrice: number) => {
      setPricingList((prev) =>
        prev.map((item) =>
          item.id === priceId
            ? { ...item, price: newPrice, status: "draft" }
            : item,
        ),
      );
    },
    submitSinglePrice: (id: string) => {
      setPricingList((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "pending" } : item,
        ),
      );
    },
    approveSinglePrice: (id: string) => {
      setPricingList((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "approved" } : item,
        ),
      );
    },
    rejectSinglePrice: (id: string) => {
      setPricingList((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "rejected" } : item,
        ),
      );
    },
    viewApproval: () => {
      alert("Chức năng Price Management đang phát triển");
    },
    saveProduct: () => {
      if (!formData.categoryId) {
        setCategoryError("Vui lòng chọn ít nhất một danh mục cho sản phẩm.");
        return false;
      }
      setCategoryError("");
      toast.success(
        mode === "edit" ? "Cập nhật thành công!" : "Thêm thành công!",
      );
      navigate("/portal/products");
      return true;
    },
    cancel: () => {
      navigate("/portal/products");
    },
  };

  return {
    mode,
    formData,
    tags,
    pricingList,
    productVariants,
    categoryError,
    actions,
  };
}
