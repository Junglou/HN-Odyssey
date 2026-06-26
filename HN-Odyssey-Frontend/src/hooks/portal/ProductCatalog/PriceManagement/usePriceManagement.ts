import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";

export type PriceStatus = "APPROVED" | "PENDING" | "REJECTED" | "DRAFT";

export interface PriceRecord {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  variant: string;
  status: PriceStatus;
  price: number;
  currency: string;
}

export interface PriceFormData {
  priceAmount: number;
  currency: string;
  effectiveDate: string;
}

export interface ApiVariant {
  sku: string;
  price: number;
  attributes: { code: string; value: string }[];
}

export interface ApiProduct {
  _id: string;
  name: string;
  sku: string;
  has_variants?: boolean;
  price: number;
  currency?: string;
  price_request?: {
    status?: string;
    price?: number;
    currency?: string;
    variants?: { sku: string; price: number; status?: string }[];
  };
  variants?: ApiVariant[];
}

export interface ApiError {
  response?: {
    status?: number;
    data?: {
      message?: string | string[];
    };
  };
}

export function usePriceManagement() {
  const [records, setRecords] = useState<PriceRecord[]>([]);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<PriceStatus | "All">("All");
  const [currencyFilter, setCurrencyFilter] = useState<string>("All");
  const [priceSort, setPriceSort] = useState<"none" | "asc" | "desc">("none");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    editingRecord: PriceRecord | null;
    isSubmitting: boolean;
  }>({ isOpen: false, editingRecord: null, isSubmitting: false });

  const fetchProductsData = async () => {
    const res = await axiosClient.get("/products");
    const products: ApiProduct[] = res.data?.data || res.data || [];
    const flatRecords: PriceRecord[] = [];

    products.forEach((p) => {
      if (p.has_variants && p.variants && p.variants.length > 0) {
        p.variants.forEach((v, index) => {
          let currentStatus = "DRAFT";
          let displayPrice = v.price;
          const displayCurrency =
            p.price_request?.currency || p.currency || "USD";

          if (p.price_request) {
            const reqVar = p.price_request.variants?.find(
              (rv) => rv.sku === v.sku,
            );
            if (reqVar) {
              currentStatus =
                reqVar.status || p.price_request.status || "PENDING";
              displayPrice = reqVar.price;
            } else if (v.price > 0) {
              currentStatus = "APPROVED";
            }
          } else if (v.price > 0) {
            currentStatus = "APPROVED";
          }

          const variantText =
            v.attributes?.map((a) => a.value).join(" / ") ||
            `Variant ${index + 1}`;

          flatRecords.push({
            id: v.sku || `${p._id}-${index}`,
            productId: p._id,
            productName: p.name,
            sku: v.sku,
            variant: variantText,
            status: currentStatus.toUpperCase() as PriceStatus,
            price: displayPrice,
            currency: displayCurrency,
          });
        });
      } else {
        let currentStatus = "DRAFT";
        let displayPrice = p.price;
        const displayCurrency =
          p.price_request?.currency || p.currency || "USD";

        if (p.price_request) {
          currentStatus = p.price_request.status || "PENDING";
          displayPrice = p.price_request.price || p.price;
        } else if (p.price > 0) {
          currentStatus = "APPROVED";
        }

        flatRecords.push({
          id: p._id,
          productId: p._id,
          productName: p.name,
          sku: p.sku,
          variant: "Single",
          status: currentStatus.toUpperCase() as PriceStatus,
          price: displayPrice,
          currency: displayCurrency,
        });
      }
    });

    return flatRecords;
  };

  const refreshData = useCallback(() => {
    fetchProductsData()
      .then((data) => setRecords(data))
      .catch((error: unknown) => {
        const err = error as ApiError;
        const msg =
          err.response?.data?.message ||
          (error instanceof Error
            ? error.message
            : "Lỗi tải danh sách sản phẩm");
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      });
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const result = records.filter((record) => {
      const matchStatus =
        statusFilter === "All" || record.status === statusFilter;
      const matchCurrency =
        currencyFilter === "All" || record.currency === currencyFilter;
      const matchSearch =
        !normalizedSearch ||
        record.productName.toLowerCase().includes(normalizedSearch) ||
        record.sku.toLowerCase().includes(normalizedSearch);

      return matchStatus && matchCurrency && matchSearch;
    });

    if (priceSort === "asc") {
      result.sort((a, b) => a.price - b.price);
    } else if (priceSort === "desc") {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  }, [records, search, statusFilter, currencyFilter, priceSort]);

  const totalPages = Math.ceil(filteredRecords.length / pagination.limit);
  const startIndex = (pagination.page - 1) * pagination.limit;
  const currentRecords = filteredRecords.slice(
    startIndex,
    startIndex + pagination.limit,
  );
  const actions = {
    changeSearch: (val: string) => {
      setSearch(val);
      setPagination((p) => ({ ...p, page: 1 }));
    },
    changeStatusFilter: (status: PriceStatus | "All") =>
      setStatusFilter(status),
    changeCurrencyFilter: (currency: string) => setCurrencyFilter(currency),
    changePriceSort: (sort: "none" | "asc" | "desc") => setPriceSort(sort),
    clearFilters: () => {
      setSearch("");
      setStatusFilter("All");
      setCurrencyFilter("All");
      setPriceSort("none");
    },
    toggleSelection: (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    toggleSelectAll: (isSelectAll: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (isSelectAll) {
          // Chỉ Select All các item đang hiển thị ở trang hiện tại
          currentRecords.forEach((r) => next.add(r.id));
        } else {
          // Chỉ bỏ chọn các item ở trang hiện tại
          currentRecords.forEach((r) => next.delete(r.id));
        }
        return next;
      });
    },
    changePage: (page: number) => setPagination((p) => ({ ...p, page })),
    changeLimit: (limit: number) => setPagination({ page: 1, limit }),
    openSetPriceModal: (record: PriceRecord) => {
      setModalConfig({
        isOpen: true,
        editingRecord: record,
        isSubmitting: false,
      });
    },
    closeSetPriceModal: () => {
      setModalConfig({
        isOpen: false,
        editingRecord: null,
        isSubmitting: false,
      });
    },
  };

  const handleSavePrice = async (data: PriceFormData) => {
    const targetRecord = modalConfig.editingRecord;
    if (!targetRecord) return;

    setModalConfig((prev) => ({ ...prev, isSubmitting: true }));

    try {
      const baseRecord = records.find(
        (r) => r.productId === targetRecord.productId && r.variant === "Single",
      );
      let basePrice = baseRecord ? baseRecord.price : targetRecord.price;

      if (!basePrice || basePrice <= 0) {
        basePrice = data.priceAmount;
      }

      const payload: {
        price: number;
        currency: string;
        effective_date: string;
        variants?: { sku: string; price: number }[];
      } = {
        price: targetRecord.variant === "Single" ? data.priceAmount : basePrice,
        currency: data.currency,
        effective_date: new Date().toISOString(),
      };

      if (targetRecord.variant !== "Single") {
        payload.variants = [{ sku: targetRecord.sku, price: data.priceAmount }];
      }

      await axiosClient.post(
        `/products/${targetRecord.productId}/price-request`,
        payload,
      );
      toast.success("Đã tạo yêu cầu giá (Draft)!");
      refreshData();
      actions.closeSetPriceModal();
    } catch (error: unknown) {
      const err = error as ApiError;
      const msg =
        err.response?.data?.message ||
        (error instanceof Error ? error.message : "Lỗi lưu giá");
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      setModalConfig((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const getSelectedItems = () => {
    const ids = Array.from(selectedIds);
    return records
      .filter((r) => ids.includes(r.id))
      .map((r) => ({ product_id: r.productId, sku: r.sku }));
  };

  const bulkActions = {
    bulkApprove: async () => {
      const targets = getSelectedItems();
      if (targets.length === 0) return;
      try {
        await axiosClient.patch(`/products/price-requests/bulk-action`, {
          items: targets,
          action: "approve",
        });
        toast.success(`Đã duyệt ${targets.length} mục được chọn!`);
        setSelectedIds(new Set());
        refreshData();
      } catch (error: unknown) {
        const err = error as ApiError;
        const msg =
          err.response?.data?.message ||
          (error instanceof Error ? error.message : "Lỗi duyệt hàng loạt");
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      }
    },
    bulkReject: async () => {
      const targets = getSelectedItems();
      if (targets.length === 0) return;
      try {
        await axiosClient.patch(`/products/price-requests/bulk-action`, {
          items: targets,
          action: "reject",
        });
        toast.warning(`Đã từ chối ${targets.length} mục được chọn!`);
        setSelectedIds(new Set());
        refreshData();
      } catch (error: unknown) {
        const err = error as ApiError;
        const msg =
          err.response?.data?.message ||
          (error instanceof Error ? error.message : "Lỗi từ chối hàng loạt");
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      }
    },
  };

  const rowActions = {
    submitPrice: async (productId: string, sku: string) => {
      const targetRecord = records.find(
        (r) =>
          r.sku === sku ||
          (r.productId === productId && r.variant === "Single"),
      );

      if (targetRecord && targetRecord.price <= 0) {
        toast.warning(
          "Giá đang bằng 0. Vui lòng nhấn 'Edit' và 'Save' trước khi Submit!",
        );
        return;
      }

      try {
        await axiosClient.patch(`/products/${productId}/price-request/submit`, {
          sku,
        });
        toast.success("Đã gửi yêu cầu duyệt giá!");
        refreshData();
      } catch (error: unknown) {
        const err = error as ApiError;
        const msg =
          err.response?.data?.message ||
          (error instanceof Error ? error.message : "Lỗi gửi duyệt");
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      }
    },
    approvePrice: async (productId: string, sku: string) => {
      try {
        await axiosClient.patch(`/products/${productId}/price-approval`, {
          action: "approve",
          sku: sku,
        });
        toast.success("Đã duyệt giá thành công!");
        refreshData();
      } catch (error: unknown) {
        const err = error as ApiError;
        const msg =
          err.response?.data?.message ||
          (error instanceof Error ? error.message : "Lỗi duyệt giá");
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      }
    },
    rejectPrice: async (productId: string, sku: string) => {
      try {
        await axiosClient.patch(`/products/${productId}/price-approval`, {
          action: "reject",
          sku: sku,
        });
        toast.warning("Đã từ chối giá!");
        refreshData();
      } catch (error: unknown) {
        const err = error as ApiError;
        const msg =
          err.response?.data?.message ||
          (error instanceof Error ? error.message : "Lỗi từ chối");
        toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
      }
    },
  };

  return {
    currentRecords,
    pagination: {
      ...pagination,
      totalPages,
      totalFiltered: filteredRecords.length,
      startIndex,
    },
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
  };
}
