import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import axiosClient from "../../../../api/axiosClient";

// 1. FE TYPES (GIỮ NGUYÊN THEO COMPONENT YÊU CẦU)

export type OrderStatus =
  | "Pending"
  | "Confirmed"
  | "Packaging"
  | "READY_TO_SHIP"
  | "Shipping"
  | "Delivered"
  | "Cancelled"
  | "Refunded";

export type PaymentStatus = "Unpaid" | "Paid" | "Refunded";

export interface OrderItem {
  id: string;
  sku: string;
  productName: string;
  description?: string;
  quantity: number;
  price: number;
  image: string;
}

export interface OrderTimeline {
  status: string;
  date: string;
  description: string;
  isCompleted: boolean;
}

export interface OrderRow {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  email: string;
  shippingAddress: string;
  orderDate: string;
  shipDate?: string;
  subtotal: number;
  shipFee: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdBy: "Customer" | "Sales Staff";
  items: OrderItem[];
  timeline: OrderTimeline[];
  note?: string;
  waybillCode?: string;
}

// 2. BE TYPES (STRICT TYPING ĐỂ KHÔNG DÙNG 'ANY')

interface BeOrderItem {
  product_id: string;
  sku: string;
  product_name: string;
  price: number;
  quantity: number;
  image: string;
  variant_name?: string;
}

interface BeTimeline {
  status: string;
  timestamp: string;
  actor: string;
  note?: string;
}

interface BeOrderData {
  _id: string;
  order_code: string;
  createdAt: string;
  total_amount: number;
  discount_amount: number;
  shipping_fee?: number;
  actual_shipping_fee?: number;
  status: string;
  payment: {
    method: string;
    status: string;
  };
  shipping_info?: {
    name: string;
    phone: string;
    email?: string;
    address: string;
    district_code?: string;
    city_code?: string;
    tracking_code?: string;
  };
  guest_info?: {
    name: string;
    phone: string;
    email?: string;
  };
  user_id?: string | null;
  isGuest: boolean;
  items: BeOrderItem[];
  timeline: BeTimeline[];
  internal_note?: string;
  waybill_code?: string;
}

interface BeApiResponse {
  data: BeOrderData[];
  meta: {
    total: number;
    page: number;
    last_page: number;
  };
}

// 3. MAPPERS (DỊCH DATA TỪ BE SANG FE)

const mapPaymentStatus = (beStatus?: string): PaymentStatus => {
  if (beStatus === "PAID") return "Paid";
  if (beStatus === "REFUNDED") return "Refunded";
  return "Unpaid";
};

// Hàm gom nhóm 17 trạng thái của BE về 7 trạng thái hiển thị của FE
const mapBeToFeStatus = (beStatus: string): OrderStatus => {
  const s = beStatus.toUpperCase();
  if (s === "PENDING" || s === "TEMPORARY") return "Pending";
  if (["CONFIRMED", "PRIORITY", "TRADE_IN_REVIEW"].includes(s))
    return "Confirmed";
  if (["PROCESSING", "ON_HOLD", "READY_TO_SHIP"].includes(s))
    return "Packaging";
  if (["SHIPPING", "DELIVERY_FAILED"].includes(s)) return "Shipping";
  if (["DELIVERED", "COMPLETED"].includes(s)) return "Delivered";
  if (["CANCELLED"].includes(s)) return "Cancelled";
  if (["REFUND_PENDING", "REFUND_NEEDED", "REFUNDED", "RETURNED"].includes(s))
    return "Refunded";
  return "Pending";
};

// THÊM MAPPER MỚI: Dịch trạng thái từ UI về chuẩn Backend
const mapFeToBeStatus = (feStatus: string): string => {
  if (feStatus === "Packaging") return "PROCESSING";
  if (feStatus === "Confirmed") return "CONFIRMED";
  if (feStatus === "Shipping") return "SHIPPING";
  if (feStatus === "Delivered") return "DELIVERED";
  if (feStatus === "Cancelled") return "CANCELLED";
  if (feStatus === "Refunded") return "RETURNED";
  if (feStatus === "READY_TO_SHIP") return "READY_TO_SHIP";
  return "PENDING";
};

