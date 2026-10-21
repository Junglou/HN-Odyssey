import "./ProductCard.css";
import "./ProductCardSkeleton.css";

export default function ProductCardSkeleton() {
  return (
    <div className="pl-product-card pl-skeleton-card" aria-hidden="true">
      <div className="pl-card-image-wrap pl-skeleton-block" />
      <div className="pl-card-info">
        <div className="pl-skeleton-line pl-skeleton-title" />
        <div className="pl-skeleton-line pl-skeleton-desc" />
        <div className="pl-card-line" />
        <div className="pl-card-footer">
          <div className="pl-skeleton-line pl-skeleton-price" />
          <div className="pl-skeleton-line pl-skeleton-btn" />
        </div>
      </div>
    </div>
  );
}
