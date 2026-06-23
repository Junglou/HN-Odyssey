import { useState, useMemo, useEffect } from "react";
import axiosClient from "../../api/axiosClient";

// types
export interface BlogNewsPost {
  id: string;
  slug: string;
  title: string;
  summary: string;
  thumbnail: string;
  category_id: { _id: string; name: string };
  author_id: { _id: string; full_name: string };
  published_at: string;
}

// Định nghĩa chuẩn Type từ Backend trả về để fix lỗi Eslint no-explicit-any
export interface BEPostResponse {
  _id: string;
  slug?: string;
  title?: string;
  meta_description?: string;
  summary?: string;
  thumbnail?: string;
  category_id?: { _id: string; name: string } | null;
  author_id?: { _id: string; full_name?: string; name?: string } | null;
  published_at?: string;
  created_at?: string;
}

const SORT_OPTIONS = ["Latest", "Oldest", "Most Popular"];

// Helper xử lý chuẩn hóa link ảnh gốc của backend
export const getFullImageUrl = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("data:image")) return path;

  const baseUrl = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "http://localhost:8080";

  return `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
};

// hook
export function useBlogNews() {
  // states Data gốc từ API
  const [fetchedPosts, setFetchedPosts] = useState<BlogNewsPost[]>([]);

  // states UI hiện tại (Giữ nguyên không đổi để đảm bảo logic render)
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All articles");
  const [sortBy, setSortBy] = useState("Latest");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch dữ liệu thật từ Backend
  useEffect(() => {
    const fetchPublicPosts = async () => {
      try {
        const res = await axiosClient.get("/marketing/content/public/posts", {
          params: {
            status: "PUBLISHED",
            limit: 1000,
          },
        });

        if (res.data?.success && Array.isArray(res.data.data?.data)) {
          // Mapping dữ liệu từ BE về format giao diện FE đang dùng
          // Đã thay 'any' bằng 'BEPostResponse' để chiều lòng ESLint
          const mappedPosts: BlogNewsPost[] = res.data.data.data.map(
            (post: BEPostResponse) => ({
              id: post._id,
              slug: post.slug || "",
              title: post.title || "",
              summary: post.meta_description || post.summary || "",
              thumbnail: getFullImageUrl(post.thumbnail || ""),
              category_id:
                typeof post.category_id === "object" &&
                post.category_id !== null
                  ? { _id: post.category_id._id, name: post.category_id.name }
                  : { _id: "", name: "Uncategorized" },
              author_id:
                typeof post.author_id === "object" && post.author_id !== null
                  ? {
                      _id: post.author_id._id,
                      full_name:
                        post.author_id.full_name ||
                        post.author_id.name ||
                        "Admin",
                    }
                  : { _id: "", full_name: "Admin" },
              published_at:
                post.published_at ||
                post.created_at ||
                new Date().toISOString(),
            }),
          );

          setFetchedPosts(mappedPosts);
        }
      } catch (error) {
        console.error("Failed to fetch public posts:", error);
      }
    };

    fetchPublicPosts();
  }, []);

  // Lấy danh mục tự động từ danh sách bài viết thật
  const categories = useMemo(() => {
    const uniqueCats = Array.from(
      new Set(fetchedPosts.map((p) => p.category_id?.name || "Uncategorized")),
    );
    return ["All articles", ...uniqueCats];
  }, [fetchedPosts]);

  // Bộ lọc logic (Dùng data thật đã fetch)
  const filteredPosts = useMemo(() => {
    let result = [...fetchedPosts];

    if (search) {
      result = result.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase()),
      );
    }

    if (activeCategory !== "All articles") {
      result = result.filter(
        (p) => (p.category_id?.name || "Uncategorized") === activeCategory,
      );
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
  }, [search, activeCategory, sortBy, fetchedPosts]);

  // Nhóm danh mục để render các Section (Giữ nguyên logic)
  const allCategorySections = useMemo(() => {
    if (activeCategory !== "All articles") return [];

    const targetCats = categories.filter((c) => c !== "All articles");

    return targetCats
      .map((catName) => {
        const postsInCat = [...fetchedPosts]
          .filter((p) => (p.category_id?.name || "Uncategorized") === catName)
          .sort(
            (a, b) =>
              new Date(b.published_at).getTime() -
              new Date(a.published_at).getTime(),
          );
        return { title: catName, posts: postsInCat };
      })
      .filter((section) => section.posts.length > 0);
  }, [activeCategory, categories, fetchedPosts]);

  // === TỪ ĐÂY TRỞ XUỐNG CÁC PHÉP TOÁN PHÂN TRANG HOẠT ĐỘNG AUTO THEO DATA MỚI ===

  const totalPages = useMemo(() => {
    if (activeCategory !== "All articles") {
      return Math.ceil(filteredPosts.length / 9);
    }
    if (allCategorySections.length <= 9) return 1;
    return 1 + Math.ceil((allCategorySections.length - 9) / 10);
  }, [activeCategory, filteredPosts.length, allCategorySections.length]);

  const featuredPost = useMemo(() => {
    if (currentPage !== 1 || filteredPosts.length === 0) return null;
    return filteredPosts[0];
  }, [currentPage, filteredPosts]);

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
    const startIndex = currentPage === 1 ? 1 : (currentPage - 1) * 9;
    const endIndex = currentPage === 1 ? 9 : currentPage * 9;
    return filteredPosts.slice(startIndex, endIndex);
  }, [activeCategory, currentPage, filteredPosts]);

  // === HANDLERS ===

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

  // Trả về exactly 100% properties mà file TSX đang chờ
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
