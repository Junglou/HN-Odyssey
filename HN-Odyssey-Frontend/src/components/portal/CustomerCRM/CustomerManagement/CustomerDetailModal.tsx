import { useState, useEffect, useCallback } from "react";
import "./CustomerDetailModal.css";
import { DefaultAvatarIcon } from "../../../../assets/icons/CustomerManagementIcons";
import type { CustomerRecord } from "../../../../hooks/portal/CustomerCRM/CustomerManagement/useCustomerManagement";
import axiosClient from "../../../../api/axiosClient";
import { toast } from "react-toastify";

export interface CustomerDetailModalProps {
  isOpen: boolean;
  customer: CustomerRecord | null;
  onClose: () => void;
}

interface ActivityLog {
  time: string;
  action: string;
  ip: string;
  device: string;
  status: string;
}

interface OrderHistoryItem {
  _id: string;
  order_code: string;
  total_amount: number;
  status: string;
  createdAt: string;
  payment: { method: string; status: string };
}

export default function CustomerDetailModal({
  isOpen,
  customer,
  onClose,
}: CustomerDetailModalProps) {
  const [activeTab, setActiveTab] = useState<
    "profile" | "orders" | "activities"
  >("profile");
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Esc để đóng
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset tab khi mở modal người khác
  useEffect(() => {
    if (isOpen) setActiveTab("profile");
  }, [isOpen, customer?.id]);

  // Fetch Lịch sử hoạt động khi chuyển sang Tab Activities
  const fetchActivities = useCallback(async () => {
    if (!customer?.id) return;
    setLoadingActivities(true);
    try {
      const response = await axiosClient.get(
        `/admin/customers/${customer.id}/activities?limit=50`,
      );
      setActivities(response.data.data);
    } catch {
      toast.error("Không thể tải lịch sử hoạt động.");
    } finally {
      setLoadingActivities(false);
    }
  }, [customer?.id]);

  const fetchOrders = useCallback(async () => {
    if (!customer?.id) return;
    setLoadingOrders(true);
    try {
      // Gọi đúng endpoint GET /orders kèm param user_id và sort mới nhất
      const response = await axiosClient.get(
        `/orders?user_id=${customer.id}&sort=createdAt:desc&limit=20`,
      );
      setOrders(response.data.data);
    } catch {
      toast.error("Không thể tải lịch sử đơn hàng.");
    } finally {
      setLoadingOrders(false);
    }
  }, [customer?.id]);

  // TRIGGER FETCH KHI CHUYỂN TAB
  useEffect(() => {
    if (activeTab === "activities") fetchActivities();
    if (activeTab === "orders") fetchOrders();
  }, [activeTab, fetchActivities, fetchOrders]);

  useEffect(() => {
    if (activeTab === "activities") {
      fetchActivities();
    }
  }, [activeTab, fetchActivities]);

  // Hàm gọi API xuất Excel cho 1 User cụ thể
  const handleExportActivities = async () => {
    if (!customer?.id) return;
    setIsExporting(true);
    try {
      toast.info("Đang xử lý xuất dữ liệu...");
      const response = await axiosClient.get(
        `/admin/customers/${customer.id}/activities/export`,
        {
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `HoatDong_${customer.username}_${new Date().getTime()}.xlsx`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Xuất lịch sử hoạt động thành công!");
    } catch {
      toast.error("Lỗi khi xuất file Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  // Helper trả về CSS class cho Order status
  const getOrderStatusClass = (status: string) => {
    if (["PENDING", "PROCESSING", "SHIPPING"].includes(status))
      return "crm-order-status--pending";
    if (["DELIVERED", "COMPLETED"].includes(status))
      return "crm-order-status--delivered";
    if (["CANCELLED", "RETURNED"].includes(status))
      return "crm-order-status--cancelled";
    return "crm-order-status--default";
  };

  // Helper trả về CSS class cho Account status
  const getAccountStatusClass = (status: string) => {
    if (status === "Active") return "crm-account-status--active";
    if (status === "Locked") return "crm-account-status--locked";
    return "crm-account-status--inactive";
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="crm-modal-overlay" onClick={onClose}>
      <div
        className="crm-detail-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Thông tin chung */}
        <div className="crm-detail-header">
          <div className="crm-detail-user-info">
            <div className="crm-detail-avatar">
              <DefaultAvatarIcon />
            </div>
            <div>
              <h2 className="crm-detail-name">{customer.fullName}</h2>
              <p className="crm-detail-email">
                {customer.email} • {customer.phone}
              </p>
            </div>
          </div>
          <button type="button" className="crm-icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Cấu trúc Tabs */}
        <div className="crm-tabs-header">
          <button
            className={`crm-tab-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            User Profile
          </button>
          <button
            className={`crm-tab-btn ${activeTab === "orders" ? "active" : ""}`}
            onClick={() => setActiveTab("orders")}
          >
            Order History
          </button>
          <button
            className={`crm-tab-btn ${activeTab === "activities" ? "active" : ""}`}
            onClick={() => setActiveTab("activities")}
          >
            Activity Logs
          </button>
        </div>

        {/* Nội dung Tabs */}
        <div className="crm-detail-body">
          {/* TAB 1: PROFILE */}
          {activeTab === "profile" && (
            <div className="crm-profile-grid">
              <div className="crm-info-group">
                <span className="crm-info-label">Username</span>
                <div className="crm-info-value">{customer.username}</div>
              </div>
              <div className="crm-info-group">
                <span className="crm-info-label">Customer Type</span>
                <div className="crm-info-value">{customer.customerType}</div>
              </div>
              <div className="crm-info-group">
                <span className="crm-info-label">Account Status</span>
                <div
                  className={`crm-info-value ${getAccountStatusClass(customer.status)}`}
                >
                  {customer.status}
                </div>
              </div>
              <div className="crm-info-group">
                <span className="crm-info-label">Review Access</span>
                <div className="crm-info-value">{customer.reviewAccess}</div>
              </div>
              <div className="crm-info-group">
                <span className="crm-info-label">Last Login</span>
                <div className="crm-info-value">{customer.lastLogin}</div>
              </div>

              <div className="crm-info-group">
                <span className="crm-info-label">Total Spent</span>
                <div className="crm-info-value crm-loyalty-value--spent">
                  {/* Hàm toLocaleString("vi-VN") tự động thêm dấu . vào số tiền */}
                  {customer.loyalty?.total_spent?.toLocaleString("vi-VN") || 0}{" "}
                  ₫
                </div>
              </div>

              <div className="crm-info-group">
                <span className="crm-info-label">Loyalty Points</span>
                <div className="crm-info-value crm-loyalty-value--points">
                  {customer.loyalty?.point?.toLocaleString("vi-VN") || 0}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TÍCH HỢP GIAO DIỆN ORDER HISTORY */}
          {activeTab === "orders" && (
            <div className="crm-activity-container">
              <h3 className="crm-section-title">Recent Orders</h3>

              {loadingOrders ? (
                <div className="crm-empty-state">Loading orders...</div>
              ) : orders.length > 0 ? (
                <div className="crm-detail-table-wrapper">
                  <table className="crm-activity-table">
                    <thead>
                      <tr>
                        <th>Order Code</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Payment</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order._id}>
                          <td className="crm-td-order-code">
                            {order.order_code}
                          </td>
                          <td className="crm-td-nowrap">
                            {new Date(order.createdAt).toLocaleDateString(
                              "vi-VN",
                            )}
                          </td>
                          <td className="crm-td-bold">
                            {order.total_amount.toLocaleString("vi-VN")} ₫
                          </td>
                          <td>{order.payment?.method || "N/A"}</td>
                          <td className={getOrderStatusClass(order.status)}>
                            {order.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="crm-empty-state">
                  Khách hàng chưa có đơn hàng nào.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ACTIVITY LOGS */}
          {activeTab === "activities" && (
            <div className="crm-activity-container">
              <div className="crm-activity-toolbar">
                <h3 className="crm-section-title--toolbar">
                  System Audit Logs
                </h3>
                <button
                  className="crm-btn-export"
                  onClick={handleExportActivities}
                  disabled={isExporting || activities.length === 0}
                >
                  Export Excel
                </button>
              </div>

              {loadingActivities ? (
                <div className="crm-empty-state">Loading activities...</div>
              ) : activities.length > 0 ? (
                <div className="crm-detail-table-wrapper">
                  <table className="crm-activity-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Action</th>
                        <th>IP Address</th>
                        <th>Device</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities.map((log, index) => (
                        <tr key={index}>
                          <td className="crm-td-nowrap">
                            {new Date(log.time).toLocaleString()}
                          </td>
                          <td className="crm-td-action">
                            {log.action.replace(/_/g, " ")}
                          </td>
                          <td>{log.ip || "N/A"}</td>
                          <td>{log.device}</td>
                          <td
                            className={`crm-activity-status ${log.status === "Thành công" ? "success" : "failed"}`}
                          >
                            {log.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="crm-empty-state">
                  Chưa ghi nhận hoạt động nào của khách hàng này.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
