import { useState } from "react";

// mock data
const MOCK_REVIEWS = [
  {
    id: "rev-1",
    author: "Marin Hialynsa",
    isVerified: true,
    date: "Jun 17, 2025",
    rating: 5,
    content:
      "This jacket is absolutely worth it. The fabric feels high-quality and comfortable, yet lightweight when worn. The fit is flattering and well-structured, making it easy to style for both casual and everyday outfits.",
  },
  {
    id: "rev-2",
    author: "Marin Hialynsa",
    isVerified: true,
    date: "Jun 17, 2025",
    rating: 5,
    content:
      "This jacket is absolutely worth it. The fabric feels high-quality and comfortable, yet lightweight when worn. The fit is flattering and well-structured, making it easy to style for both casual and everyday outfits.",
  },
];

// hooks
export function useProductReviews() {
  // states
  const [activeFilter, setActiveFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Most recent");
  const [currentPage, setCurrentPage] = useState(1);

  // handlers
  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
  };

  const handleSortChange = (sort: string) => {
    setSortBy(sort);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return {
    reviews: MOCK_REVIEWS,
    activeFilter,
    sortBy,
    currentPage,
    totalPages: 2,
    handleFilterChange,
    handleSortChange,
    handlePageChange,
  };
}
