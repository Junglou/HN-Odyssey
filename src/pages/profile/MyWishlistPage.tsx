import AccountSidebar from "../../components/profile/AccountSidebar";
import MyWishlist from "../../components/profile/MyWishlist/MyWishList";
import "./MyWishlistPage.css";
import { useWishlistManagement } from "../../hooks/profile/useWishlistManagement";
import { useRecommendProduct } from "../../hooks/profile/useRecommendProduct";

const MyWishlistPage = () => {
  const { wishlist, pagination, actions, deleteWishlistItem } =
    useWishlistManagement();
  const { products: recommendations } = useRecommendProduct();

  return (
    <div className="my-wishlist-page-container">
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      <div className="content-wrapper">
        <MyWishlist
          wishlist={wishlist}
          recommendations={recommendations}
          pagination={pagination}
          onPageChange={(p) => actions.changePage(p)}
          onDeleteItem={deleteWishlistItem}
        />
      </div>
    </div>
  );
};

export default MyWishlistPage;
