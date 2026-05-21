// imports
import type { BannerItem } from "../../hooks/products/useProductList";
import { usePromoCard } from "../../hooks/products/usePromoCard";
import "./PromoCard.css";

// component
export default function PromoCard({ banner }: { banner: BannerItem }) {
  // Nhận hàm xử lý
  const { handleBannerClick } = usePromoCard(banner.targetUrl);

  // render
  return (
    <div
      className={`pl-promo-card span-${banner.span}`}
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
