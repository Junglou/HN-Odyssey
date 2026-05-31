import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";

export interface ProductData {
  sku: string;
  name: string;
  status: "Active" | "Inactive" | "Draft";
  description: string;
  categoryIds: string[];
}

export interface PricingItem {
  id: string;
  variantName: string;
  price: number;
  status: "draft" | "pending" | "approved" | "rejected";
  sku?: string;
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

export interface ApiTag {
  name: string;
}

export interface ApiAttributeValue {
  value: string;
}

export interface ApiAttribute {
  _id?: string;
  code?: string;
  name: string;
  values?: ApiAttributeValue[];
}

export interface ApiVariantAttribute {
  code: string;
  value: string;
}

export interface ApiVariant {
  sku: string;
  price: number;
  attributes: ApiVariantAttribute[];
}

export interface ProductPayload {
  name: string;
  sku: string;
  description: string;
  category_ids: string[];
  tags: string[];
  price?: number;
  variants?: {
    sku: string;
    stock: number;
    price: number;
    attributes: { code: string; value: string }[];
  }[];
}

export interface ApiCategoryNode {
  _id?: string;
  id?: string;
  name: string;
  children?: ApiCategoryNode[];
}

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

const generatePricingVariants = (
  variants: VariantAttribute[],
  currentPricing: PricingItem[],
  baseSku: string,
): PricingItem[] => {
  const validAttrs = variants.filter((v) => v.values.length > 0);
  let variantConfigs: { name: string; combination: string[] }[] = [];

  if (validAttrs.length === 0) {
    variantConfigs = [{ name: "Default / Base Product", combination: [] }];
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
    variantConfigs = combinations.map((combo) => ({
      name: combo.join(" / "),
      combination: combo,
    }));
  }

  return variantConfigs.map((config, index) => {
    const existing = currentPricing.find((p) => p.variantName === config.name);
    if (existing) return existing;

    const suffix =
      config.combination.length > 0
        ? `-${config.combination.join("-").toUpperCase()}`
        : "";

    return {
      id: `p-${Date.now()}-${index}`,
      sku: `${baseSku || "NEW"}${suffix}`,
      variantName: config.name,
      price: 0,
      status: "draft",
    };
  });
};

export function useProductForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const mode: "add" | "edit" | "view" = location.pathname.includes("/edit")
    ? "edit"
    : location.pathname.endsWith("/add") || id === "add"
      ? "add"
      : "view";

