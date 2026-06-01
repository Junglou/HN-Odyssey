import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import AccountSidebar from "../../components/profile/AccountSidebar";
import "./OrderDetailPage.css";
import OrderDetail from "../../components/profile/OrderDetail/OrderDetail";
import type { UserOrder } from "../../types/user";

type OrderDetailLocationState = {
  order?: UserOrder;
};

const OrderDetailPage = () => {
  const { orderId = "" } = useParams<{ orderId: string }>();
  const { state } = useLocation();
  const orderFromState =
    (state as OrderDetailLocationState | null)?.order ?? null;

  const order = useMemo((): UserOrder | null => {
    if (
      orderFromState &&
      (orderFromState.id === orderId || orderFromState.orderCode === orderId)
    ) {
      return orderFromState;
    }

    return null;
  }, [orderFromState, orderId]);

  return (
    <div className="my-profile-page-container">
      <div className="sidebar-wrapper">
        <AccountSidebar />
      </div>

      <div className="content-wrapper">
        <OrderDetail orderId={orderId} order={order} />
      </div>
    </div>
  );
};

export default OrderDetailPage;
