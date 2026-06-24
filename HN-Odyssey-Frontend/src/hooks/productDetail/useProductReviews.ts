import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import tokenStorage from "../../utils/tokenStorage";
import { toast } from "react-toastify";

export interface ReviewUser {
  _id: string;
  first_Name?: string;
  last_Name?: string;
  full_name?: string;
  avatar: string | null;
}

export interface ReviewReply {
  content: string;
  replied_at: string;
}

export interface ReviewMedia {
  url: string;
  type: "IMAGE" | "VIDEO";
  thumbnail?: string;
}

export interface CustomerReplyBE {
  _id: string;
  user_id: string | ReviewUser;
  content: string;
  createdAt: string;
  media: ReviewMedia[];
}

export interface ReviewData {
  _id: string;
  product_id: string;
  user_id: string | ReviewUser;
  order_id: string;
  variant_sku: string;
  rating: number;
  content: string;
  is_anonymous: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  user?: ReviewUser;
  is_verified_purchase?: boolean;
  reply?: ReviewReply;
  customer_replies?: CustomerReplyBE[];
  reply_users?: ReviewUser[];
  media: ReviewMedia[];
}

interface ReviewResponse {
  data: ReviewData[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface UICustomerReply {
  id: string;
  author: string;
  date: string;
  content: string;
  media: ReviewMedia[];
}

export interface UIReview {
  id: string;
  author: string;
  isVerified: boolean;
  date: string;
  rating: number;
  content: string;
  media: ReviewMedia[];
  adminReply?: { content: string; date: string };
  customerReplies: UICustomerReply[];
}

const MOCK_FILTERS = [
  "All",
  "5 Stars",
  "4 Stars",
  "3 Stars",
  "2 Stars",
  "1 Stars",
];

const SORT_OPTIONS = [
  { value: "Most recent", label: "Most recent" },
  { value: "Highest Rating", label: "Highest Rating" },
  { value: "Lowest Rating", label: "Lowest Rating" },
];

export function useProductReviews() {
  const { slug: productId } = useParams<{ slug: string }>();

  const [reviewStats, setReviewStats] = useState({ average: 0, total: 0 });

  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("Most recent");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);

  const [_isWritingReview, _setIsWritingReview] = useState<boolean>(false);
  const [userFeedback, setUserFeedback] = useState<
    Record<string, "like" | "dislike">
  >({});
  const [reviewsList, setReviewsList] = useState<UIReview[]>([]);
  const [newRating, setNewRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>("");

  const [reviewMedia, setReviewMedia] = useState<ReviewMedia[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);

  const [eligibility, setEligibility] = useState<{
    isEligible: boolean;
    orderId?: string;
    variantSku?: string;
  }>({ isEligible: false });

  // THÊM: Quản lý Reply Media
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [replyMedia, setReplyMedia] = useState<ReviewMedia[]>([]);
  const [isUploadingReplyMedia, setIsUploadingReplyMedia] =
    useState<boolean>(false);

  const checkReviewEligibility = useCallback(async () => {
    if (!productId || !tokenStorage.getToken()) return;
    try {
      const response = await axiosClient.get(
        `/reviews/eligibility/${productId}`,
      );
      setEligibility(response.data);
    } catch (error) {
      console.error(error);
    }
  }, [productId]);

  const fetchReviewStats = useCallback(async () => {
    if (!productId) return;
    try {
      const response = await axiosClient.get(`/reviews/stats/${productId}`);
      setReviewStats({
        average: response.data.stats.average || 0,
        total: response.data.stats.total || 0,
      });
    } catch (error) {
      console.error("Loi khi lay thong ke review:", error);
    }
  }, [productId]);

  const fetchReviews = useCallback(async () => {
    if (!productId) return;
    let backendSort = "newest";
    if (sortBy === "Highest Rating") backendSort = "highest_rating";
    if (sortBy === "Lowest Rating") backendSort = "lowest_rating";

    let starFilter: number | undefined = undefined;
    if (activeFilter !== "All") starFilter = parseInt(activeFilter.charAt(0));

    try {
      const response = await axiosClient.get<ReviewResponse>(
        `/reviews/product/${productId}`,
        {
          params: {
            page: currentPage,
            limit: 5,
            sort_by: backendSort,
            ...(starFilter ? { star: starFilter } : {}),
          },
        },
      );

      const { data, meta } = response.data;
      const mappedReviews: UIReview[] = data.map((review) => {
        const dateObj = new Date(review.createdAt);

        let adminReplyData;
        if (review.reply) {
          const replyDate = new Date(review.reply.replied_at);
          adminReplyData = {
            content: review.reply.content,
            date: replyDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          };
        }

        const mappedCustomerReplies: UICustomerReply[] = (
          review.customer_replies || []
        ).map((cr) => {
          const rUser = review.reply_users?.find(
            (u) => u._id === cr.user_id?.toString() || u._id === cr.user_id,
          );
          const rFullName = rUser
            ? `${rUser.first_Name} ${rUser.last_Name}`
            : "Customer";
          return {
            id: cr._id,
            author: rFullName,
            date: new Date(cr.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
            content: cr.content,
            media: cr.media || [], // Ánh xạ media trả về từ BE
          };
        });

        return {
          id: review._id,
          author: review.user?.full_name || "Guest User",
          isVerified: review.is_verified_purchase ?? true,
          date: dateObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          rating: review.rating,
          content: review.content,
          media: review.media || [],
          adminReply: adminReplyData,
          customerReplies: mappedCustomerReplies,
        };
      });

      setReviewsList(mappedReviews);
      setTotalPages(meta.totalPages);
    } catch (error) {
      console.error(error);
    }
  }, [productId, activeFilter, sortBy, currentPage]);

  useEffect(() => {
    const initFetch = async () => {
      await fetchReviewStats();
      await fetchReviews();
    };
    initFetch();
  }, [fetchReviews, fetchReviewStats]);

  useEffect(() => {
    const initCheck = async () => {
      await checkReviewEligibility();
    };
    initCheck();
  }, [checkReviewEligibility]);

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const handleSortChange = (sort: string) => {
    setSortBy(sort);
    setCurrentPage(1);
  };

  const handleFeedback = async (reviewId: string, type: "like" | "dislike") => {
    setUserFeedback((prev) => {
      const newState = { ...prev };
      if (prev[reviewId] === type) delete newState[reviewId];
      else newState[reviewId] = type;
      return newState;
    });
    if (type === "like") {
      try {
        await axiosClient.post(`/reviews/${reviewId}/vote`);
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleUploadMedia = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (reviewMedia.length + files.length > 5) {
      toast.warning("Chỉ được tải lên tối đa 5 hình ảnh/video.");
      return;
    }

    setIsUploadingMedia(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));

      const response = await axiosClient.post<{ data: ReviewMedia[] }>(
        "/reviews/upload-media",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      setReviewMedia((prev) => [...prev, ...response.data.data]);
    } catch (error: unknown) {
      console.error(error);
      toast.error("Tải tệp lên thất bại. Vui lòng thử lại.");
    } finally {
      setIsUploadingMedia(false);
      event.target.value = "";
    }
  };

  // THÊM: Logic Upload cho Form Reply
  const handleUploadReplyMedia = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (replyMedia.length + files.length > 5) {
      toast.warning("Chỉ được tải lên tối đa 5 hình ảnh/video.");
      return;
    }

    setIsUploadingReplyMedia(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));

      const response = await axiosClient.post<{ data: ReviewMedia[] }>(
        "/reviews/upload-media",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      setReplyMedia((prev) => [...prev, ...response.data.data]);
    } catch (error: unknown) {
      console.error(error);
      toast.error("Tải tệp lên thất bại. Vui lòng thử lại.");
    } finally {
      setIsUploadingReplyMedia(false);
      event.target.value = "";
    }
  };

  const handleCancelReview = () => {
    setNewRating(0);
    setReviewText("");
    setReviewMedia([]);
    _setIsWritingReview(false);
  };

  // THÊM: Logic mở đóng Reply để clear dữ liệu rác
  const handleOpenReply = (reviewId: string) => {
    if (replyingTo === reviewId) {
      handleCloseReply();
    } else {
      setReplyingTo(reviewId);
      setReplyText("");
      setReplyMedia([]);
    }
  };

  const handleCloseReply = () => {
    setReplyingTo(null);
    setReplyText("");
    setReplyMedia([]);
  };

  const setIsWritingReview = (val: boolean) => {
    if (val) {
      if (!tokenStorage.getToken()) {
        toast.warning("Vui lòng đăng nhập.");
        return;
      }
      if (!eligibility.isEligible) {
        toast.warning("Bạn cần mua sản phẩm này trước.");
        return;
      }
    }
    _setIsWritingReview(val);
  };

  const handleSubmitReview = async () => {
    if (
      newRating === 0 ||
      (!reviewText.trim() && reviewMedia.length === 0) ||
      !productId ||
      !eligibility.orderId
    )
      return;

    try {
      // Chỉ giữ lại 1 luồng duy nhất là gọi API tạo đánh giá
      // Hệ thống Backend Listener sẽ tự động bắt sự kiện và lưu vào user_behaviors
      await axiosClient.post("/reviews", {
        productId,
        orderId: eligibility.orderId,
        variantSku: eligibility.variantSku,
        rating: newRating,
        content: reviewText,
        media: reviewMedia,
      });

      handleCancelReview();
      fetchReviewStats();
      fetchReviews();
      checkReviewEligibility();
      toast.success("Gửi đánh giá thành công!");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Đã xảy ra lỗi.");
    }
  };

  const handleSubmitCustomerReply = async (reviewId: string) => {
    if (!tokenStorage.getToken()) {
      toast.warning("Vui lòng đăng nhập.");
      return;
    }
    // Cho phép gửi nếu có text HOẶC có hình ảnh
    if (!replyText.trim() && replyMedia.length === 0) return;

    try {
      await axiosClient.post(`/reviews/${reviewId}/reply`, {
        content: replyText,
        media: replyMedia, // Đính kèm mảng hình ảnh Reply
      });
      handleCloseReply();
      fetchReviews();
      toast.success("Đã phản hồi bình luận.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Đã xảy ra lỗi.");
    }
  };

  return {
    reviewStats,
    filters: MOCK_FILTERS,
    sortOptions: SORT_OPTIONS,
    reviews: reviewsList,
    activeFilter,
    sortBy,
    currentPage,
    totalPages,
    isWritingReview: _isWritingReview,
    userFeedback,
    newRating,
    reviewText,
    reviewMedia,
    isUploadingMedia,
    replyingTo,
    replyText,
    replyMedia,
    isUploadingReplyMedia,
    setReplyText,
    handleOpenReply,
    handleCloseReply,
    handleUploadMedia,
    handleUploadReplyMedia,
    handleSubmitCustomerReply,
    handleFilterChange,
    handleSortChange,
    handlePageChange: setCurrentPage,
    setIsWritingReview,
    handleFeedback,
    setNewRating,
    setReviewText,
    handleCancelReview,
    handleSubmitReview,
  };
}
