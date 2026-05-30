import { useMemo } from "react";
import AccountSidebar from "../../components/profile/AccountSidebar";
import MyWishlist from "../../components/profile/MyWishlist/MyWishList"; // Import Component mới đổi tên
import "./MyWishlistPage.css"; // CSS Layout trang
import { useWishlistManagement } from "../../hooks/profile/useWishlistManagement";
import { productList } from "../../hooks/profile/productData";
import type { Product } from "../../types/product";

const MyWishlistPage = () => {
  const { wishlist, loading, deleteWishlistItem } = useWishlistManagement();

  const getRandomProducts = (count: number = 3): Product[] => {
    const shuffled = [...productList].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  const recommendations = useMemo(() => getRandomProducts(), []);

  if (loading) return <div>Loading...</div>;

  // 4. Render
  return (
    <div className="my-wishlist-page-container">
      {/* Sidebar (Menu trái) */}
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      {/* Content (Nội dung phải) */}
      <div className="content-wrapper">
        <MyWishlist
          wishlist={wishlist}
          recommendations={recommendations}
          onDeleteItem={deleteWishlistItem}
        />
      </div>
    </div>
  );
};

export default MyWishlistPage;
