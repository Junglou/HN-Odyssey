import { useState, useMemo } from "react";
import { toast } from "react-toastify";

export type ReviewStatus = "Replied" | "New" | "Hidden";

export interface ReviewRecord {
  id: string;
  productName: string;
  customerId: string;
  customerName: string;
  rating: number;
  reviewContent: string;
  price: number;
  status: ReviewStatus;
  submittedDate: string;
  isUserBanned: boolean;
  officialResponse?: string;
  blockReason?: string;
  blockNote?: string;
  isPinned?: boolean;
  pinnedAt?: number;
}

// mock data blacklist
const BLACKLIST_WORDS = ["scam", "fake", "stupid", "lừa đảo", "tục tĩu"];

const censorContent = (content: string) => {
  let censored = content;
  BLACKLIST_WORDS.forEach((word) => {
    const regex = new RegExp(word, "gi");
    censored = censored.replace(regex, "***");
  });
  return censored;
};

// mock data
const INITIAL_REVIEWS: ReviewRecord[] = [
  {
    id: "1",
    productName: "Grey Slim Jacket",
    customerId: "CUST-001",
    customerName: "John D.",
    rating: 5,
    reviewContent: "Great quality, fits perfectly...",
    price: 20.0,
    status: "Replied",
    submittedDate: "2024-10-24",
    isUserBanned: false,
    officialResponse: "Thank you for your feedback!",
  },
  {
    id: "2",
    productName: "Grey Slim Jacket",
    customerId: "CUST-002",
    customerName: "Sarah K.",
    rating: 2,
    reviewContent: censorContent("Medium quality, not that fit..."),
    price: 20.0,
    status: "Hidden",
    submittedDate: "2024-10-23",
    isUserBanned: true,
    blockReason: "Inappropriate content",
  },
  {
    id: "3",
    productName: "Grey Slim Jacket",
    customerId: "CUST-003",
    customerName: "Mike L.",
    rating: 1,
    reviewContent: "Terrible product, Received damaged...",
    price: 20.0,
    status: "New",
    submittedDate: "2024-10-22",
    isUserBanned: false,
  },
];

export type DrawerMode = "view" | "edit" | null;

