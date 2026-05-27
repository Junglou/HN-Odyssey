import { useState, useMemo, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";

// types
export type PriceStatus = "APPROVED" | "PENDING" | "REJECTED" | "DRAFT";

export interface PriceRecord {
  id: string;
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

export interface ApiError {
  response?: {
    data?: {
      message?: string | string[];
    };
  };
}

// hook
export function usePriceManagement() {
  // states
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

  // api
  const fetchProductsData = async () => {
    const res = await axiosClient.get("/products");
    const products = res.data?.data || res.data || [];

    return products.map(
      (p: {
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
        };
      }) => {
        const status = p.price_request?.status || "APPROVED";
        const displayPrice = p.price_request?.price || p.price;
        const displayCurrency =
          p.price_request?.currency || p.currency || "VND";
        const variantText = p.has_variants ? "Multiple Variants" : "Single";

        return {
          id: p._id,
          productName: p.name,
          sku: p.sku,
          variant: variantText,
          status: status as PriceStatus,
          price: displayPrice,
          currency: displayCurrency,
        } as PriceRecord;
      },
    );
  };

  const refreshData = useCallback(() => {
    fetchProductsData()
      .then((data) => {
        setRecords(data);
      })
      .catch((error) => {
        const err = error as ApiError;
        toast.error(
          (err.response?.data?.message as string) ||
            "Lỗi tải danh sách sản phẩm",
        );
      });
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // helper
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

  // handle
  const actions = {
    changeSearch: (val: string) => setSearch(val),
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
      if (isSelectAll) {
        setSelectedIds(new Set(filteredRecords.map((r) => r.id)));
      } else {
        setSelectedIds(new Set());
      }
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
      await axiosClient.post(`/products/${targetRecord.id}/price-request`, {
        price: data.priceAmount,
        currency: data.currency,
        effective_date: data.effectiveDate,
      });
      toast.success("Đã tạo yêu cầu giá (Draft)!");
      refreshData();
      actions.closeSetPriceModal();
    } catch (error) {
      const err = error as ApiError;
      toast.error((err.response?.data?.message as string) || "Lỗi lưu giá");
      setModalConfig((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const rowActions = {
    submitPrice: async (id: string) => {
      try {
        await axiosClient.patch(`/products/${id}/price-request/submit`);
        toast.success("Đã gửi yêu cầu duyệt giá!");
        refreshData();
      } catch (error) {
        const err = error as ApiError;
        toast.error((err.response?.data?.message as string) || "Lỗi gửi duyệt");
      }
    },
    approvePrice: async (id: string) => {
      try {
        await axiosClient.patch(`/products/${id}/price-approval`, {
          action: "approve",
        });
        toast.success("Đã duyệt giá thành công!");
        refreshData();
      } catch (error) {
        const err = error as ApiError;
        toast.error((err.response?.data?.message as string) || "Lỗi duyệt giá");
      }
    },
    rejectPrice: async (id: string) => {
      try {
        await axiosClient.patch(`/products/${id}/price-approval`, {
          action: "reject",
        });
        toast.warning("Đã từ chối giá!");
        refreshData();
      } catch (error) {
        const err = error as ApiError;
        toast.error((err.response?.data?.message as string) || "Lỗi từ chối");
      }
    },
  };

  const bulkActions = {
    bulkApprove: async () => {
      const targets = Array.from(selectedIds);
      if (targets.length === 0) return;
      try {
        await axiosClient.patch(`/products/price-requests/bulk-action`, {
          product_ids: targets,
          action: "approve",
        });
        toast.success(`Đã duyệt ${targets.length} mục được chọn!`);
        setSelectedIds(new Set());
        refreshData();
      } catch (error) {
        const err = error as ApiError;
        toast.error(
          (err.response?.data?.message as string) || "Lỗi duyệt hàng loạt",
        );
      }
    },
    bulkReject: async () => {
      const targets = Array.from(selectedIds);
      if (targets.length === 0) return;
      try {
        await axiosClient.patch(`/products/price-requests/bulk-action`, {
          product_ids: targets,
          action: "reject",
        });
        toast.warning(`Đã từ chối ${targets.length} mục được chọn!`);
        setSelectedIds(new Set());
        refreshData();
      } catch (error) {
        const err = error as ApiError;
        toast.error(
          (err.response?.data?.message as string) || "Lỗi từ chối hàng loạt",
        );
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
