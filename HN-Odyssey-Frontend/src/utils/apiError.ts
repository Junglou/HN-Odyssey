import axios from "axios";

// Lấy message lỗi để hiện cho người dùng:
// - Lỗi 4xx: dùng message BE trả về (BE đã viết message rõ ràng)
// - Lỗi 5xx, mất mạng, message kỹ thuật: dùng câu dự phòng dễ hiểu
const pickMessage = (msg: unknown): string | null => {
  if (typeof msg === "string" && msg.trim()) return msg.trim();
  if (Array.isArray(msg)) {
    const parts = msg.filter(
      (m): m is string => typeof m === "string" && m.trim() !== "",
    );
    if (parts.length > 0) return parts.join(", ");
  }
  return null;
};

const STATUS_FALLBACK: Record<number, string> = {
  400: "Dữ liệu gửi lên không hợp lệ.",
  401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  403: "Bạn không có quyền thực hiện thao tác này.",
  404: "Không tìm thấy dữ liệu yêu cầu.",
  409: "Dữ liệu bị trùng với bản ghi đã có.",
  413: "Dữ liệu tải lên quá lớn.",
  429: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
};

// Message kỹ thuật của axios/server, không nên hiện nguyên văn
const TECHNICAL_MESSAGES = [
  /^network error$/i,
  /^timeout of \d+ms exceeded$/i,
  /^request failed with status code \d+$/i,
  /^unknown error$/i,
  /^internal server error$/i,
];

const isTechnical = (msg: string) =>
  TECHNICAL_MESSAGES.some((re) => re.test(msg));

export const getApiErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  let status: number | undefined;
  let message: string | null = null;

  if (axios.isAxiosError(error)) {
    // Lỗi axios gốc (gọi thẳng axios, không qua axiosClient)
    status = error.response?.status;
    const data = error.response?.data as { message?: unknown } | undefined;
    message = pickMessage(data?.message) ?? pickMessage(error.message);
  } else if (error && typeof error === "object") {
    // Lỗi đã chuẩn hóa bởi axiosClient: { status, message, data }
    const e = error as {
      status?: number;
      message?: unknown;
      data?: { message?: unknown };
      response?: { status?: number; data?: { message?: unknown } };
    };
    status = e.status ?? e.response?.status;
    message =
      pickMessage(e.data?.message) ??
      pickMessage(e.response?.data?.message) ??
      pickMessage(e.message);
  } else {
    message = pickMessage(error);
  }

  // Không có phản hồi từ server → mất mạng hoặc server không chạy
  if (status === undefined && message && /network|timeout/i.test(message)) {
    return "Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.";
  }

  // Lỗi máy chủ: không hiện chi tiết kỹ thuật
  if (status !== undefined && status >= 500) {
    return `${fallback} Vui lòng thử lại sau.`;
  }

  if (message && !isTechnical(message)) return message;
  if (status !== undefined && STATUS_FALLBACK[status]) {
    return STATUS_FALLBACK[status];
  }
  return fallback;
};

// Lấy mã HTTP (403, 404...) từ lỗi — dùng khi cần xử lý riêng theo mã
// (axiosClient trả lỗi dạng { status, message, data }, KHÔNG có error.response)
export const getApiErrorStatus = (error: unknown): number | undefined => {
  if (axios.isAxiosError(error)) return error.response?.status;
  if (error && typeof error === "object") {
    const e = error as { status?: unknown; response?: { status?: unknown } };
    const status = e.status ?? e.response?.status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
};
