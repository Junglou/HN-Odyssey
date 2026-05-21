import { useState, useMemo } from "react";

// config mock data
const MOCK_FILTERS = [
  "All",
  "5 Stars",
  "4 Stars",
  "3 Stars",
  "Comfort",
  "Value",
];
const SORT_OPTIONS = [
  { value: "Most recent", label: "Most recent" },
  { value: "Highest Rating", label: "Highest Rating" },
  { value: "Lowest Rating", label: "Lowest Rating" },
];

const MOCK_REVIEWS = [
  {
    id: "rev-1",
    author: "Marin Hialynsa",
    isVerified: true,
    date: "Jun 17, 2025",
    rating: 5,
    content:
      "This jacket is absolutely worth it. The fabric feels high-quality and comfortable, yet lightweight when worn. The fit is flattering and well-structured, making it easy to style for both casual and everyday outfits. The stitching is neat and durable, and the color looks exactly like the photos. Very satisfied with this purchase and would definitely recommend it.",
  },
  {
    id: "rev-2",
    author: "Marin Hialynsa",
    isVerified: true,
    date: "Jun 17, 2025",
    rating: 5,
    content:
      "This jacket is absolutely worth it. The fabric feels high-quality and comfortable, yet lightweight when worn. The fit is flattering and well-structured, making it easy to style for both casual and everyday outfits. The stitching is neat and durable, and the color looks exactly like the photos. Very satisfied with this purchase and would definitely recommend it.",
  },
  {
    id: "rev-3",
    author: "Guest User",
    isVerified: false,
    date: "May 10, 2025",
    rating: 4,
    content:
      "Great jacket, but the sleeves are a bit long for my liking. Material is very nice though.",
  },
];

export function useProductReviews() {
  // states điều hướng và bộ lọc
  const [activeFilter, setActiveFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Most recent");
  const [currentPage, setCurrentPage] = useState(1);

  // states form và tương tác UI
  const [isWritingReview, setIsWritingReview] = useState(false);
  const [userFeedback, setUserFeedback] = useState<
    Record<string, "like" | "dislike">
  >({});

  // states quản lý danh sách động
  const [reviewsList, setReviewsList] = useState(MOCK_REVIEWS);
  const [newRating, setNewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  const itemsPerPage = 2;

  // lọc và sắp xếp
  const filteredReviews = useMemo(() => {
    let result = [...reviewsList];

    if (activeFilter === "5 Stars")
      result = result.filter((r) => r.rating === 5);
    else if (activeFilter === "4 Stars")
      result = result.filter((r) => r.rating === 4);
    else if (activeFilter === "3 Stars")
      result = result.filter((r) => r.rating === 3);

    if (sortBy === "Highest Rating") result.sort((a, b) => b.rating - a.rating);
    if (sortBy === "Lowest Rating") result.sort((a, b) => a.rating - b.rating);

    return result;
  }, [reviewsList, activeFilter, sortBy]);

  // phân trang
  const totalPages = Math.ceil(filteredReviews.length / itemsPerPage);
  const paginatedReviews = filteredReviews.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // handlers filter
  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  const handleSortChange = (sort: string) => {
    setSortBy(sort);
    setCurrentPage(1);
  };

  const handleFeedback = (reviewId: string, type: "like" | "dislike") => {
    setUserFeedback((prev) => {
      // hủy trạng thái nếu click lại
      if (prev[reviewId] === type) {
        const newState = { ...prev };
        delete newState[reviewId];
        return newState;
      }
      return {
        ...prev,
        [reviewId]: type,
      };
    });
  };

  // reset form
  const handleCancelReview = () => {
    setNewRating(0);
    setReviewText("");
    setIsWritingReview(false);
  };

  // thêm đánh giá mới lên đầu mảng và reset
  const handleSubmitReview = () => {
    if (newRating === 0 || !reviewText.trim()) return;

    const newReview = {
      id: `rev-${Date.now()}`,
      author: "Current User",
      isVerified: true,
      date: "Today",
      rating: newRating,
      content: reviewText,
    };

    setReviewsList((prev) => [newReview, ...prev]);
    handleCancelReview();
  };

  return {
    filters: MOCK_FILTERS,
    sortOptions: SORT_OPTIONS,
    reviews: paginatedReviews,
    activeFilter,
    sortBy,
    currentPage,
    totalPages,
    isWritingReview,
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
