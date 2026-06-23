import type { CustomerCoupon } from "../../../hooks/profile/useCouponManagement";
import "./MyCouponBox.css";

interface MyCouponBoxProps {
  coupon: CustomerCoupon;
}

const MyCouponBox = ({ coupon }: MyCouponBoxProps) => {
  const discountLabel =
    coupon.discountType === "Percentage"
      ? `${coupon.discountValue} off`
      : `${coupon.discountValue} off`;

  const getStatusLabel = (status: CustomerCoupon["status"]) => {
    switch (status) {
      case "Active":
        return "Active";
      case "Inactive":
        return "Inactive";
      case "Scheduled":
        return "Scheduled";
      case "Expired":
        return "Expired";
      case "Draft":
        return "Draft";
      default:
        return status;
    }
  };

  return (
    <div className="box-container">
      <div className="box-content">
        <div className="box-infor">
          <div className="coupon-thumbnail-container">
            <div className="coupon-img-container">
              <div className="coupon-img-placeholder">
                <span>{coupon.discountValue}</span>
              </div>
            </div>
            <div className="coupon-detail-container">
              <span className="lbl-coupon-text">{coupon.code}</span>
              {coupon.description && (
                <div className="price-container">
                  <span className="span-text">
                    <strong>Description: </strong>
                    {coupon.description}
                  </span>
                </div>
              )}
              <div className="price-container">
                <span className="span-text">
                  <strong>Discount: </strong>
                  {discountLabel}
                </span>
              </div>
              <div className="price-container">
                <span className="span-text">
                  <strong>Used: </strong>
                  {coupon.usedCount} / {coupon.totalUses}
                </span>
              </div>
              {coupon.minimumOrderValue != null &&
                coupon.minimumOrderValue > 0 && (
                  <div className="price-container">
                    <span className="span-text">
                      <strong>Minimum Order: </strong>$
                      {coupon.minimumOrderValue.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
              {coupon.maximumDiscountAmount != null &&
                coupon.maximumDiscountAmount > 0 && (
                  <div className="price-container">
                    <span className="span-text">
                      <strong>Max Discount: </strong>$
                      {coupon.maximumDiscountAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
              <div className="price-container">
                <span className="span-text">
                  <strong>Time: </strong>
                  {coupon.startDate} - {coupon.endDate}
                </span>
              </div>
              <div className="price-container">
                <span className="span-text">
                  <strong>Status: </strong>
                  {getStatusLabel(coupon.status)}
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
