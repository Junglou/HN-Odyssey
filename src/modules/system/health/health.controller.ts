// // Mongo Schema / Service / Controller

// 4. Module Core System / Health (src/common/filters/http-exception.filter.ts & src/modules/system/health/...)
// Đóng vai trò giám sát sự cố vận hành toàn hệ thống (System AC1, AC2, AC4).

// Sự kiện kích hoạt: NOTIFY_EVENTS.SYSTEM_ERROR và notification.system.resolve

// Vị trí đặt Emitter:

// Global Exception Filter: Bắt tất cả các lỗi có HTTP Status Code 500 (Internal Server Error) chưa được xử lý -> Bắn cảnh báo System Error.

// Axios Interceptors / Providers (VNPAY, GHTK): Nếu request bị Timeout hoặc trả về lỗi kết nối quá 3 lần -> Bắn cảnh báo Lỗi Đối Tác.

// Cronjobs/Task Scheduling: Bọc try-catch ở các job chạy ngầm (ví dụ: job xóa token hết hạn, job đồng bộ kho), catch được lỗi -> Bắn cảnh báo.
