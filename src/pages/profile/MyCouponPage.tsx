import AccountSidebar from "../../components/profile/AccountSidebar";
import MyCoupon from "../../components/profile/MyCounpon/MyCoupon";
import "./MyCouponPage.css"; // CSS Layout trang
import { useCouponManagement } from "../../hooks/profile/useCouponManagement";
import { productList } from "../../hooks/profile/productData";
import type { Product } from "../../types/product";

const MyCouponPage = () => {
  const { coupons, loading } = useCouponManagement();

  const getRandomProducts = (count: number = 3): Product[] => {
    const shuffled = [...productList].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  // Data mẫu cho RecommendationList
  const recommendations: Product[] = getRandomProducts();

  if (loading) return <div>Loading...</div>;

  // 4. Render
  return (
    <div className="coupon-page-container">
      {/* Sidebar (Menu trái) */}
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      {/* Content (Nội dung phải) */}
      <div className="content-wrapper">
        <MyCoupon recommendations={recommendations} coupons={coupons} />
      </div>
    </div>
  );
};

export default MyCouponPage;
