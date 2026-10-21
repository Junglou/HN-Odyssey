import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";
import type { UserPayload } from "../../../../types/auth";
import { Action, Resource } from "../../../../types/permissions";

export const ReviewStatusEnum = {
  NEW: "NEW",
  APPROVED: "APPROVED",
  REPLIED: "REPLIED",
  HIDDEN: "HIDDEN",
} as const;
export type ReviewStatusEnumType =
  (typeof ReviewStatusEnum)[keyof typeof ReviewStatusEnum];

export const BlockReasonEnum = {
  SPAM: "SPAM",
  OFFENSIVE: "OFFENSIVE",
  INAPPROPRIATE: "INAPPROPRIATE",
  OTHER: "OTHER",
} as const;

export const BulkReviewActionEnum = {
  HIDE: "HIDE",
  UNHIDE: "UNHIDE",
  DELETE: "DELETE",
} as const;

export type ReviewStatus = "Replied" | "New" | "Hidden";
export type DrawerMode = "view" | "edit" | null;

export interface ReviewMedia {
  url: string;
  type: "IMAGE" | "VIDEO";
  thumbnail?: string;
}

// Bổ sung mảng chứa reply của khách vào Record
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
  media?: ReviewMedia[];
  customerReplies: { content: string; date: string; media?: ReviewMedia[] }[];
}

interface ProductData {
  _id: string;
  name?: string;
  price?: number;
  base_price?: number;
}

interface UserData {
  _id: string;
  first_Name?: string;
  last_Name?: string;
  is_active?: boolean;
}

interface BeReviewReply {
  content: string;
  replied_at: string;
}

// Bổ sung type từ Backend trả về
interface BeReviewItem {
  _id: string;
  product_id: ProductData | string;
  user_id: UserData | string;
  rating: number;
  content: string;
  status: ReviewStatusEnumType;
  createdAt: string;
  reply?: BeReviewReply;
  is_pinned: boolean;
  pinned_at?: string;
  media?: ReviewMedia[]; // Đánh giá gốc
  customer_replies?: {
    content: string;
    createdAt: string;
    media?: ReviewMedia[];
  }[]; // Reply của khách
}

interface FetchResponse {
  items: BeReviewItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

const mapBeToFe = (item: BeReviewItem): ReviewRecord => {
  const product = typeof item.product_id === "object" ? item.product_id : null;
  const user = typeof item.user_id === "object" ? item.user_id : null;

  let mappedStatus: ReviewStatus = "New";
  if (item.status === ReviewStatusEnum.HIDDEN) mappedStatus = "Hidden";
  else if (item.status === ReviewStatusEnum.REPLIED) mappedStatus = "Replied";

  const fullName = [user?.first_Name, user?.last_Name]
    .filter(Boolean)
    .join(" ");

  // THÊM ĐOẠN MAP DỮ LIỆU REPLY NÀY
  const mappedCustomerReplies = (item.customer_replies || []).map((cr) => ({
    content: cr.content,
    date: new Date(cr.createdAt).toLocaleString("vi-VN"),
    media: cr.media || [],
  }));

  return {
    id: item._id,
    productName: product?.name || "Unknown Product",
    customerId: user?._id || "Unknown ID",
    customerName: fullName || "Anonymous",
    rating: item.rating,
    reviewContent: item.content,
    price: product?.price || product?.base_price || 0,
    status: mappedStatus,
    submittedDate: new Date(item.createdAt).toISOString().split("T")[0],
    isUserBanned: user?.is_active === false,
    officialResponse: item.reply?.content,
    isPinned: item.is_pinned,
    pinnedAt: item.pinned_at ? new Date(item.pinned_at).getTime() : undefined,
    media: item.media || [],
    customerReplies: mappedCustomerReplies, // Gắn vào bản ghi FE
  };
};

const useLocalAuth = () => {
  const [user] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) return JSON.parse(stored) as UserPayload;
    } catch (error) {
      console.warn("Không thể parse dữ liệu user từ localStorage:", error);
    }
    return null;
  });
  return { user };
};

