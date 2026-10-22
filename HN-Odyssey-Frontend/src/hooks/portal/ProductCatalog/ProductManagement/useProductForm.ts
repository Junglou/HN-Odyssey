import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";
import tokenStorage from "../../../../utils/tokenStorage";
import { Resource, Action } from "../../../../types/permissions";

export interface ProductData {
  sku: string;
  name: string;
  status: "Active" | "Inactive" | "Draft" | "Loading...";
  description: string;
  categoryIds: string[];
}

export interface PricingItem {
  id: string;
  variantName: string;
  price: number;
  currency?: string;
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
  rawValues?: ApiAttributeValue[];
}

export interface ApiTag {
  name: string;
}

export interface ApiAttributeValue {
  value: string;
  // PATCH (ESLint): Thay any bằng Record<string, unknown> để lưu trữ linh hoạt (vd: { color: "#FFFFFF" })
  meta?: Record<string, unknown>;
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
  // PATCH (ESLint): Tương tự ApiAttributeValue
  meta?: Record<string, unknown>;
}

export interface ApiVariant {
  sku: string;
  price: number;
  attributes: ApiVariantAttribute[];
}

export interface VariantPayload {
  sku: string;
  price: number;
  stock?: number;
  attributes: ApiVariantAttribute[];
}

export interface ProductPayload {
  name: string;
  sku: string;
  description: string;
  category_ids: string[];
  tags?: string[];
  price?: number;
  variants?: VariantPayload[];
}

export interface ApiCategoryNode {
  _id?: string;
  id?: string;
  name: string;
  children?: ApiCategoryNode[];
}

export interface ApiError {
  response?: {
    data?: {
      message?: string | string[];
    };
  };
  message?: string;
}

