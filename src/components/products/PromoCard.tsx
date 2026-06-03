import type { BannerItem } from "../../hooks/products/useProductList";
import { usePromoCard } from "../../hooks/products/usePromoCard";
import "./PromoCard.css";

export default function PromoCard({ banner }: { banner: BannerItem }) {
  const { handleBannerClick } = usePromoCard(banner.targetUrl);

  return (
    <div
      // Đổi thành class shape tương ứng để CSS bắt được
      className={`pl-promo-card shape-${banner.shape}`}
      style={{ backgroundImage: `url(${banner.imageDesktopUrl})` }}
      onClick={handleBannerClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleBannerClick()}
    >
      <div className="pl-promo-overlay"></div>
      <div className="pl-promo-content">
        <h2 className="pl-promo-title">{banner.title}</h2>
        <p className="pl-promo-subtitle">{banner.subtitle}</p>
        <button className="pl-promo-btn">{banner.btnText}</button>
      </div>
    </div>
  );
}