export function useReviewAndRatingManagement() {
  const [records, setRecords] = useState<ReviewRecord[]>(INITIAL_REVIEWS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    ReviewStatus | "All" | "hidden"
  >("All");
  const [ratingFilter, setRatingFilter] = useState<string>("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Quản lý hiển thị Drawer chi tiết
  const [drawerConfig, setDrawerConfig] = useState<{
    isOpen: boolean;
    selectedReview: ReviewRecord | null;
    mode: DrawerMode;
  }>({
    isOpen: false,
    selectedReview: null,
    mode: null,
  });

  // Quản lý Modal xác nhận xóa
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "delete" | null;
    editingRecord: ReviewRecord | null;
  }>({ isOpen: false, mode: null, editingRecord: null });

  // Xử lý bộ lọc tìm kiếm
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        r.productName.toLowerCase().includes(search.toLowerCase()) ||
        r.customerName.toLowerCase().includes(search.toLowerCase());

      let matchStatus = true;
      if (statusFilter === "hidden") {
        matchStatus = r.status === "Hidden";
      } else if (statusFilter !== "All") {
        matchStatus = r.status === statusFilter;
      }

      const matchRating =
        ratingFilter === "All" || r.rating.toString() === ratingFilter;

      return matchSearch && matchStatus && matchRating;
    });
  }, [records, search, statusFilter, ratingFilter]);

  // Đẩy các đánh giá được ghim lên vị trí đầu
  const sortedRecords = useMemo(() => {
    const pinned = filteredRecords
      .filter((r) => r.isPinned)
      .sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0));
    const unpinned = filteredRecords.filter((r) => !r.isPinned);
    return [...pinned, ...unpinned];
  }, [filteredRecords]);

  // Phân trang
  const totalPages = Math.ceil(sortedRecords.length / limit);
  const startIndex = (page - 1) * limit;
  const currentRecords = sortedRecords.slice(startIndex, startIndex + limit);

  const actions = {
    changeSearch: (val: string) => {
      setSearch(val);
      setPage(1);
    },
    changeStatusFilter: (status: ReviewStatus | "All" | "hidden") => {
      setStatusFilter(status);
      setPage(1);
    },
    changeRatingFilter: (rating: string) => {
      setRatingFilter(rating);
      setPage(1);
    },
    clearFilters: () => {
      setSearch("");
      setStatusFilter("All");
      setRatingFilter("All");
      setPage(1);
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
        setSelectedIds(new Set(currentRecords.map((r) => r.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    changePage: (newPage: number) => setPage(newPage),
    changeLimit: (newLimit: number) => {
      setLimit(newLimit);
      setPage(1);
    },

    openDrawer: (record: ReviewRecord, mode: DrawerMode) => {
      setDrawerConfig({ isOpen: true, selectedReview: record, mode });
    },
    closeDrawer: () => {
      setDrawerConfig((prev) => ({ ...prev, isOpen: false }));
    },

    openDeleteModal: (record?: ReviewRecord) => {
      setModalConfig({
        isOpen: true,
        mode: "delete",
        editingRecord: record || null,
      });
    },

    closeModal: () => {
      setModalConfig({
        isOpen: false,
        mode: null,
        editingRecord: null,
      });
    },

    handleConfirmDelete: () => {
      if (modalConfig.editingRecord) {
        const id = modalConfig.editingRecord.id;
        setRecords((prev) => prev.filter((r) => r.id !== id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.success("Đã xóa đánh giá thành công!", { toastId: `del-${id}` });
      } else {
        const deletedCount = selectedIds.size;
        setRecords((prev) => prev.filter((r) => !selectedIds.has(r.id)));
        toast.success(`Đã xóa ${deletedCount} đánh giá thành công!`, {
          toastId: "del-bulk",
        });
        setSelectedIds(new Set());
      }
      actions.closeModal();
    },

    toggleHideStatus: (id: string) => {
      const targetReview = records.find((r) => r.id === id);
      if (!targetReview) return;

      if (targetReview.isUserBanned) {
        toast.error("Không thể mở ẩn vì tài khoản người dùng đang bị khóa.");
        return;
      }

      const newStatus =
        targetReview.status === "Hidden"
          ? targetReview.officialResponse
            ? "Replied"
            : "New"
          : "Hidden";

      toast.success(
        newStatus === "Hidden"
          ? "Đã ẩn đánh giá."
          : "Đã hiển thị lại đánh giá.",
        { toastId: `status-${id}` },
      );

      setRecords((prev) =>
        prev.map((review) => {
          if (review.id === id) {
            return {
              ...review,
              status: newStatus,
              isPinned: newStatus === "Hidden" ? false : review.isPinned,
              pinnedAt: newStatus === "Hidden" ? undefined : review.pinnedAt,
            };
          }
          return review;
        }),
      );
    },

    saveReviewChanges: (
      reviewId: string,
      updates: {
        officialResponse: string;
        isUserBanned: boolean;
        blockReason: string;
        blockNote: string;
        isPinned: boolean;
      },
    ) => {
      setRecords((prev) => {
        const updatedRecords = [...prev];
        const targetReview = updatedRecords.find((r) => r.id === reviewId);
        if (!targetReview) return prev;

        if (updates.isUserBanned) {
          updatedRecords.forEach((review) => {
            if (review.customerId === targetReview.customerId) {
              review.isUserBanned = true;
              review.status = "Hidden";
              review.blockReason = updates.blockReason;
              review.blockNote = updates.blockNote;
              review.isPinned = false;
              review.pinnedAt = undefined;
            }
          });
        }

        const reviewIndex = updatedRecords.findIndex((r) => r.id === reviewId);
        if (reviewIndex !== -1) {
          let newStatus = updatedRecords[reviewIndex].status;

          if (updates.isUserBanned) {
            newStatus = "Hidden";
          } else if (
            newStatus !== "Hidden" &&
            updates.officialResponse.trim().length > 0
          ) {
            newStatus = "Replied";
          }

          let finalIsPinned = updates.isPinned;
          let finalPinnedAt = updatedRecords[reviewIndex].pinnedAt;

          if (newStatus === "Hidden") {
            finalIsPinned = false;
            finalPinnedAt = undefined;
          } else if (
            updates.isPinned &&
            !updatedRecords[reviewIndex].isPinned
          ) {
            finalPinnedAt = Date.now();
          } else if (!updates.isPinned) {
            finalPinnedAt = undefined;
          }

          updatedRecords[reviewIndex] = {
            ...updatedRecords[reviewIndex],
            officialResponse: updates.officialResponse,
            status: newStatus,
            isUserBanned: updates.isUserBanned,
            blockReason: updates.isUserBanned ? updates.blockReason : "",
            blockNote: updates.isUserBanned ? updates.blockNote : "",
            isPinned: finalIsPinned,
            pinnedAt: finalPinnedAt,
          };
        }

        return updatedRecords;
      });

      toast.success("Thay đổi đã được lưu thành công!", {
        toastId: `save-${reviewId}`,
      });
      actions.closeDrawer();
    },
  };

  const bulkActions = {
    bulkHide: () => {
      if (selectedIds.size === 0) return;
      setRecords((prev) =>
        prev.map((r) =>
          selectedIds.has(r.id)
            ? { ...r, status: "Hidden", isPinned: false, pinnedAt: undefined }
            : r,
        ),
      );
      toast.info(`Đã ẩn ${selectedIds.size} đánh giá!`, {
        toastId: "bulk-hide",
      });
      setSelectedIds(new Set());
    },
    bulkUnhide: () => {
      if (selectedIds.size === 0) return;
      setRecords((prev) =>
        prev.map((r) => {
          if (selectedIds.has(r.id)) {
            if (r.isUserBanned) return r;
            return { ...r, status: r.officialResponse ? "Replied" : "New" };
          }
          return r;
        }),
      );
      toast.success(`Đã hiển thị lại các đánh giá hợp lệ!`, {
        toastId: "bulk-unhide",
      });
      setSelectedIds(new Set());
    },
    bulkDelete: () => {
      if (selectedIds.size === 0) return;
      actions.openDeleteModal();
    },
  };

  return {
    currentRecords,
    pagination: {
      page,
      limit,
      totalPages,
      totalFiltered: sortedRecords.length,
      startIndex,
    },
    search,
    statusFilter,
    ratingFilter,
    selectedIds,
    drawerConfig,
    modalConfig,
    actions,
    bulkActions,
  };
}
