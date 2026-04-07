import "./MyWishlist.css";
import type { Product } from "../../../types/product";
import RecommendationList from "../../common/RecommendationList";
import WishlistBox from "./MyWishlistBox";

interface MyWishlistProps {
  wishlist: Product[];
  recommendations: Product[];
  onDeleteItem: (productId: string) => void;
}

const MyWishlist = ({
  wishlist,
  recommendations,
  onDeleteItem,
}: MyWishlistProps) => {
  return (
    <div className="wishlist-card">
      <div className="wishlist-header">
        <h1 className="wishlist-title">Wishlist Management</h1>
      </div>

      <div className="wishlist-internal-grid">
        {/* CỘT 1: Box quản lý đơn hàng */}
        <div className="grid-section section-wishlist">
          {wishlist.map((product) => (
            <WishlistBox
              key={product.id}
              product={product}
              onDelete={() => onDeleteItem(product.id)}
            />
          ))}
        </div>

        {/* CỘT 2: RECOMMENDATIONS */}
        <div className="grid-section section-recs">
          <RecommendationList products={recommendations} />
        </div>
      </div>
    </div>
  );
};

export default MyWishlist;