// Cấu trúc User để TypeScript nhận diện quyền
interface UserPayload {
  roles?: string[];
  permissions?: { resource: string; actions: string[] }[];
}

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

  const sanitizeSkuPart = (str: string) => {
    return str
      .toUpperCase()
      .replace(/\s+/g, "-")
      .replace(/[^A-Z0-9_-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  return variantConfigs.map((config, index) => {
    const existing = currentPricing.find((p) => p.variantName === config.name);
    if (existing) return existing;

    const suffix =
      config.combination.length > 0
        ? `-${config.combination.map(sanitizeSkuPart).join("-")}`
        : "";

    const finalSku = `${baseSku || "NEW"}${suffix}`.replace(/-+/g, "-");

    return {
      id: `p-${Date.now()}-${index}`,
      sku: finalSku,
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

  // --- LOGIC PHÂN QUYỀN (CHUYỂN TỪ PAGE VÀO HOOK) ---
  const user = tokenStorage.getUser() as UserPayload | null;
  const hasPermission = (resourceCode: Resource, actionCode: Action) => {
    if (!user || !user.permissions) return false;
    if (user.roles && user.roles.includes("SUPER_ADMIN")) return true;
    const perm = user.permissions.find((p) => p.resource === resourceCode);
    if (!perm) return false;
    return (
      perm.actions.includes(actionCode) || perm.actions.includes(Action.MANAGE)
    );
  };

  const isAddMode = mode === "add";
  const isEditMode = mode === "edit";
  const canCreate = hasPermission(Resource.CATALOG_PRODUCTS, Action.CREATE);
  const canUpdate = hasPermission(Resource.CATALOG_PRODUCTS, Action.UPDATE);
  const canChangeStatus = hasPermission(
    Resource.CATALOG_PRODUCTS,
    Action.CHANGE_STATUS,
  );

  // [THÊM MỚI]: Kiểm tra quyền Gửi yêu cầu duyệt giá
  const canSubmitPrice = hasPermission(
    Resource.CATALOG_PRICING,
    Action.SUBMIT_APPROVAL,
  );

  // Biến cờ: Bằng false nếu người dùng đang ở sai chế độ (vd: add mà không có quyền create)
  const isAuthorized =
    !(isAddMode && !canCreate) && !(isEditMode && !canUpdate);

  useEffect(() => {
    if (isAddMode && !canCreate) {
      toast.error("Truy cập bị từ chối: Bạn không có quyền thêm mới sản phẩm!");
      navigate("/portal/products", { replace: true });
    } else if (isEditMode && !canUpdate) {
      toast.error(
        "Truy cập bị từ chối: Bạn không có quyền chỉnh sửa sản phẩm này!",
      );
      navigate("/portal/products", { replace: true });
    }
  }, [isAddMode, isEditMode, canCreate, canUpdate, navigate]);
  // --- KẾT THÚC LOGIC PHÂN QUYỀN ---

  const [formData, setFormData] = useState<ProductData>({
    sku: "",
    name: "",
    status: mode === "add" ? "Draft" : "Loading...",
    description: "",
    categoryIds: [],
  });

  // Trạng thái lúc tải về, để chỉ gọi API status khi người dùng thật sự đổi
  const [originalStatus, setOriginalStatus] = useState<string>("");

  const [pricingList, setPricingList] = useState<PricingItem[]>(
    mode === "add"
      ? [
          {
            id: "p1",
            variantName: "Default / Base Product",
            price: 0,
            status: "draft",
          },
        ]
      : [],
  );

  const [tags, setTags] = useState<string[]>([]);
  const [productVariants, setProductVariants] = useState<VariantAttribute[]>(
    [],
  );
  const [categoryError, setCategoryError] = useState("");

  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableAttributes, setAvailableAttributes] = useState<
    VariantAttribute[]
  >([]);
  const [availableCategories, setAvailableCategories] = useState<
    CategoryNode[]
  >([]);

  useEffect(() => {
    // Chặn gọi API nếu không được phép truy cập
    if (!isAuthorized) return;

    const fetchDependencies = async () => {
      try {
        const [tagsRes, attrRes, catRes] = await Promise.all([
          axiosClient.get("/tags/public/active").catch(() => ({ data: [] })),
          axiosClient
            .get("/attributes/public/active")
            .catch(() => ({ data: [] })),
          axiosClient
            .get("/categories/tree-view")
            .catch(() => ({ data: { data: [] } })),
        ]);

        setAvailableTags(tagsRes.data.map((t: ApiTag) => t.name));

        const mappedAttrs = attrRes.data.map((a: ApiAttribute) => ({
          id: a.code || a._id || "",
          name: a.name,
          rawValues: a.values || [],
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
  }, [isAuthorized]);

  useEffect(() => {
    // Chặn gọi API nếu không được phép truy cập
    if (!isAuthorized) return;

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

          setOriginalStatus(formattedStatus);
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

                if (p.price_request) {
                  const reqVar = p.price_request.variants?.find(
                    (reqV: { sku: string; price: number; status?: string }) =>
                      reqV.sku === v.sku,
                  );

                  if (reqVar) {
                    currentStatus = (
                      reqVar.status || p.price_request.status
                    ).toLowerCase() as
                      | "draft"
                      | "pending"
                      | "approved"
                      | "rejected";
                    displayPrice = reqVar.price;
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

            if (p.price_request) {
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
  }, [mode, id, navigate, isAuthorized]);

  const actions = {
    changeInput: (name: keyof ProductData, value: string) => {
      setFormData((prev) => {
        const newData = { ...prev, [name]: value } as ProductData;
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
          ? prev.categoryIds.filter((cid) => cid !== categoryId)
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

    savePrice: (priceId: string, newPrice: number, currency: string) => {
      setPricingList((prev) =>
        prev.map((item) =>
          item.id === priceId
            ? { ...item, price: newPrice, currency: currency, status: "draft" }
            : item,
        ),
      );
    },

    submitSinglePrice: async (pricingItemId: string) => {
      if (!canSubmitPrice) {
        toast.error("Bạn không có quyền gửi yêu cầu duyệt giá!");
        return;
      }
      if (mode === "add" || id === "add" || !id) {
        toast.warning(
          "Vui lòng 'Save Product' trước khi gửi yêu cầu duyệt giá!",
        );
        return;
      }

      const targetItem = pricingList.find((p) => p.id === pricingItemId);
      if (!targetItem) return;

      if (targetItem.price <= 0) {
        toast.warning(
          "Vui lòng thiết lập giá (Edit) lớn hơn 0 trước khi Submit!",
        );
        return;
      }

      try {
        const isSingleProduct =
          targetItem.variantName === "Default / Base Product";
        const baseProduct = pricingList.find(
          (p) => p.variantName === "Default / Base Product",
        );
        const basePrice = baseProduct ? baseProduct.price : targetItem.price;

        const payload: {
          price: number;
          currency: string;
          effective_date: string;
          variants?: { sku: string; price: number }[];
        } = {
          price: isSingleProduct
            ? targetItem.price
            : basePrice > 0
              ? basePrice
              : targetItem.price,
          currency: targetItem.currency || "USD",
          effective_date: new Date().toISOString(),
        };

        if (!isSingleProduct) {
          payload.variants = [
            {
              sku: targetItem.sku || `${formData.sku}-V`,
              price: targetItem.price,
            },
          ];
        }

        await axiosClient.post(`/products/${id}/price-request`, payload);
        await axiosClient.patch(`/products/${id}/price-request/submit`, {
          sku: targetItem.sku,
        });

        setPricingList((prev) =>
          prev.map((p) =>
            p.id === pricingItemId ? { ...p, status: "pending" } : p,
          ),
        );
        toast.success(
          `Đã gửi yêu cầu phê duyệt giá cho biến thể ${targetItem.variantName}`,
        );
      } catch (error: unknown) {
        const err = error as ApiError;
        const msg =
          err.response?.data?.message ||
          err.message ||
          "Lỗi khi gửi yêu cầu giá";
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      }
    },

    approveSinglePrice: async (pricingItemId: string) => {
      if (!id) return;
      const targetItem = pricingList.find((p) => p.id === pricingItemId);
      if (!targetItem) return;

      try {
        await axiosClient.patch(`/products/${id}/price-approval`, {
          action: "approve",
          sku: targetItem.sku,
        });

        setPricingList((prev) =>
          prev.map((item) =>
            item.id === pricingItemId ? { ...item, status: "approved" } : item,
          ),
        );
        toast.success(
          `Duyệt giá thành công cho biến thể ${targetItem.variantName}`,
        );
      } catch (error: unknown) {
        const err = error as ApiError;
        const msg =
          err.response?.data?.message || err.message || "Lỗi khi duyệt giá";
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      }
    },

    rejectSinglePrice: async (pricingItemId: string) => {
      if (!id) return;
      const targetItem = pricingList.find((p) => p.id === pricingItemId);
      if (!targetItem) return;

      try {
        await axiosClient.patch(`/products/${id}/price-approval`, {
          action: "reject",
          sku: targetItem.sku,
        });

        setPricingList((prev) =>
          prev.map((item) =>
            item.id === pricingItemId ? { ...item, status: "rejected" } : item,
          ),
        );
        toast.success(`Đã từ chối giá cho biến thể ${targetItem.variantName}`);
      } catch (error: unknown) {
        const err = error as ApiError;
        const msg =
          err.response?.data?.message || err.message || "Lỗi khi từ chối giá";
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
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
      };

      if (isSimpleProduct) {
        payload.price = pricingList[0].price;
      } else {
        payload.variants = pricingList.map((p) => {
          const valArray = p.variantName.split(" / ");
          const attributes = productVariants
            .map((attr, i) => {
              const val = valArray[i] || "";
              const rawMatch = attr.rawValues?.find(
                (rv) => rv.value.toUpperCase() === val.toUpperCase(),
              );
              return {
                code: attr.id,
                value: val,
                ...(rawMatch?.meta ? { meta: rawMatch.meta } : {}),
              };
            })
            .filter((a) => a.value !== "");

          const variantPayload: VariantPayload = {
            sku: p.sku || `${formData.sku}-V`,
            price: p.price,
            attributes: attributes,
          };

          if (mode === "add") {
            variantPayload.stock = 0;
          }

          return variantPayload;
        });
      }

      try {
        let productId = id;

        if (mode === "add") {
          const res = await axiosClient.post("/products", payload);
          productId = res.data?._id || res.data?.id || res.data?.data?._id;
          toast.success("Thêm sản phẩm thành công!");
        } else {
          await axiosClient.patch(`/products/${id}`, payload);

          if (formData.status === originalStatus) {
            toast.success("Cập nhật thông tin thành công!");
          } else if (!canChangeStatus) {
            toast.warning(
              "Đã lưu thông tin. Bạn không có quyền đổi trạng thái nên trạng thái được giữ nguyên.",
            );
          } else {
            try {
              await axiosClient.patch(`/products/${id}/status`, {
                status: formData.status.toUpperCase(),
              });
              toast.success("Cập nhật thông tin và trạng thái thành công!");
            } catch (statusError: unknown) {
              const err = statusError as ApiError;
              const msg = err.response?.data?.message || err.message;
              let errorMsg =
                "Lưu thông tin thành công, nhưng không thể đổi trạng thái! ";
              if (Array.isArray(msg)) {
                errorMsg += msg.join(", ");
              } else if (typeof msg === "string") {
                errorMsg += msg;
              }
              toast.warning(errorMsg);
            }
          }
        }

        if (productId) {
          try {
            await axiosClient.patch(`/products/${productId}/tags`, { tags });
          } catch (tagError) {
            console.error("Lỗi cập nhật tags:", tagError);
            toast.warning(
              "Lưu sản phẩm thành công nhưng cập nhật Tags thất bại.",
            );
          }
        }

        navigate("/portal/products");
        return true;
      } catch (error: unknown) {
        const err = error as ApiError;
        const msg =
          err.response?.data?.message ||
          err.message ||
          "Có lỗi xảy ra khi lưu sản phẩm";
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
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
    isAuthorized,
    canSubmitPrice,
    canChangeStatus,
  };
}
