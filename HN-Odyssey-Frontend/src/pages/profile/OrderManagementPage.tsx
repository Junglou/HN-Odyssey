import AccountSidebar from "../../components/profile/AccountSidebar";
import OrderManagement from "../../components/profile/OrderManagement/OrderManagement";
import "./OrderManagementPage.css";
import { useOrderManagement } from "../../hooks/profile/useOrderManagement";
import type { OrderStatusFE } from "../../hooks/profile/useOrderManagement";
import { useRecommendProduct } from "../../hooks/profile/useRecommendProduct";

const OrderMangementPage = () => {
  const { orders, pagination, actions, statusFilter } = useOrderManagement();
  const { products: recommendations } = useRecommendProduct();

  return (
    <div className="my-profile-page-container">
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      <div className="content-wrapper">
        <OrderManagement
          order={orders}
          recommendations={recommendations}
          pagination={pagination}
          onPageChange={(p) => actions.changePage(p)}
          statusFilter={statusFilter}
          onStatusChange={(s) =>
            actions.changeStatusFilter(s as OrderStatusFE | "All")
          }
        />
      </div>
    </div>
  );
};

export default OrderMangementPage;
