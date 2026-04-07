import { useState, useEffect } from "react";
import AccountSidebar from "../../components/profile/AccountSidebar";
import "./OrderDetailPage.css"; // CSS Layout trang
import OrderDetail from "../../components/profile/OrderDetail/OrderDetail";
import { useProfileManagement } from "../../hooks/profile/useProfileManagement";

const OrderDetailPage = () => {
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
        <OrderDetail user={user} />
      </div>
    </div>
  );
};

export default OrderDetailPage;
