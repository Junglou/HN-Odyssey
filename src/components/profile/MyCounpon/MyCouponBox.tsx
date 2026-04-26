import type { Coupon } from "../../../types/coupon";
import "./MyCouponBox.css";

interface MyCouponBoxProps {
  coupon: Coupon;
}

const MyCouponBox = ({ coupon }: MyCouponBoxProps) => {
  const discountLabel =
    coupon.discountType === "percentage"
      ? `${coupon.discountValue}% off`
      : `$${coupon.discountValue.toLocaleString()} off`;

  const validUntil = new Date(coupon.endDate).toLocaleDateString("vi-VN");
  const validFrom = new Date(coupon.startDate).toLocaleDateString("vi-VN");

  return (
    <div className="box-container">
      <div className="box-content">
        <div className="box-infor">
          <div className="coupon-thumbnail-container">
            <div className="coupon-img-container">
              <img src={coupon.image} className="coupon-img" alt={coupon.name} />
            </div>
            <div className="coupon-detail-container">
              <span className="lbl-coupon-text">{coupon.name}</span>
              <div className="des-container">
                <span className="span-text">
                  <strong>Description: </strong>
                  {coupon.description}
                </span>
              </div>
              <div className="price-container">
                <span className="span-text">
                  <strong>Coupon code: </strong>
                  {coupon.couponCode}
                </span>
              </div>
              <div className="price-container">
                <span className="span-text">
                  <strong>Discount: </strong>
                  {discountLabel}
                </span>
              </div>
                <div className="price-container">
                  <span className="span-text">
                    <strong>Minimum Purchase: </strong>
                    ${coupon.minimumPurchase.toLocaleString()}
                  </span>
                </div>
              <div className="price-container">
                <span className="span-text">
                  <strong>Time: </strong>
                  {validFrom} - {validUntil}
                </span>
              </div>
              <div className="price-container">
                <span className="span-text">
                  <strong>Status: </strong>
                  {coupon.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyCouponBox;
