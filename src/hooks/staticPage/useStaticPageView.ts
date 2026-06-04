import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";

export interface StaticPageData {
  title: string;
  content: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data: StaticPageData;
}

export function useStaticPageView() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<StaticPageData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPageData = async () => {
      setIsLoading(true);
      setError(null);
      setData(null);

      if (!slug) {
        setError("Không tìm thấy đường dẫn.");
        setIsLoading(false);
        return;
      }

      try {
        // Lấy dữ liệu trang tĩnh từ API public
        const response = await axiosClient.get<ApiResponse>(
          `/marketing/content/public/pages/${slug}`,
        );

        if (response.data && response.data.data) {
          setData(response.data.data);
        } else {
          setError("Dữ liệu trang không hợp lệ.");
        }
      } catch (err: unknown) {
        // Xử lý lỗi an toàn, tránh sử dụng kiểu any
        const errorObj = err as { message?: string };
        const errorMessage =
          errorObj.message ||
          "Trang bạn tìm kiếm không tồn tại hoặc đã bị gỡ bỏ.";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    // Khởi chạy hàm lấy dữ liệu
    void fetchPageData();
  }, [slug]);

  return {
    data,
    isLoading,
    error,
  };
}