// 4. MAIN HOOK

export function useOrderManagement() {
  const [data, setData] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [filters, setFilters] = useState({
    search: "",
    status: "all" as OrderStatus | "all",
    fromDate: "",
    toDate: "",
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [detailDrawer, setDetailDrawer] = useState<{
    isOpen: boolean;
    orderId: string | null;
  }>({
    isOpen: false,
    orderId: null,
  });

  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    orderId: string | null;
    currentStatus: OrderStatus | null;
  }>({
    isOpen: false,
    orderId: null,
    currentStatus: null,
  });

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      // Chuẩn bị params để gửi lên BE
      const params: Record<string, string | number> = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (filters.search) params.search = filters.search;
      if (filters.status !== "all") params.status = filters.status;
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;

      // Gọi API GET /orders
      const response = await axiosClient.get<BeApiResponse>("/orders", {
        params,
      });

      const beData = response.data.data;
      const meta = response.data.meta;

      // Xử lý Map data BE -> FE an toàn
      const mappedData: OrderRow[] = beData.map((order) => {
        // Hứng thông tin khách hàng an toàn
        const customerName =
          order.shipping_info?.name ||
          order.guest_info?.name ||
          "Khách vãng lai";
        const customerPhone =
          order.shipping_info?.phone || order.guest_info?.phone || "N/A";
        const email =
          order.shipping_info?.email || order.guest_info?.email || "N/A";
        const address = order.shipping_info?.address || "Nhận tại cửa hàng";

        // TÍNH TOÁN LẠI CHUẨN USD
        // 1. Quy đổi tiền ship
        const shipFeeVnd = order.actual_shipping_fee || order.shipping_fee || 0;
        const shipFeeUsd = shipFeeVnd / 25400;

        // 2. Giá Item đã là USD sẵn -> KHÔNG ĐƯỢC CHIA NỮA
        const subtotalUsd = order.items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );

        // 3. Discount cũng đã là USD -> KHÔNG ĐƯỢC CHIA NỮA
        const discountUsd = order.discount_amount || 0;

        // 4. Cộng lại ra Total Amount chuẩn xác: Giá USD + Ship USD
        const totalAmountUsd = subtotalUsd - discountUsd + shipFeeUsd;

        // Xác định người tạo đơn dựa vào actor của sự kiện khởi tạo (nằm ở vị trí đầu tiên trong mảng timeline)
        const firstEventActor = order.timeline?.[0]?.actor;
        const creatorRole =
          firstEventActor === "Guest" ||
          firstEventActor === "Member" ||
          order.isGuest
            ? "Customer"
            : "Sales Staff";

        return {
          id: order._id,
          orderCode: order.order_code,
          customerName: customerName,
          customerPhone: customerPhone,
          email: email,
          shippingAddress: address,
          orderDate: order.createdAt,
          subtotal: subtotalUsd, // Gán chuẩn số USD
          shipFee: shipFeeUsd, // Gán chuẩn số USD
          totalAmount: totalAmountUsd, // Gán chuẩn số USD
          paymentStatus: mapPaymentStatus(order.payment?.status),
          orderStatus: mapBeToFeStatus(order.status),
          createdBy: creatorRole,
          note: order.internal_note,
          waybillCode:
            order.waybill_code || order.shipping_info?.tracking_code || "",

          items: order.items.map((item) => ({
            id: item.sku + item.product_id,
            sku: item.sku,
            productName: item.product_name,
            description: item.variant_name || `SKU: ${item.sku}`,
            quantity: item.quantity,
            price: item.price,
            image: item.image || "",
          })),

          timeline: order.timeline.map((t) => ({
            status: mapBeToFeStatus(t.status), // Phiên dịch cả trong timeline
            date: t.timestamp,
            description: t.note || t.actor || "Hệ thống cập nhật",
            isCompleted: true,
          })),
        };
      });

      setData(mappedData);
      setPagination((prev) => ({
        ...prev,
        total: meta.total,
        totalPages: meta.last_page || 1,
      }));
    } catch (error) {
      console.error("Lỗi khi fetch đơn hàng:", error);
      // Hiển thị thông báo khi không lấy được dữ liệu
      toast.error("Không thể tải danh sách đơn hàng từ hệ thống.");
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  // Tự động gọi API mỗi khi filter hoặc pagination thay đổi
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // State khóa hành động để chống Click Spam
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  const actions = {
    changeFilter: (key: keyof typeof filters, val: string) => {
      setFilters((prev) => ({ ...prev, [key]: val }));
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    clearFilters: () => {
      setFilters({ search: "", status: "all", fromDate: "", toDate: "" });
      setPagination((prev) => ({ ...prev, page: 1 }));
    },
    changePage: (page: number) => {
      setPagination((prev) => ({ ...prev, page }));
    },
    changeLimit: (limit: number) => {
      setPagination((prev) => ({ ...prev, limit, page: 1 }));
    },

    // View Drawer
    openDetail: (orderId: string) => {
      setDetailDrawer({ isOpen: true, orderId });
    },
    closeDetail: () => {
      setDetailDrawer({ isOpen: false, orderId: null });
    },

    // Update Status Modal
    openStatusModal: (orderId: string, currentStatus: OrderStatus) => {
      setStatusModal({ isOpen: true, orderId, currentStatus });
    },
    closeStatusModal: () => {
      setStatusModal({ isOpen: false, orderId: null, currentStatus: null });
    },

    confirmUpdateStatus: async (
      orderId: string,
      newStatus: OrderStatus,
      reason: string,
    ): Promise<void> => {
      if (isProcessingAction) return;
      setIsProcessingAction(true);
      try {
        const beStatus = mapFeToBeStatus(newStatus);
        await axiosClient.patch(`/orders/${orderId}/status-advanced`, {
          status: beStatus,
          reason: reason,
          // [QUAN TRỌNG]: Bật true để bypass Rule lùi/chuyển trạng thái của State Machine BE
          is_override: true,
        });

        toast.success(
          `Đã cập nhật trạng thái đơn hàng thành: ${newStatus} thành công!`,
        );

        fetchOrders();
        setStatusModal({ isOpen: false, orderId: null, currentStatus: null });
      } catch (error: unknown) {
        console.error("Lỗi cập nhật trạng thái:", error);
        const errMsg =
          (error as { response?: { data?: { message?: string } } }).response
            ?.data?.message || "Lỗi cập nhật trạng thái!";
        toast.error(errMsg);
      } finally {
        setIsProcessingAction(false);
      }
    },

    // Đổi type của nextStatus thành string để hỗ trợ truyền "READY_TO_SHIP"
    advanceOrderStatus: async (orderId: string, nextStatus: string) => {
      if (isProcessingAction) return;
      setIsProcessingAction(true);
      try {
        const beStatus = mapFeToBeStatus(nextStatus);
        await axiosClient.patch(`/orders/${orderId}/status-advanced`, {
          status: beStatus,
          note: `Staff auto advanced to ${beStatus}`,
        });

        if (nextStatus === "READY_TO_SHIP") {
          toast.info(
            "Đã gửi yêu cầu tạo đơn sang ĐVVC thành công! Vui lòng đợi vài giây và bấm 'Refresh' để thấy mã vận đơn.",
          );
        } else {
          toast.success("Chuyển trạng thái tiếp theo thành công!");
        }

        fetchOrders();
      } catch (error: unknown) {
        console.error("Lỗi chuyển tiếp trạng thái:", error);
        const errMsg =
          (error as { response?: { data?: { message?: string } } }).response
            ?.data?.message || "Không thể chuyển tiếp trạng thái.";
        toast.error(errMsg);
      } finally {
        setIsProcessingAction(false);
      }
    },

    // Global Actions
    exportExcel: async () => {
      try {
        toast.info("Đang xử lý xuất dữ liệu Excel, vui lòng đợi...");

        // Cấu hình responseType là blob để nhận luồng nhị phân từ BE
        const response = await axiosClient.get("/orders/export/excel", {
          params: {
            search: filters.search,
            status: filters.status,
            fromDate: filters.fromDate || undefined,
            toDate: filters.toDate || undefined,
          },
          responseType: "blob",
        });

        // Khởi tạo URL nhị phân cục bộ và kích hoạt tải về
        const url = window.URL.createObjectURL(
          new Blob([response.data], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `BaoCao_DonHang_${Date.now()}.xlsx`);
        document.body.appendChild(link);
        link.click();

        // Dọn dẹp bộ nhớ sau khi tải xong
        link.remove();
        window.URL.revokeObjectURL(url);

        toast.success("Xuất dữ liệu Excel thành công!");
      } catch (error) {
        console.error("Lỗi xuất Excel:", error);
        toast.error("Lỗi xuất dữ liệu Excel. Vui lòng thử lại.");
      }
    },

    printInvoice: async (selectedIds?: string[]) => {
      if (!selectedIds || selectedIds.length === 0) {
        toast.warning("Vui lòng chọn ít nhất một đơn hàng để in hóa đơn.");
        return;
      }
      await downloadPdf(selectedIds, "INVOICE");
    },

    printDeliverySlip: async (selectedIds?: string[]) => {
      if (!selectedIds || selectedIds.length === 0) {
        toast.warning("Vui lòng chọn ít nhất một đơn hàng để in phiếu giao.");
        return;
      }
      await downloadPdf(selectedIds, "PACKING_SLIP");
    },

    // BỔ SUNG HÀM LẤY LINK IN TEM GHN/GHTK
    printShippingLabel: async (orderId: string) => {
      try {
        const response = await axiosClient.get<{ url: string }>(
          `/orders/${orderId}/shipping-label`,
        );
        if (response.data && response.data.url) {
          // Mở URL in tem nguyên bản của GHN/GHTK sang một Tab mới
          window.open(response.data.url, "_blank");
        }
      } catch (error) {
        console.error("Lỗi lấy tem vận chuyển:", error);
        toast.error(
          "Không thể lấy tem giao hàng! Đơn hàng có thể chưa được đẩy sang ĐVVC (Chưa có mã vận đơn).",
        );
      }
    },

    refreshData: () => {
      fetchOrders();
    },
  };

  // HELPER XỬ LÝ DOWNLOAD BLOB CHO AXIOS
  const downloadPdf = async (
    ids: string[],
    type: "INVOICE" | "PACKING_SLIP",
  ) => {
    try {
      const fileTypeName = type === "INVOICE" ? "Hóa đơn" : "Phiếu giao hàng";
      toast.info(`Đang xử lý tải file ${fileTypeName}, vui lòng đợi...`);

      // 1. Gọi API với responseType: 'blob' để Axios không parse data thành JSON
      const response = await axiosClient.post(
        `/orders/print-bulk?type=${type}`,
        { ids },
        { responseType: "blob" },
      );

      // 2. Tạo URL ảo (ObjectURL) từ Blob nhị phân
      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" }),
      );

      // 3. Giả lập thẻ <a> để tự động click tải file
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${type}_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();

      // 4. Dọn dẹp bộ nhớ
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Tải file ${fileTypeName} thành công!`);
    } catch (error) {
      console.error(`Lỗi tải file ${type}:`, error);
      toast.error("Đã xảy ra lỗi khi tải file PDF. Vui lòng thử lại!");
    }
  };

  // Tính toán Index hiển thị UI
  const startIndex =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endIndex = Math.min(
    pagination.page * pagination.limit,
    pagination.total,
  );

  return {
    data, // Data này đã được map chuẩn Type OrderRow
    isLoading,
    filters,
    pagination: {
      ...pagination,
      startIndex,
      endIndex,
    },
    detailDrawer,
    selectedOrder: data.find((o) => o.id === detailDrawer.orderId) || null,
    statusModal,
    actions,
  };
}
