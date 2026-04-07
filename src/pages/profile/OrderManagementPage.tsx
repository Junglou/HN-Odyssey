import AccountSidebar from "../../components/profile/AccountSidebar";
import OrderManagement from "../../components/profile/OrderManagement/OrderManagement"; // Import Component mới đổi tên
import "./OrderManagementPage.css"; // CSS Layout trang
import { useOrderManagement } from "../../hooks/profile/useOrderManagement";
import { productList } from "../../hooks/profile/productData";
import type { Product } from "../../types/product";

const OrderMangementPage = () => {

  const { orders, loading } = useOrderManagement();

  const getRandomProducts = (count: number = 3): Product[] => {
      const shuffled = [...productList].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    };

  // Data mẫu cho RecommendationList
  const recommendations = getRandomProducts();

  if (loading) return <div>Loading...</div>;

  // 4. Render
  return (
    <div className="my-profile-page-container">
      {/* Sidebar (Menu trái) */}
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      {/* Content (Nội dung phải) */}
      <div className="content-wrapper">
        <OrderManagement
          recommendations={recommendations}
          order={orders}
        />
      </div>
    </div>
  );
};

export default OrderMangementPage;
