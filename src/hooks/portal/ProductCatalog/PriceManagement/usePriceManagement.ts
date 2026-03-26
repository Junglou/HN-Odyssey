import { useState, useMemo } from "react";
import { toast } from "react-toastify";

// props và type
export type PriceStatus = "Approved" | "Pending" | "Rejected" | "Draft";

export interface PriceRecord {
  id: string;
  productName: string;
  sku: string;
  variant: string;
  status: PriceStatus;
  price: number;
}

export interface PriceFormData {
  priceAmount: number;
  currency: string;
  effectiveDate: string;
}

// mock data
const INITIAL_PRICES: PriceRecord[] = [
  {
    id: "1",
    productName: "Grey Slim Jacket",
    sku: "CWT-001",
    variant: "Size: M / Color: Grey",
    status: "Approved",
    price: 20.0,
  },
  {
    id: "2",
    productName: "Grey Slim Jacket",
    sku: "CWT-002",
    variant: "Size: M / Color: Grey",
    status: "Rejected",
    price: 20.0,
  },
  {
    id: "3",
    productName: "Grey Slim Jacket",
    sku: "CWT-003",
    variant: "Size: M / Color: Grey",
    status: "Pending",
    price: 20.0,
  },
  {
    id: "4",
    productName: "Grey Slim Jacket",
    sku: "CWT-004",
    variant: "Size: M / Color: Grey",
    status: "Approved",
    price: 20.0,
  },
  {
    id: "5",
    productName: "Grey Slim Jacket",
    sku: "CWT-005",
    variant: "Size: M / Color: Grey",
    status: "Draft",
    price: 20.0,
  },
  {
    id: "6",
    productName: "Grey Slim Jacket",
    sku: "CWT-006",
    variant: "Size: M / Color: Grey",
    status: "Pending",
    price: 20.0,
  },
  {
    id: "7",
    productName: "Grey Slim Jacket",
    sku: "CWT-007",
    variant: "Size: M / Color: Grey",
    status: "Approved",
    price: 20.0,
  },
  {
    id: "8",
    productName: "Grey Slim Jacket",
    sku: "CWT-008",
    variant: "Size: M / Color: Grey",
    status: "Rejected",
    price: 20.0,
  },
];

export function usePriceManagement() {
  const [records, setRecords] = useState<PriceRecord[]>(INITIAL_PRICES);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<PriceStatus | "All">("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });

  // quản lý trạng thái modal
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    editingRecord: PriceRecord | null;
    isSubmitting: boolean;
  }>({ isOpen: false, editingRecord: null, isSubmitting: false });

  // logic lọc dữ liệu
  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchStatus =
        statusFilter === "All" || record.status === statusFilter;

      const matchSearch =
        !normalizedSearch ||
        record.productName.toLowerCase().includes(normalizedSearch) ||
        record.sku.toLowerCase().includes(normalizedSearch);

      return matchStatus && matchSearch;
    });
  }, [records, search, statusFilter]);

  const totalPages = Math.ceil(filteredRecords.length / pagination.limit);
  const startIndex = (pagination.page - 1) * pagination.limit;
  const currentRecords = filteredRecords.slice(
    startIndex,
    startIndex + pagination.limit,
  );

  const actions = {
    changeSearch: (val: string) => setSearch(val),
    changeStatusFilter: (status: PriceStatus | "All") =>
      setStatusFilter(status),
    clearFilters: () => {
      setSearch("");
      setStatusFilter("All");
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

    // quản lý đóng mở modal
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

  const updateRecordStatus = (id: string, newStatus: PriceStatus) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)),
    );
  };

  const handleSavePrice = async (data: PriceFormData) => {
    const targetRecord = modalConfig.editingRecord;
    if (!targetRecord) return;

    setModalConfig((prev) => ({ ...prev, isSubmitting: true }));

    try {
      // giả lập xử lý api
      await new Promise((resolve) => setTimeout(resolve, 600));

      setRecords((prev) =>
        prev.map((r) =>
          r.id === targetRecord.id
            ? { ...r, price: data.priceAmount, status: "Pending" }
            : r,
        ),
      );
      toast.success("Đã cập nhật giá và gửi yêu cầu duyệt!");
      actions.closeSetPriceModal();
    } catch {
      toast.error("Đã xảy ra lỗi khi lưu giá.");
      setModalConfig((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // button
  const rowActions = {
    submitPrice: (id: string) => {
      updateRecordStatus(id, "Pending");
      toast.success("Đã gửi yêu cầu duyệt giá!");
    },
    approvePrice: (id: string) => {
      updateRecordStatus(id, "Approved");
      toast.success("Đã duyệt giá thành công!");
    },
    rejectPrice: (id: string) => {
      updateRecordStatus(id, "Rejected");
      toast.warning("Đã từ chối giá!");
    },
  };

  // logic xử lý duyệt/từ chối (bulk action)
  const bulkActions = {
    bulkApprove: () => {
      const targets = records.filter(
        (r) => selectedIds.has(r.id) && r.status === "Pending",
      );
      if (targets.length === 0) return;

      setRecords((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id) && r.status === "Pending"
            ? { ...r, status: "Approved" }
            : r,
        ),
      );
      toast.success(`Đã duyệt ${targets.length} mục được chọn!`);
      setSelectedIds(new Set());
    },
    bulkReject: () => {
      const targets = records.filter(
        (r) => selectedIds.has(r.id) && r.status === "Pending",
      );
      if (targets.length === 0) return;

      setRecords((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id) && r.status === "Pending"
            ? { ...r, status: "Rejected" }
            : r,
        ),
      );
      toast.warning(`Đã từ chối ${targets.length} mục được chọn!`);
      setSelectedIds(new Set());
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
    selectedIds,
    modalConfig,
    actions,
    rowActions,
    bulkActions,
    handleSavePrice,
  };
}