export function useReviewAndRatingManagement() {
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    ReviewStatus | "All" | "hidden"
  >("All");
  const [ratingFilter, setRatingFilter] = useState<string>("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [drawerConfig, setDrawerConfig] = useState<{
    isOpen: boolean;
    selectedReview: ReviewRecord | null;
    mode: DrawerMode;
  }>({ isOpen: false, selectedReview: null, mode: null });

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    mode: "delete" | null;
    editingRecord: ReviewRecord | null;
  }>({ isOpen: false, mode: null, editingRecord: null });

  useEffect(() => {
    const handler = setTimeout(() => {
      if (debouncedSearch !== search) {
        setDebouncedSearch(search);
        setPage(1); // Reset page khi từ khóa thực sự thay đổi
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [search, debouncedSearch]);

  const { user } = useLocalAuth();

  const hasPermission = useCallback(
    (resourceCode: Resource, actionCode: Action): boolean => {
      if (!user || !user.permissions) return false;
      if (user.roles?.includes("SUPER_ADMIN")) return true;
      return user.permissions.some(
        (p) =>
          p.resource === resourceCode &&
          (p.actions.includes(actionCode) || p.actions.includes(Action.MANAGE)),
      );
    },
    [user],
  );

  const canApprove = hasPermission(Resource.CRM_REVIEWS, Action.APPROVE);
  const canUpdate = hasPermission(Resource.CRM_REVIEWS, Action.UPDATE);
  const canPublish = hasPermission(Resource.CRM_REVIEWS, Action.PUBLISH);
  const canDelete = hasPermission(Resource.CRM_REVIEWS, Action.DELETE);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (debouncedSearch) params.keyword = debouncedSearch;
      if (ratingFilter !== "All") params.rating = Number(ratingFilter);

      if (statusFilter === "hidden") params.status = ReviewStatusEnum.HIDDEN;
      else if (statusFilter === "Replied")
        params.status = ReviewStatusEnum.REPLIED;
      else if (statusFilter === "New") params.status = ReviewStatusEnum.NEW;

      const response = await axiosClient.get<{
        items: BeReviewItem[];
        meta: FetchResponse["meta"];
      }>("/admin/reviews", { params });

      const rawData = response.data;
      const responseData =
        (rawData as unknown as { data: FetchResponse }).data || rawData;

      setRecords(responseData.items.map(mapBeToFe));
      setTotalRecords(responseData.meta.total);
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi tải danh sách đánh giá.");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, ratingFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReviews();
  }, [fetchReviews]);

  const totalPages = Math.ceil(totalRecords / limit);
  const startIndex = (page - 1) * limit;

  const actions = {
    changeSearch: (val: string) => {
      setSearch(val);
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
      if (isSelectAll) setSelectedIds(new Set(records.map((r) => r.id)));
      else setSelectedIds(new Set());
    },
    changePage: (newPage: number) => setPage(newPage),
    changeLimit: (newLimit: number) => {
      setLimit(newLimit);
      setPage(1);
    },

    openDrawer: (record: ReviewRecord, mode: DrawerMode) => {
      setDrawerConfig({ isOpen: true, selectedReview: record, mode });
    },
    closeDrawer: () => setDrawerConfig((prev) => ({ ...prev, isOpen: false })),

    openDeleteModal: (record?: ReviewRecord) => {
      if (!canDelete) return toast.error("Bạn không có quyền xóa đánh giá.");
      setModalConfig({
        isOpen: true,
        mode: "delete",
        editingRecord: record || null,
      });
    },
    closeModal: () =>
      setModalConfig({ isOpen: false, mode: null, editingRecord: null }),

    handleConfirmDelete: async () => {
      try {
        const idsToDelete = modalConfig.editingRecord
          ? [modalConfig.editingRecord.id]
          : Array.from(selectedIds);

        await axiosClient.post("/admin/reviews/bulk-actions", {
          review_ids: idsToDelete,
          action: BulkReviewActionEnum.DELETE,
        });

        toast.success(`Đã xóa ${idsToDelete.length} đánh giá thành công!`);
        setSelectedIds(new Set());
        actions.closeModal();
        fetchReviews();
      } catch (error) {
        console.error(error);
        toast.error("Có lỗi xảy ra khi xóa đánh giá.");
      }
    },

    toggleHideStatus: async (id: string) => {
      if (!canPublish)
        return toast.error("Bạn không có quyền ẩn/hiện đánh giá.");
      const targetReview = records.find((r) => r.id === id);
      if (!targetReview) return;

      try {
        // Nếu đang bị ẩn -> Gọi API /show
        if (targetReview.status === "Hidden") {
          await axiosClient.patch(`/admin/reviews/${id}/show`);
          toast.success("Đã hiển thị đánh giá.");
        }
        // Nếu đang hiển thị (New hoặc Replied) -> Gọi API /hide
        else {
          await axiosClient.patch(`/admin/reviews/${id}/hide`);
          toast.success("Đã ẩn đánh giá.");
        }

        fetchReviews();
      } catch (error) {
        console.error(error);
        toast.error("Có lỗi xảy ra, không thể thay đổi trạng thái.");
      }
    },

    saveReviewChanges: async (
      reviewId: string,
      updates: {
        officialResponse: string;
        isUserBanned: boolean;
        blockReason: string;
        blockNote: string;
        isPinned: boolean;
      },
    ) => {
      if (!canApprove && !canUpdate)
        return toast.error("Bạn không có quyền cập nhật đánh giá này.");
      const targetReview = records.find((r) => r.id === reviewId);
      if (!targetReview) return;

      try {
        if (
          updates.officialResponse !== targetReview.officialResponse ||
          updates.isUserBanned !== targetReview.isUserBanned
        ) {
          const payload: Record<string, string | boolean> = {};

          if (updates.officialResponse) {
            payload.reply_content = updates.officialResponse;
          }

          if (updates.isUserBanned) {
            payload.block_customer = true;
            if (updates.blockReason === "Spam")
              payload.block_reason = BlockReasonEnum.SPAM;
            else if (updates.blockReason === "Offensive")
              payload.block_reason = BlockReasonEnum.OFFENSIVE;
            else {
              payload.block_reason = BlockReasonEnum.OTHER;
              payload.block_reason_other = updates.blockNote;
            }
          }

          if (Object.keys(payload).length > 0) {
            await axiosClient.patch(
              `/admin/reviews/${reviewId}/confirm-action`,
              payload,
            );
          }
        }

        if (updates.isPinned !== targetReview.isPinned) {
          await axiosClient.patch(`/admin/reviews/${reviewId}/toggle-pin`);
        }

        toast.success("Thay đổi đã được lưu thành công!");
        actions.closeDrawer();
        fetchReviews();
      } catch (error) {
        console.error(error);
        toast.error("Có lỗi xảy ra khi lưu thay đổi.");
      }
    },
  };

  const bulkActions = {
    bulkHide: async () => {
      if (!canPublish)
        return toast.error("Bạn không có quyền ẩn đánh giá hàng loạt.");
      if (selectedIds.size === 0) return;
      try {
        await axiosClient.post("/admin/reviews/bulk-actions", {
          review_ids: Array.from(selectedIds),
          action: BulkReviewActionEnum.HIDE,
        });
        toast.info(`Đã ẩn ${selectedIds.size} đánh giá!`);
        setSelectedIds(new Set());
        fetchReviews();
      } catch (error) {
        console.error(error);
        toast.error("Lỗi thao tác hàng loạt (Ẩn).");
      }
    },
    bulkUnhide: async () => {
      if (!canPublish)
        return toast.error("Bạn không có quyền hiển thị đánh giá hàng loạt.");
      if (selectedIds.size === 0) return;
      try {
        await axiosClient.post("/admin/reviews/bulk-actions", {
          review_ids: Array.from(selectedIds),
          action: BulkReviewActionEnum.UNHIDE,
        });
        toast.success(`Đã hiển thị lại các đánh giá hợp lệ!`);
        setSelectedIds(new Set());
        fetchReviews();
      } catch (error) {
        console.error(error);
        toast.error("Lỗi thao tác hàng loạt (Hiển thị).");
      }
    },
    bulkDelete: () => {
      if (!canDelete)
        return toast.error("Bạn không có quyền xóa đánh giá hàng loạt.");
      if (selectedIds.size === 0) return;
      actions.openDeleteModal();
    },
  };

  return {
    currentRecords: records,
    isLoading,
    pagination: {
      page,
      limit,
      totalPages,
      totalFiltered: totalRecords,
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
    permissions: { canApprove, canUpdate, canPublish, canDelete },
  };
}
