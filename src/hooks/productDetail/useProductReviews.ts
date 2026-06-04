import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import tokenStorage from "../../utils/tokenStorage";
import { toast } from "react-toastify"; // Đảm bảo bạn đã cài và setup react-toastify trong project

// --- Types ---
interface ReviewUser {
  _id: string;
  first_Name?: string;
  last_Name?: string;
  full_name?: string;
  avatar: string | null;
}

interface ReviewReply {
  content: string;
  replied_at: string;
}

interface ReviewData {
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
}

interface ReviewResponse {
  data: ReviewData[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface UIReview {
  id: string;
  author: string;
  isVerified: boolean;
  date: string;
  rating: number;
  content: string;
  reply?: { content: string; date: string };
}

// --- Config data ---
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

  // States bộ lọc & phân trang
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("Most recent");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);

  // States form đánh giá
  const [_isWritingReview, _setIsWritingReview] = useState<boolean>(false);
  const [userFeedback, setUserFeedback] = useState<
    Record<string, "like" | "dislike">
  >({});
  const [reviewsList, setReviewsList] = useState<UIReview[]>([]);
  const [newRating, setNewRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState<string>("");

  // States kiểm tra điều kiện đánh giá (Lấy từ BE)
  const [eligibility, setEligibility] = useState<{
    isEligible: boolean;
    orderId?: string;
    variantSku?: string;
  }>({ isEligible: false });

  // 1. Hàm kiểm tra quyền đánh giá (Chỉ chạy khi có token)
  const checkReviewEligibility = useCallback(async () => {
    if (!productId || !tokenStorage.getToken()) return;

    try {
      const response = await axiosClient.get(
        `/reviews/eligibility/${productId}`,
      );
      setEligibility(response.data);
    } catch (error) {
      console.error("Lỗi kiểm tra quyền đánh giá:", error);
    }
  }, [productId]);

  // 2. Hàm Fetch danh sách đánh giá
  const fetchReviews = useCallback(async () => {
    if (!productId) return;

    let backendSort = "newest";
    if (sortBy === "Highest Rating") backendSort = "highest_rating";
    if (sortBy === "Lowest Rating") backendSort = "lowest_rating";

    let starFilter: number | undefined = undefined;
    if (activeFilter === "5 Stars") starFilter = 5;
    if (activeFilter === "4 Stars") starFilter = 4;
    if (activeFilter === "3 Stars") starFilter = 3;
    if (activeFilter === "2 Stars") starFilter = 2; // Đã bổ sung logic cho 2 Stars
    if (activeFilter === "1 Stars") starFilter = 1; // Đã bổ sung logic cho 1 Stars

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

        // xử lý format dữ liệu reply nếu admin đã phản hồi
        let replyData;
        if (review.reply) {
          const replyDate = new Date(review.reply.replied_at);
          replyData = {
            content: review.reply.content,
            date: replyDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          };
        }

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
          reply: replyData, // gán dữ liệu đã xử lý vào danh sách trả về
        };
      });

      setReviewsList(mappedReviews);
      setTotalPages(meta.totalPages);
    } catch (error) {
      console.error("Lỗi khi tải danh sách đánh giá:", error);
    }
  }, [productId, activeFilter, sortBy, currentPage]);

  useEffect(() => {
    //eslint-disable-next-line react-hooks/exhaustive-deps
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    checkReviewEligibility();
  }, [checkReviewEligibility]);

  // --- Handlers ---
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
      if (prev[reviewId] === type) {
        const newState = { ...prev };
        delete newState[reviewId];
        return newState;
      }
      return { ...prev, [reviewId]: type };
    });

    if (type === "like") {
      try {
        await axiosClient.post(`/reviews/${reviewId}/vote`);
      } catch (error) {
        console.error("Lỗi khi vote đánh giá:", error);
      }
    }
  };

  const handleCancelReview = () => {
    setNewRating(0);
    setReviewText("");
    _setIsWritingReview(false);
  };

  /**
   * KỸ THUẬT GHI ĐÈ BẢO VỆ UI:
   * Không cho mở form nếu chưa đăng nhập hoặc không đủ điều kiện (chưa mua/đã review hết).
   */
  const setIsWritingReview = (val: boolean) => {
    if (val) {
      if (!tokenStorage.getToken()) {
        toast.warning("Vui lòng đăng nhập để viết đánh giá.");
        return;
      }
      if (!eligibility.isEligible) {
        toast.warning(
          "Bạn cần mua và nhận sản phẩm này thành công trước khi đánh giá. Nếu đã mua, có thể bạn đã đánh giá sản phẩm này rồi.",
        );
        return;
      }
    }
    _setIsWritingReview(val);
  };

  const handleSubmitReview = async () => {
    if (newRating === 0 || !reviewText.trim() || !productId) return;
    if (!eligibility.orderId || !eligibility.variantSku) return;

    try {
      await axiosClient.post("/reviews", {
        productId,
        orderId: eligibility.orderId,
        variantSku: eligibility.variantSku,
        rating: newRating,
        content: reviewText,
      });

      handleCancelReview();
      fetchReviews();
      checkReviewEligibility(); // Check lại để xem còn order nào khác hợp lệ không
      toast.success("Gửi đánh giá thành công!");
    } catch (error: unknown) {
      // Đổi thành unknown để tránh lỗi ESLint any
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi khi gửi đánh giá.";
      toast.error(errorMessage);
    }
  };

  return {
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
