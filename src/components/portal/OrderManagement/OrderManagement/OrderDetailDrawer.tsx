import "./OrderDetailDrawer.css";
import type { OrderRow } from "../../../../hooks/portal/OrderManagement/OrderManagement/useOrderManagement";
import { TimelineCheckIcon } from "../../../../assets/icons/OrderManagementIcons";
import { useEffect } from "react";

// props
interface OrderDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: OrderRow | null;
}

// component
export default function OrderDetailDrawer({
  isOpen,
  onClose,
  orderData,
}: OrderDetailDrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);
  if (!orderData && isOpen) return null;

  return (
    <>
      {/* overlay */}
      <div
        className={`om-drawer-overlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />

      {/* drawer container */}
      <div className={`om-drawer ${isOpen ? "open" : ""}`}>
        {orderData && (
          <>
            {/* header */}
            <div className="om-drawer-header">
              <div className="om-drawer-title-group">
                <h2 className="om-drawer-title">{orderData.orderCode}</h2>
                <span
                  className={`om-badge om-badge-status-${orderData.orderStatus}`}
                >
                  {orderData.orderStatus}
                </span>
                <span
                  className={`om-badge om-badge-payment-${orderData.paymentStatus}`}
                >
                  {orderData.paymentStatus}
                </span>
              </div>
              <button className="om-btn-close" onClick={onClose}>
                ✕
              </button>
            </div>

            {/* body */}
            <div className="om-drawer-body">
              {/* column 1: info */}
              <div className="om-col-info">
                <h3 className="om-drawer-section-title">Order Information</h3>

                <div className="om-info-list">
                  <div className="om-info-row">
                    <span className="om-info-label">Customer Name</span>
                    <span className="om-info-value">
                      {orderData.customerName}
                    </span>
                  </div>
                  <div className="om-info-row">
                    <span className="om-info-label">Phone Number</span>
                    <span className="om-info-value">
                      {orderData.customerPhone}
                    </span>
                  </div>
                  <div className="om-info-row">
                    <span className="om-info-label">Email</span>
                    <span className="om-info-value">{orderData.email}</span>
                  </div>
                  <div className="om-info-row">
                    <span className="om-info-label">Shipping Address</span>
                    <span className="om-info-value">
                      {orderData.shippingAddress}
                    </span>
                  </div>
                  <div className="om-info-row">
                    <span className="om-info-label">Order Date</span>
                    <span className="om-info-value">
                      {new Date(orderData.orderDate).toLocaleString()}
                    </span>
                  </div>
                  {orderData.shipDate && (
                    <div className="om-info-row">
                      <span className="om-info-label">Estimated Delivery</span>
                      <span className="om-info-value">
                        {new Date(orderData.shipDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="om-info-row">
                    <span className="om-info-label">Created By</span>
                    <span className="om-info-value">{orderData.createdBy}</span>
                  </div>
                </div>

                <div className="om-divider"></div>

                <div className="om-info-list">
                  <div className="om-info-row">
                    <span className="om-info-label">Subtotal</span>
                    <span className="om-info-value">
                      ${orderData.subtotal?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                  <div className="om-info-row">
                    <span className="om-info-label">Shipping Fee</span>
                    <span className="om-info-value">
                      ${orderData.shipFee?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                  <div className="om-info-row om-total-row">
                    <span className="om-info-label-total">Total Amount</span>
                    <span className="om-info-value-total">
                      ${orderData.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {orderData.note && (
                  <div className="om-note-box">
                    <p className="om-note-label">Internal Note:</p>
                    <p className="om-note-text">{orderData.note}</p>
                  </div>
                )}
              </div>

              {/* column 2: items */}
              <div className="om-col-items">
                <h3 className="om-drawer-section-title">Order Items</h3>
                <div className="om-items-list">
                  {orderData.items.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        color: "#6b7280",
                        padding: "16px",
                      }}
                    >
                      No items found.
                    </div>
                  ) : (
                    orderData.items.map((item) => (
                      <div key={item.id} className="om-item-card">
                        <img
                          src={item.image}
                          alt={item.productName}
                          className="om-item-img"
                        />
                        <div className="om-item-details">
                          <p className="om-item-name">{item.productName}</p>

                          <div className="om-item-desc-row">
                            <span className="om-item-label">Description:</span>
                            <span className="om-item-desc-text">
                              {item.description || `SKU: ${item.sku}`}
                            </span>
                          </div>

                          <div className="om-item-bottom">
                            <div className="om-item-price-row">
                              <span className="om-item-label">Price:</span>
                              <span className="om-item-price-text">
                                ${item.price.toFixed(2)}
                              </span>
                            </div>
                            <span className="om-item-qty">
                              x{item.quantity}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* column 3: timeline */}
              <div className="om-col-timeline">
                <h3 className="om-drawer-section-title">Tracking Timeline</h3>
                <div className="om-timeline">
                  {orderData.timeline.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        color: "#6b7280",
                        padding: "16px",
                      }}
                    >
                      No tracking records.
                    </div>
                  ) : (
                    orderData.timeline.map((step, idx) => (
                      <div
                        key={idx}
                        className={`om-timeline-item ${step.isCompleted ? "completed" : ""}`}
                      >
                        <div className="om-timeline-icon">
                          {step.isCompleted && <TimelineCheckIcon />}
                        </div>
                        <div className="om-timeline-content">
                          <p className="om-timeline-status">{step.status}</p>
                          {step.date && (
                            <p className="om-timeline-date">
                              {new Date(step.date).toLocaleString()}
                            </p>
                          )}
                          <p className="om-timeline-desc">{step.description}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
