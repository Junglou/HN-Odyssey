import "./OrderShipping.css";
import "../OrderManagement/OrderManagementBox.css";
import OrderShippingNote from "./OrderShippingNote";

export interface OrderShippingProps {
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
}

const splitDateTime = (value: string) => {
  if (!value.trim()) return { date: "—", time: "" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: value, time: "" };
  }
  return {
    date: parsed.toLocaleDateString("en-US"),
    time: parsed.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
};

function OrderShipping({
  statusLabel,
  createdAt,
  updatedAt,
}: OrderShippingProps) {
  const placed = splitDateTime(createdAt);
  const updated = splitDateTime(updatedAt);

  const trackingSteps = [
    { title: "Order placed", date: placed.date, time: placed.time },
    {
      title: statusLabel ? `Status: ${statusLabel}` : "Order updated",
      date: updated.date,
      time: updated.time,
    },
  ];

  return (
    <div className="order-box-container order-shipping-box">
      <div className="box-content">
        <div className="box-infor">
          <div className="title-container order-shipping-title">
            <span className="lbl-text">Order tracking</span>
          </div>
          <div className="order-tracking-content">
            {trackingSteps.map((step) => (
              <OrderShippingNote
                key={`${step.title}-${step.date}-${step.time}`}
                title={step.title}
                date={step.date}
                time={step.time}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderShipping;
