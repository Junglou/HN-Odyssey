export enum Resource {
  // 1. NHÓM QUẢN TRỊ & HỆ THỐNG (System)
  SYSTEM = 'SYSTEM', // Cấu hình chung, Slider, Banner trang chủ
  USERS = 'USERS', // Quản lý nhân viên
  ROLES = 'ROLES', // Quản lý vai trò & phân quyền
  AUDIT_LOGS = 'AUDIT_LOGS', // Xem nhật ký hoạt động

  // 2. NHÓM KHÁCH HÀNG (Customers)
  CUSTOMERS = 'CUSTOMERS', // Danh sách khách hàng
  LOYALTY = 'LOYALTY', // Điểm thưởng, Hạng thành viên (US.35, 36)

  // 3. NHÓM SẢN PHẨM (Catalog)
  PRODUCTS = 'PRODUCTS', // Sản phẩm, Biến thể
  CATEGORIES = 'CATEGORIES', // Danh mục
  ATTRIBUTES = 'ATTRIBUTES', // Thuộc tính, Tag
  REVIEWS = 'REVIEWS', // Đánh giá & Bình luận (US.34, 120)

  // 4. NHÓM BÁN HÀNG (Sales)
  ORDERS = 'ORDERS', // Đơn hàng (US.121-124)
  RETURNS = 'RETURNS', // Yêu cầu trả hàng/hoàn tiền
  TRADE_IN = 'TRADE_IN', // Thu cũ đổi mới (US.37)

  // 5. NHÓM KHO VẬN (Inventory)
  INVENTORY = 'INVENTORY', // Tồn kho, Cảnh báo (US.100-105)
  TRANSFERS = 'TRANSFERS', // Nhập/Xuất kho (US.106-109)
  SUPPLIERS = 'SUPPLIERS', // Nhà cung cấp

  // 6. NHÓM MARKETING & NỘI DUNG
  PROMOTIONS = 'PROMOTIONS', // Coupon, Flash Sale (US.81-83)
  BLOG = 'BLOG', // Bài viết tin tức, Trang tĩnh (US.34)
  NOTIFICATIONS = 'NOTIFICATIONS', // Gửi thông báo Push/Email (US.18)

  // 7. NHÓM DỊCH VỤ & BÁO CÁO
  SUPPORT = 'SUPPORT', // Chat hỗ trợ (US.40)
  WARRANTY = 'WARRANTY', // Bảo hành điện tử (US.39)
  REPORTS = 'REPORTS', // Báo cáo doanh thu/kho (US.93-99)

  //Các nhóm khác
  SHIPPING = 'SHIPPING',
  PAYMENT = 'PAYMENT',
  DASHBOARD = 'DASHBOARD',
}

export enum Action {
  // Basic CRUD
  READ = 'READ',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',

  // Advanced Actions
  IMPORT = 'IMPORT', // Nhập Excel
  EXPORT = 'EXPORT', // Xuất báo cáo
  APPROVE = 'APPROVE', // Duyệt (Đơn hàng, Trả hàng, Bài viết)
  REJECT = 'REJECT', // Từ chối
  CANCEL = 'CANCEL', // Hủy đơn
  PUBLISH = 'PUBLISH', // Xuất bản (Bài viết, Khuyến mãi)
  RESTORE = 'RESTORE', // Khôi phục dữ liệu đã xóa

  // Super Action
  MANAGE = 'MANAGE', // Full quyền
}
