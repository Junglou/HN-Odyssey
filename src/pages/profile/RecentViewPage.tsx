import { useState, useEffect } from "react";
import AccountSidebar from "../../components/profile/AccountSidebar";
import RecentView from "../../components/profile/RecentView/RecentView"; // Import Component mới đổi tên
import "./RecentViewPage.css"; // CSS Layout trang
import { useProfileManagement } from "../../hooks/profile/useProfileManagement";
import { productList } from "../../hooks/profile/productData";
import type { Product } from "../../types/product";

const RecentViewPage = () => {
  const {
    user,
  } = useProfileManagement();
  // 1. Quản lý State
  const [loading, setLoading] = useState(true);

  // 2. Giả lập API
  useEffect(() => {
    // Gọi API thật ở đây. Tạm thời setTimeout giả lập
    setTimeout(() => {
      setLoading(false);
    }, 500);
  }, []);

  const getRandomProducts = (count: number = 3): Product[] => {
    const shuffled = [...productList].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  // Data mẫu cho RecommendationList
  const recommendations: Product[] = getRandomProducts();

  if (loading || !user) return <div>Loading...</div>;

  // 4. Render
  return (
    <div className="recent-view-page-container">
      {/* Sidebar (Menu trái) */}
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      {/* Content (Nội dung phải) */}
      <div className="content-wrapper">
        <RecentView
          recommendations={recommendations}
        />
      </div>
    </div>
  );
};

export default RecentViewPage;
