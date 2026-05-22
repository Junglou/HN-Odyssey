// imports
import { useState, useMemo } from "react";

// types
export interface BlogNewsPost {
  id: string;
  title: string;
  summary: string;
  thumbnail: string;
  category_id: { _id: string; name: string };
  author_id: { _id: string; full_name: string };
  published_at: string;
}

// mock data (map chuẩn từ portal)
const MOCK_POSTS: BlogNewsPost[] = [
  {
    id: "1",
    title: "Holiday Gift Guide 2024",
    summary:
      "Explore our curated selection of the best gifts for everyone on your list this holiday season.",
    thumbnail: "https://via.placeholder.com/600x400?text=Gift+Guide",
    category_id: { _id: "c1", name: "Promotions" },
    author_id: { _id: "a1", full_name: "Alex Johnson" },
    published_at: "Nov 15, 2024",
  },
  {
    id: "2",
    title: "Solo Survivor",
    summary:
      "Survive on your own terms. Discover trends, company updates and Guides.",
    thumbnail: "https://via.placeholder.com/600x400?text=Solo+Survivor",
    category_id: { _id: "c2", name: "Company News" },
    author_id: { _id: "a1", full_name: "Alex Johnson" },
    published_at: "Nov 14, 2024",
  },
  {
    id: "3",
    title: "Winter Collection Reveal",
    summary: "Get ready for the cold season with our new winter lineup.",
    thumbnail: "https://via.placeholder.com/600x400?text=Winter",
    category_id: { _id: "c3", name: "Product Guides" },
    author_id: { _id: "a2", full_name: "Sarah Lee" },
    published_at: "Nov 10, 2024",
  },
  {
    id: "4",
    title: "Tech Innovations in Retail",
    summary: "How AI is changing the shopping experience.",
    thumbnail: "https://via.placeholder.com/600x400?text=Tech",
    category_id: { _id: "c4", name: "Industry Trends" },
    author_id: { _id: "a3", full_name: "Mike Ross" },
    published_at: "Nov 05, 2024",
  },
  {
    id: "5",
    title: "Black Friday Early Access",
    summary: "Exclusive early access deals for VIP members.",
    thumbnail: "https://via.placeholder.com/600x400?text=Black+Friday",
    category_id: { _id: "c1", name: "Promotions" },
    author_id: { _id: "a1", full_name: "Alex Johnson" },
    published_at: "Nov 01, 2024",
  },
  {
    id: "6",
    title: "New Year Updates",
    summary: "Look forward to exciting things coming this year.",
    thumbnail: "https://via.placeholder.com/600x400?text=New+Year",
    category_id: { _id: "c2", name: "Company News" },
    author_id: { _id: "a2", full_name: "Sarah Lee" },
    published_at: "Oct 28, 2024",
  },
];

const SORT_OPTIONS = ["Latest", "Oldest", "Most Popular"];

// hook
export function useBlogNews() {
  // states
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All articles");
  const [sortBy, setSortBy] = useState("Latest");
  const [currentPage, setCurrentPage] = useState(1);

  const categories = useMemo(() => {
    const uniqueCats = Array.from(
      new Set(MOCK_POSTS.map((p) => p.category_id.name)),
    );
    return ["All articles", ...uniqueCats];
  }, []);

  const filteredPosts = useMemo(() => {
    let result = [...MOCK_POSTS];
    if (search) {
      result = result.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase()),
      );
    }
    if (activeCategory !== "All articles") {
      result = result.filter((p) => p.category_id.name === activeCategory);
    }
    if (sortBy === "Latest") {
      result.sort(
        (a, b) =>
          new Date(b.published_at).getTime() -
          new Date(a.published_at).getTime(),
      );
    } else if (sortBy === "Oldest") {
      result.sort(
        (a, b) =>
          new Date(a.published_at).getTime() -
          new Date(b.published_at).getTime(),
      );
    }
    return result;
  }, [search, activeCategory, sortBy]);

  // phân cụm bài viết theo category
  const allCategorySections = useMemo(() => {
    if (activeCategory !== "All articles") return [];
    const targetCats = categories.filter((c) => c !== "All articles");
    return targetCats
      .map((catName) => {
        const postsInCat = [...MOCK_POSTS]
          .filter((p) => p.category_id.name === catName)
          .sort(
            (a, b) =>
              new Date(b.published_at).getTime() -
              new Date(a.published_at).getTime(),
          );
        return { title: catName, posts: postsInCat };
      })
      .filter((section) => section.posts.length > 0);
  }, [activeCategory, categories]);

  const totalPages = useMemo(() => {
    if (activeCategory !== "All articles") {
      return Math.ceil(filteredPosts.length / 9);
    }
    if (allCategorySections.length <= 9) return 1;
    return 1 + Math.ceil((allCategorySections.length - 9) / 10);
  }, [activeCategory, filteredPosts.length, allCategorySections.length]);

  const featuredPost = useMemo(() => {
    if (
      activeCategory !== "All articles" ||
      currentPage !== 1 ||
      filteredPosts.length === 0
    )
      return null;
    return filteredPosts[0];
  }, [activeCategory, currentPage, filteredPosts]);

  const featuredGridPosts = useMemo(() => {
    if (activeCategory !== "All articles" || currentPage !== 1) return [];
    return filteredPosts.slice(1, 5);
  }, [activeCategory, currentPage, filteredPosts]);

  const paginatedSections = useMemo(() => {
    if (activeCategory !== "All articles") return [];
    const startIndex = currentPage === 1 ? 0 : 9 + (currentPage - 2) * 10;
    const endIndex = currentPage === 1 ? 9 : 9 + (currentPage - 1) * 10;
    return allCategorySections.slice(startIndex, endIndex);
  }, [activeCategory, currentPage, allCategorySections]);

  const specificCategoryPosts = useMemo(() => {
    if (activeCategory === "All articles") return [];
    return filteredPosts.slice((currentPage - 1) * 9, currentPage * 9);
  }, [activeCategory, currentPage, filteredPosts]);

  // handlers
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setCurrentPage(1);
  };

  const handleSortChange = (sort: string) => {
    setSortBy(sort);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return {
    categories,
    sortOptions: SORT_OPTIONS,
    search,
    activeCategory,
    sortBy,
    currentPage,
    totalPages,
    featuredPost,
    featuredGridPosts,
    paginatedSections,
    specificCategoryPosts,
    handleSearchChange,
    handleCategoryChange,
    handleSortChange,
    handlePageChange,
  };
}
