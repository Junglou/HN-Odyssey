import { useParams } from "react-router-dom";
import AccountSidebar from "../../components/profile/AccountSidebar";
import "./OrderDetailPage.css";
import OrderDetail from "../../components/profile/OrderDetail/OrderDetail";
import { useOrderDetail } from "../../hooks/profile/useOrderDetail";

const OrderDetailPage = () => {
  const { orderId = "" } = useParams<{ orderId: string }>();
  const { order, loading, refresh } = useOrderDetail(orderId);

  return (
    <div className="my-profile-page-container">
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      <div className="content-wrapper">
        <OrderDetail
          orderId={orderId}
          order={order}
          loading={loading}
          onRefresh={refresh}
        />
      </div>
    </div>
  );
};

export default OrderDetailPage;
