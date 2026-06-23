import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import { getFullImageUrl, type BlogNewsPost } from "./useBlogNews";

// Kế thừa type từ hook cũ và bổ sung thêm nội dung html
export interface BlogDetailData extends Omit<BlogNewsPost, "summary"> {
  content: string;
  metaTitle: string;
  metaDescription: string;
  // [FIX ESLINT 1] Thay any[] bằng unknown[] hoặc string[] (ở đây dùng string[] cho chuẩn dữ liệu ID)
  attachedProducts: string[];
}

export function useBlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogDetailData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    const fetchPostDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        // GỌI ĐÚNG API PUBLIC TỪ BE ĐỂ TRÁNH LỖI 401 UNAUTHORIZED
        const res = await axiosClient.get(
          `/marketing/content/public/posts/${slug}`,
        );

        if (res.data?.success && res.data?.data) {
          const rawPost = res.data.data;

          setPost({
            id: rawPost._id,
            // [FIX TYPESCRIPT] Bổ sung dòng slug này vào để map đúng interface
            slug: rawPost.slug || slug,
            title: rawPost.title || "",
            content: rawPost.content || "",
            thumbnail: getFullImageUrl(rawPost.thumbnail || ""),
            category_id:
              typeof rawPost.category_id === "object" &&
              rawPost.category_id !== null
                ? {
                    _id: rawPost.category_id._id,
                    name: rawPost.category_id.name,
                  }
                : { _id: "", name: "Uncategorized" },
            author_id:
              typeof rawPost.author_id === "object" &&
              rawPost.author_id !== null
                ? {
                    _id: rawPost.author_id._id,
                    full_name:
                      rawPost.author_id.full_name ||
                      rawPost.author_id.name ||
                      "Admin",
                  }
                : { _id: "", full_name: "Admin" },
            published_at: rawPost.published_at
              ? new Date(rawPost.published_at).toISOString().split("T")[0]
              : rawPost.created_at
                ? new Date(rawPost.created_at).toISOString().split("T")[0]
                : new Date().toISOString().split("T")[0],
            metaTitle: rawPost.meta_title || "",
            metaDescription: rawPost.meta_description || "",
            attachedProducts: rawPost.embedded_product_ids || [],
          });
        } else {
          setError("Không tìm thấy bài viết");
        }
        // [FIX ESLINT 2] Thay (err: any) bằng (err: unknown) và ép kiểu an toàn
      } catch (err: unknown) {
        console.error("Lỗi khi tải chi tiết bài viết:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Đã xảy ra lỗi khi tải bài viết";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchPostDetail();
  }, [slug]);

  return { post, loading, error };
}
