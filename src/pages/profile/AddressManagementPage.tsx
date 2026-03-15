import { useState, useEffect } from "react";
import AccountSidebar from "../../components/profile/AccountSidebar";
import AddressManagement from "../../components/profile/AddressManagement/AddressManagement"; // Import Component mới đổi tên
import "./AddressManagementPage.css"; // CSS Layout trang
import type { UserProfile, ProductRecommendation, UserAddress } from "../../types/user";

const AddressMangementPage = () => {
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

  const addresses: UserAddress[]= [ 
    {
      receiverName: "John",
      address: "28 whatever Str",
      city: "Ho Chi Minh",
      country: "Vietnam"
    },
    {
      receiverName: "Alex",
      address: "39 whatever Str",
      city: "Los Angeles",
      country: "US"
    },
    {
      receiverName: "Jenny",
      address: "90 whatever Str",
      city: "Ha Noi",
      country: "Vietnam"
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
        <AddressManagement
          user={user}
          address={addresses}
          recommendations={recommendations}
        />
      </div>
    </div>
  );
};

export default AddressMangementPage;
