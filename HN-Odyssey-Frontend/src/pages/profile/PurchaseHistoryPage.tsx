import AccountSidebar from "../../components/profile/AccountSidebar";
import PurchaseHistory from "../../components/profile/PurchaseHistory/PurchaseHistory";
import "./OrderManagementPage.css";
import { useHistoryManagement } from "../../hooks/profile/useHistoryManagement";
import { useRecommendProduct } from "../../hooks/profile/useRecommendProduct";

const PurchaseHistoryPage = () => {
  const { orders, pagination, actions } = useHistoryManagement();
  const { products: recommendations } = useRecommendProduct();

  return (
    <div className="my-profile-page-container">
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      <div className="content-wrapper">
        <PurchaseHistory
          order={orders}
          recommendations={recommendations}
          pagination={pagination}
          onPageChange={(p) => actions.changePage(p)}
        />
      </div>
    </div>
  );
};

export default PurchaseHistoryPage;
