import AccountSidebar from "../../components/profile/AccountSidebar";
import PurchaseHistory from "../../components/profile/PurchaseHistory/PurchaseHistory"; // Import Component mới đổi tên
import "./PurchaseHistoryPage.css"; // CSS Layout trang
import { useHistoryManagement } from "../../hooks/profile/useHistoryManagement";
import { productList } from "../../hooks/profile/productData";
import type { Product } from "../../types/product";

const PurchaseHistoryPage = () => {
  // 1. Quản lý State
  const { orders, loading } = useHistoryManagement();

  const getRandomProducts = (count: number = 3): Product[] => {
    const shuffled = [...productList].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const recommendations = getRandomProducts();

  if (loading) return <div>Loading...</div>;

  // 4. Render
  return (
    <div className="history-page-container">
      {/* Sidebar (Menu trái) */}
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      {/* Content (Nội dung phải) */}
      <div className="content-wrapper">
        <PurchaseHistory recommendations={recommendations} order={orders} />
      </div>
    </div>
  );
};

export default PurchaseHistoryPage;
