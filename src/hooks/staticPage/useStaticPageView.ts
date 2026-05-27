// imports
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

// interfaces
export interface StaticPageData {
  title: string;
  content: string;
}

// mock data
const MOCK_DB: Record<string, StaticPageData> = {
  "shipping-policy": {
    title: "Shipping Policy",
    content:
      "<h2>Chính sách giao hàng</h2><p>Đơn hàng sẽ được xử lý trong vòng 24h. Hình ảnh minh họa:</p><img src='https://placehold.co/800x400/png?text=Shipping+Banner' alt='Shipping' />",
  },
  faqs: {
    title: "Frequently Asked Questions",
    content:
      "<h2>Câu hỏi thường gặp</h2><ul><li><strong>Hàng bao lâu thì tới?</strong> Thường là 3-5 ngày.</li><li><strong>Có được kiểm tra hàng không?</strong> Có, bạn được phép đồng kiểm.</li></ul>",
  },
  about: {
    title: "About Us",
    content:
      "<h2>Về H&N Odyssey</h2><p>Chúng tôi là đội ngũ đam mê công nghệ và khám phá. Dưới đây là bảng thông tin:</p><table border='1'><tr><th>Năm</th><th>Thành tựu</th></tr><tr><td>2026</td><td>Ra mắt website</td></tr></table>",
  },
};

// hook
export function useStaticPageView() {
  // hooks/states
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<StaticPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // side effects
  useEffect(() => {
    const fetchPageData = () => {
      setIsLoading(true);
      setError(null);
      setData(null);

      if (!slug) {
        setError("Không tìm thấy đường dẫn.");
        setIsLoading(false);
        return null;
      }

      const fetchTimer = setTimeout(() => {
        const foundPage = MOCK_DB[slug];

        if (foundPage) {
          setData(foundPage);
        } else {
          setError("Trang bạn tìm kiếm không tồn tại hoặc đã bị gỡ bỏ.");
        }
        setIsLoading(false);
      }, 800);
      return fetchTimer;
    };

    const timerId = fetchPageData();
    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [slug]);

  return {
    data,
    isLoading,
    error,
  };
}
