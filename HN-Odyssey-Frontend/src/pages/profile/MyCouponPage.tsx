import AccountSidebar from "../../components/profile/AccountSidebar";
import MyCoupon from "../../components/profile/MyCounpon/MyCoupon";
import "./MyCouponPage.css";
import { useCouponManagement } from "../../hooks/profile/useCouponManagement";
import { useRecommendProduct } from "../../hooks/profile/useRecommendProduct";

const MyCouponPage = () => {
  const { coupons } = useCouponManagement();
  const { products: recommendations } = useRecommendProduct();

  return (
    <div className="my-coupon-page-container">
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      <div className="content-wrapper">
        <MyCoupon coupons={coupons} recommendations={recommendations} />
      </div>
    </div>
  );
};

export default MyCouponPage;
