import { Link } from "react-router-dom";
import "./OrderDetail.css";
import {
  getOrderDetailLineItems,
  getOrderLineItems,
  getOrderShippingAddress,
  type OrderProduct,
  type UserOrder,
  type UserOrderDetail,
} from "../../../types/user";
import { TimelineCheckIcon } from "../../../assets/icons/OrderManagementIcons";
import { BackArrowIcon } from "../../../assets/icons/CategoryIcons";
import { mapOrderStatusLabel } from "../../../utils/mapCustomerOrder";

interface OrderDetailProps {
  orderId: string;
  order: UserOrder | UserOrderDetail | null;
  loading?: boolean;
  onRefresh?: () => void;
}

const formatMoney = (value: number) =>
  `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const isUserOrderDetail = (
  order: UserOrder | UserOrderDetail,
): order is UserOrderDetail => "items" in order;

const getStatusLabel = (order: UserOrder | UserOrderDetail): string =>
  "statusLabel" in order
    ? order.statusLabel
    : mapOrderStatusLabel(order.status);

const getLineItems = (order: UserOrder | UserOrderDetail): OrderProduct[] =>
  isUserOrderDetail(order)
    ? getOrderDetailLineItems(order)
    : getOrderLineItems(order);

const statusBadgeKey = (statusLabel: string) => {
  const map: Record<string, string> = {
    Pending: "Pending",
    Processing: "Packaging",
    Delivering: "Shipping",
    Delivered: "Delivered",
    Canceled: "Cancelled",
  };
  return map[statusLabel] ?? "Pending";
};

const paymentBadgeKey = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("paid") && !normalized.includes("un")) return "Paid";
  if (normalized.includes("refund")) return "Refunded";
  return "Unpaid";
};

type TimelineStep = {
  status: string;
  date: string;
  description: string;
  isCompleted: boolean;
};

const buildTimeline = (order: UserOrder | UserOrderDetail): TimelineStep[] => {
  if (isUserOrderDetail(order) && order.timeline.length > 0) {
    return order.timeline.map((entry) => ({
      status: entry.status,
      date: entry.timestamp,
      description: entry.note?.trim() || entry.actor?.trim() || "",
      isCompleted: true,
    }));
  }

  const statusLabel = getStatusLabel(order);

  return [
    {
      status: "Order placed",
      date: order.createdAt,
      description: "",
      isCompleted: true,
    },
    {
      status: statusLabel ? `Status: ${statusLabel}` : "Order updated",
      date: order.updatedAt,
      description: "",
      isCompleted: Boolean(statusLabel),
    },
  ];
};

const formatDisplayDate = (value: string) => {
  if (!value.trim()) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const orderMatchesRoute = (
  order: UserOrder | UserOrderDetail,
  routeOrderId: string,
): boolean => {
  const id = routeOrderId.trim();
  if (!id) return false;
  return order.id === id || order.orderCode === id;
};

const OrderDetail = ({
  orderId,
  order,
  loading = false,
  onRefresh,
}: OrderDetailProps) => {
  if (loading) {
    return (
      <div className="pod-page" aria-busy="true">
        <div className="pod-header">
          <div className="pod-title-group">
            <h1 className="pod-title">Order details</h1>
          </div>
          <Link to="/profile/orders" className="pod-back-link">
            <BackArrowIcon className="pod-back-link-icon" aria-hidden />
            Back to orders
          </Link>
        </div>
        <div className="pod-body pod-body-empty">
          <p className="pod-loading-message">Loading order details…</p>
        </div>
      </div>
    );
  }

  const isValidOrder = order != null && orderMatchesRoute(order, orderId);

  if (!isValidOrder) {
    return (
      <div className="pod-page">
        <div className="pod-header">
          <div className="pod-title-group">
            <h1 className="pod-title">Order not found</h1>
          </div>
          <Link to="/profile/orders" className="pod-back-link">
            <BackArrowIcon className="pod-back-link-icon" aria-hidden />
            Back to orders
          </Link>
        </div>
        <div className="pod-body pod-body-empty">
          <div className="pod-col-info">
            <p className="pod-empty-message">
              We could not load this order. It may not exist, or you may not
              have access to view it.
            </p>
            {onRefresh ? (
              <button
                type="button"
                className="pod-retry-btn"
                onClick={onRefresh}
              >
                Try again
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const lineItems = getLineItems(order);
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.price * (item.quantity ?? 1),
    0,
  );
  const shipFee = isUserOrderDetail(order)
    ? order.actualShippingFee
    : (order.shippingFee ?? 0);
  const total =
    typeof order.totalAmount === "number" && order.totalAmount > 0
      ? order.totalAmount
      : subtotal + shipFee;
  const shipping = order.shippingInfo;
  const payment = isUserOrderDetail(order) ? order.payment : null;
  const timeline = buildTimeline(order);
  const statusLabel = getStatusLabel(order);
  const statusKey = statusBadgeKey(statusLabel);

  return (
    <div className="pod-page">
      <div className="pod-header">
        <div className="pod-title-group">
          <h1 className="pod-title">{order.orderCode || orderId}</h1>
          <span className={`pod-badge pod-badge-status-${statusKey}`}>
            {statusLabel}
          </span>
          {payment ? (
            <span
              className={`pod-badge pod-badge-payment-${paymentBadgeKey(payment.status)}`}
            >
              {payment.status}
            </span>
          ) : null}
        </div>
        <Link to="/profile/orders" className="pod-back-link">
          <BackArrowIcon className="pod-back-link-icon" aria-hidden />
          Back to orders
        </Link>
      </div>

      <div className="pod-body">
        <div className="pod-col-info">
          <h3 className="pod-section-title">Order Information</h3>

          <div className="pod-info-list">
            <div className="pod-info-row">
              <span className="pod-info-label">Customer Name</span>
              <span className="pod-info-value">{shipping?.name || "—"}</span>
            </div>
            <div className="pod-info-row">
              <span className="pod-info-label">Phone Number</span>
              <span className="pod-info-value">{shipping?.phone || "—"}</span>
            </div>
            <div className="pod-info-row">
              <span className="pod-info-label">Email</span>
              <span className="pod-info-value">{shipping?.email || "—"}</span>
            </div>
            <div className="pod-info-row">
              <span className="pod-info-label">Shipping Address</span>
              <span className="pod-info-value">
                {getOrderShippingAddress(order) || "—"}
              </span>
            </div>
            <div className="pod-info-row">
              <span className="pod-info-label">Order Date</span>
              <span className="pod-info-value">
                {formatDisplayDate(order.createdAt)}
              </span>
            </div>
            <div className="pod-info-row">
              <span className="pod-info-label">Last Updated</span>
              <span className="pod-info-value">
                {formatDisplayDate(order.updatedAt)}
              </span>
            </div>
            {shipping?.trackingCode ? (
              <div className="pod-info-row">
                <span className="pod-info-label">Tracking Code</span>
                <span className="pod-info-value">{shipping.trackingCode}</span>
              </div>
            ) : null}
            {payment?.method ? (
              <div className="pod-info-row">
                <span className="pod-info-label">Payment Method</span>
                <span className="pod-info-value">{payment.method}</span>
              </div>
            ) : null}
          </div>

          <div className="pod-divider" />

          <div className="pod-info-list">
            <div className="pod-info-row">
              <span className="pod-info-label">Subtotal</span>
              <span className="pod-info-value">{formatMoney(subtotal)}</span>
            </div>
            <div className="pod-info-row">
              <span className="pod-info-label">Shipping Fee</span>
              <span className="pod-info-value">{formatMoney(shipFee)}</span>
            </div>
            <div className="pod-info-row pod-total-row">
              <span className="pod-info-label-total">Total Amount</span>
              <span className="pod-info-value-total">{formatMoney(total)}</span>
            </div>
          </div>
        </div>

        <div className="pod-col-items">
          <h3 className="pod-section-title">Order Items</h3>
          <div className="pod-items-list">
            {lineItems.length === 0 ? (
              <div className="pod-empty-inline">No items found.</div>
            ) : (
              lineItems.map((item, index) => (
                <div key={`${item.id}-${index}`} className="pod-item-card">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="pod-item-img"
                  />
                  <div className="pod-item-details">
                    <p className="pod-item-name">{item.name}</p>

                    {item.description ? (
                      <div className="pod-item-desc-row">
                        <span className="pod-item-label">Description:</span>
                        <span className="pod-item-desc-text">
                          {item.description}
                        </span>
                      </div>
                    ) : null}

                    <div className="pod-item-bottom">
                      <div className="pod-item-price-row">
                        <span className="pod-item-label">Price:</span>
                        <span className="pod-item-price-text">
                          {formatMoney(item.price)}
                        </span>
                      </div>
                      <span className="pod-item-qty">
                        x{item.quantity ?? 1}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pod-col-timeline">
          <h3 className="pod-section-title">Tracking Timeline</h3>
          <div className="pod-timeline">
            {timeline.length === 0 ? (
              <div className="pod-empty-inline">No tracking records.</div>
            ) : (
              timeline.map((step, index) => (
                <div
                  key={`${step.status}-${step.date}-${index}`}
                  className={`pod-timeline-item ${step.isCompleted ? "completed" : ""}`}
                >
                  <div className="pod-timeline-icon">
                    {step.isCompleted ? <TimelineCheckIcon /> : null}
                  </div>
                  <div className="pod-timeline-content">
                    <p className="pod-timeline-status">{step.status}</p>
                    {step.date ? (
                      <p className="pod-timeline-date">
                        {formatDisplayDate(step.date)}
                      </p>
                    ) : null}
                    {step.description ? (
                      <p className="pod-timeline-desc">{step.description}</p>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;