  const [formData, setFormData] = useState<ProductData>({
    sku: "",
    name: "",
    status: "Draft",
    description: "",
    categoryIds: [],
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

  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableAttributes, setAvailableAttributes] = useState<
    VariantAttribute[]
  >([]);
  const [availableCategories, setAvailableCategories] = useState<
    CategoryNode[]
  >([]);

  // load dependencies
  useEffect(() => {
    const fetchDependencies = async () => {
      try {
        const [tagsRes, attrRes, catRes] = await Promise.all([
          axiosClient.get("/tags"),
          axiosClient.get("/attributes"),
          axiosClient.get("/categories/admin/tree-view"),
        ]);

        setAvailableTags(tagsRes.data.map((t: ApiTag) => t.name));

        const mappedAttrs = attrRes.data.map((a: ApiAttribute) => ({
          id: a.code || a._id || "",
          name: a.name,
          values: a.values
            ? a.values.map((v: ApiAttributeValue) => v.value.toUpperCase())
            : [],
        }));
        setAvailableAttributes(mappedAttrs);

        const treeData: ApiCategoryNode[] = Array.isArray(catRes.data?.data)
          ? catRes.data.data
          : Array.isArray(catRes.data)
            ? catRes.data
            : [];

        const formatCategoryTree = (
          nodes: ApiCategoryNode[],
        ): CategoryNode[] => {
          return nodes.map((node) => ({
            id: node._id || node.id || "",
            name: node.name,
            children:
              node.children && node.children.length > 0
                ? formatCategoryTree(node.children)
                : undefined,
          }));
        };

        setAvailableCategories(formatCategoryTree(treeData));
      } catch (error) {
        console.error("Lỗi khi load Tags/Attributes/Categories", error);
      }
    };
    fetchDependencies();
  }, []);

  // load product data
  useEffect(() => {
    if ((mode === "edit" || mode === "view") && id) {
      const loadProductData = async () => {
        try {
          const res = await axiosClient.get(`/products/${id}`);
          const p = res.data;

          const formattedStatus = p.status
            ? ((p.status.charAt(0).toUpperCase() +
                p.status.slice(1).toLowerCase()) as
                | "Active"
                | "Inactive"
                | "Draft")
            : "Draft";

          setFormData({
            sku: p.sku,
            name: p.name,
            status: formattedStatus,
            description: p.description || "",
            categoryIds:
              p.categories && p.categories.length > 0
                ? p.categories.map((c: ApiCategoryNode) => c._id || c.id || "")
                : [],
          });

          setTags(p.tags || []);

          if (p.variants && p.variants.length > 0) {
            const attrMap = new Map<string, Set<string>>();

            p.variants.forEach((v: ApiVariant) => {
              v.attributes.forEach((attr: ApiVariantAttribute) => {
                if (!attrMap.has(attr.code)) {
                  attrMap.set(attr.code, new Set<string>());
                }
                attrMap.get(attr.code)!.add(attr.value.toUpperCase());
              });
            });

            const restoredVariants: VariantAttribute[] = Array.from(
              attrMap.entries(),
            ).map(([code, valSet]) => ({
              id: code,
              name: code.charAt(0).toUpperCase() + code.slice(1),
              values: Array.from(valSet),
            }));

            setProductVariants(restoredVariants);

            const mappedPricing = p.variants.map(
              (v: ApiVariant, idx: number) => {
                const variantName = restoredVariants
                  .map((rv) => {
                    const match = v.attributes.find(
                      (a: ApiVariantAttribute) => a.code === rv.id,
                    );
                    return match ? match.value.toUpperCase() : "";
                  })
                  .filter((val) => val !== "")
                  .join(" / ");

                let currentStatus:
                  | "draft"
                  | "pending"
                  | "approved"
                  | "rejected" = "draft";
                let displayPrice = v.price;

                if (
                  p.price_request &&
                  (p.price_request.status === "PENDING" ||
                    p.price_request.status === "REJECTED")
                ) {
                  const reqVar = p.price_request.variants?.find(
                    (reqV: { sku: string; price: number }) =>
                      reqV.sku === v.sku,
                  );
                  if (reqVar) {
                    currentStatus = p.price_request.status.toLowerCase() as
                      | "draft"
                      | "pending"
                      | "approved"
                      | "rejected";
                    displayPrice = reqVar.price;
                  } else if (v.price > 0) {
                    currentStatus = "approved";
                  }
                } else if (v.price > 0) {
                  currentStatus = "approved";
                }

                return {
                  id: `v-${idx}`,
                  sku: v.sku,
                  variantName: variantName,
                  price: displayPrice,
                  status: currentStatus,
                };
              },
            );
            setPricingList(mappedPricing);
          } else {
            let currentStatus: "draft" | "pending" | "approved" | "rejected" =
              "draft";
            let displayPrice = p.price;

            if (
              p.price_request &&
              (p.price_request.status === "PENDING" ||
                p.price_request.status === "REJECTED")
            ) {
              currentStatus = p.price_request.status.toLowerCase() as
                | "draft"
                | "pending"
                | "approved"
                | "rejected";
              displayPrice = p.price_request.price;
            } else if (p.price > 0) {
              currentStatus = "approved";
            }

            setPricingList([
              {
                id: "p1",
                sku: p.sku,
                variantName: "Default / Base Product",
                price: displayPrice,
                status: currentStatus,
              },
            ]);
            setProductVariants([]);
          }
        } catch (error) {
          console.error(error);
          toast.error("Không tìm thấy thông tin sản phẩm");
          navigate("/portal/products");
        }
      };
      loadProductData();
    }
  }, [mode, id, navigate]);

  // actions
  const actions = {
    changeInput: (name: keyof ProductData, value: string) => {
      setFormData((prev) => {
        const newData = { ...prev, [name]: value };
        if (name === "sku") {
          setPricingList((curr) =>
            generatePricingVariants(productVariants, curr, value),
          );
        }
        return newData;
      });
    },

    toggleCategorySelect: (categoryId: string) => {
      setFormData((prev) => {
        const isSelected = prev.categoryIds.includes(categoryId);
        const newCategoryIds = isSelected
          ? prev.categoryIds.filter((id) => id !== categoryId)
          : [...prev.categoryIds, categoryId];
        return { ...prev, categoryIds: newCategoryIds };
      });
      setCategoryError("");
    },

    updateTags: (newTags: string[]) => {
      setTags(newTags);
    },

    removeTag: (tagToRemove: string) => {
      setTags((prev) => prev.filter((tag) => tag !== tagToRemove));
    },

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
          generatePricingVariants(nextVariants, currentPricing, formData.sku),
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

    submitSinglePrice: async () => {
      if (mode === "add" || id === "add" || !id) {
        toast.warning(
          "Vui lòng 'Save Product' trước khi gửi yêu cầu duyệt giá!",
        );
        return;
      }

      try {
        const baseProduct = pricingList.find(
          (p) => p.variantName === "Default / Base Product",
        );

        let rootPrice = baseProduct
          ? baseProduct.price
          : pricingList[0]?.price || 0;
        if (rootPrice <= 0) {
          rootPrice = pricingList.find((p) => p.price > 0)?.price || 0;
        }

        const variantPayloads = pricingList
          .filter(
            (p) => p.variantName !== "Default / Base Product" && p.price > 0,
          )
          .map((p) => ({ sku: p.sku || `${formData.sku}-V`, price: p.price }));

        const payload = {
          price: rootPrice,
          effective_date: new Date().toISOString(),
          variants: variantPayloads,
        };

        await axiosClient.post(`/products/${id}/price-request`, payload);
        await axiosClient.patch(`/products/${id}/price-request/submit`);

        setPricingList((prev) =>
          prev.map((p) => (p.price > 0 ? { ...p, status: "pending" } : p)),
        );
        toast.success("Đã gửi yêu cầu phê duyệt giá cho toàn bộ sản phẩm");
      } catch (error: unknown) {
        let errorMsg = "Lỗi khi gửi yêu cầu giá";
        const err = error as {
          response?: { data?: { message?: string | string[] } };
        };
        const msg = err.response?.data?.message;

        if (Array.isArray(msg)) {
          errorMsg = msg.join(", ");
        } else if (typeof msg === "string") {
          errorMsg = msg;
        }
        toast.error(errorMsg);
      }
    },

    approveSinglePrice: async () => {
      if (!id) return;
      try {
        await axiosClient.patch(`/products/${id}/price-approval`, {
          action: "approve",
        });

        setPricingList((prev) =>
          prev.map((item) =>
            item.status === "pending" ? { ...item, status: "approved" } : item,
          ),
        );
        toast.success("Duyệt giá thành công cho toàn bộ biến thể");
      } catch (error: unknown) {
        console.error(error);
        toast.error("Lỗi khi duyệt giá");
      }
    },

    rejectSinglePrice: async () => {
      if (!id) return;
      try {
        await axiosClient.patch(`/products/${id}/price-approval`, {
          action: "reject",
        });

        setPricingList((prev) =>
          prev.map((item) =>
            item.status === "pending" ? { ...item, status: "rejected" } : item,
          ),
        );
        toast.success("Đã từ chối giá cho toàn bộ biến thể");
      } catch (error: unknown) {
        console.error(error);
        toast.error("Lỗi khi từ chối giá");
      }
    },

    viewApproval: () => {
      navigate("/portal/prices");
    },

    saveProduct: async () => {
      if (formData.categoryIds.length === 0) {
        setCategoryError("Vui lòng chọn ít nhất một danh mục cho sản phẩm.");
        return false;
      }
      if (tags.length === 0) {
        toast.warning("Sản phẩm phải có ít nhất 1 Tag để AI phân tích.");
        return false;
      }
      setCategoryError("");

      const isSimpleProduct =
        pricingList.length === 1 &&
        pricingList[0].variantName === "Default / Base Product";

      const payload: ProductPayload = {
        name: formData.name,
        sku: formData.sku,
        description: formData.description,
        category_ids: formData.categoryIds,
        tags: tags,
      };

      if (isSimpleProduct) {
        payload.price = pricingList[0].price;
      } else {
        payload.variants = pricingList.map((p) => {
          const valArray = p.variantName.split(" / ");
          const attributes = productVariants
            .map((attr, i) => ({
              code: attr.id,
              value: valArray[i] || "",
            }))
            .filter((a) => a.value !== "");

          return {
            sku: p.sku || `${formData.sku}-V`,
            stock: 0,
            price: p.price,
            attributes: attributes,
          };
        });
      }

      try {
        if (mode === "add") {
          await axiosClient.post("/products", payload);
          toast.success("Thêm sản phẩm thành công!");
        } else {
          await axiosClient.patch(`/products/${id}`, payload);

          try {
            await axiosClient.patch(`/products/${id}/status`, {
              status: formData.status.toUpperCase(),
            });
            toast.success("Cập nhật thông tin và trạng thái thành công!");
          } catch (statusError: unknown) {
            const err = statusError as { message?: string | string[] };
            let errorMsg =
              "Lưu thông tin thành công, nhưng không thể đổi trạng thái!";
            if (Array.isArray(err.message)) {
              errorMsg += ` Lỗi: ${err.message.join(", ")}`;
            } else if (typeof err.message === "string") {
              errorMsg += ` Lỗi: ${err.message}`;
            }
            toast.warning(errorMsg);
          }
        }
        navigate("/portal/products");
        return true;
      } catch (error: unknown) {
        console.error(error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Có lỗi xảy ra khi lưu sản phẩm",
        );
        return false;
      }
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
    AVAILABLE_TAGS: availableTags,
    MOCK_AVAILABLE_ATTRIBUTES: availableAttributes,
    AVAILABLE_CATEGORIES: availableCategories,
  };
}
