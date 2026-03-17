import { useState, useEffect } from "react";
import AccountSidebar from "../../components/profile/AccountSidebar";
import OrderManagement from "../../components/profile/OrderManagement/OrderManagement"; // Import Component mới đổi tên
import "./OrderManagementPage.css"; // CSS Layout trang
import type {
  UserProfile,
  ProductRecommendation,
  UserAddress,
  UserOrder,
} from "../../types/user";

const OrderMangementPage = () => {
  // 1. Quản lý State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // 2. Giả lập API
  useEffect(() => {
    // Gọi API thật ở đây. Tạm thời setTimeout giả lập
    setTimeout(() => {
      setUser({
        avatar: "https://placehold.co/150",
        firstName: "Huy",
        lastName: "Nguyen",
        gender: "Male",
        birthday: "01/01/2000",
        displayName: "Huy Odyssey",
        username: "huynguyen",
        email: "user@gmail.com",
        phone: "028 4532 6499",
      });
      setLoading(false);
    }, 500);
  }, []);

  // Data mẫu cho RecommendationList
  const recommendations: ProductRecommendation[] = [
    {
      id: 1,
      name: "Ration 1",
      description: "Instant energy supply...",
      price: 5.99,
      image: "https://placehold.co/100",
    },
    {
      id: 2,
      name: "Solo kit 1",
      description: "Knife, fire starter...",
      price: 15.99,
      image: "https://placehold.co/100",
    },
    {
      id: 3,
      name: "Vital 1",
      description: "Basic wound care...",
      price: 35.99,
      image: "https://placehold.co/100",
    },
  ];

  const addresses: UserAddress[] = [
    {
      receiverName: "John",
      address: "28 whatever Str",
      city: "Ho Chi Minh",
      country: "Vietnam",
    },
    {
      receiverName: "Alex",
      address: "39 whatever Str",
      city: "Los Angeles",
      country: "US",
    },
    {
      receiverName: "Jenny",
      address: "90 whatever Str",
      city: "Ha Noi",
      country: "Vietnam",
    },
    {
      receiverName: "Jake",
      address: "10 whatever Str",
      city: "California",
      country: "US",
    },
  ];

  const order: UserOrder[] = [
    {
      address: addresses[0],
      product: recommendations,
      orderDate: "26/12/2025",
      shipDate: "28/12/2025",
      shipFee: "10.00$",
      status: "Confirming",
    },
    {
      address: addresses[1],
      product: recommendations,
      orderDate: "26/12/2025",
      shipDate: "28/12/2025",
      shipFee: "10.00$",
      status: "Confirming",
    },
    {
      address: addresses[2],
      product: recommendations,
      orderDate: "28/12/2025",
      shipDate: "30/12/2025",
      shipFee: "15.00$",
      status: "Shipping",
    },
    {
      address: addresses[3],
      product: recommendations,
      orderDate: "01/01/2026",
      shipDate: "03/01/2026",
      shipFee: "20.00$",
      status: "Completed",
    },
  ];

  if (loading || !user) return <div>Loading...</div>;

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
          user={user}
          recommendations={recommendations}
          order={order}
        />
      </div>
    </div>
  );
};

export default OrderMangementPage;
