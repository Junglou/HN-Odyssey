export enum UserStatus {
  ACTIVE = 'ACTIVE', // Đang hoạt động
  SUSPENDED = 'SUSPENDED', // Đã khóa/Tạm ngưng
  TERMINATED = 'TERMINATED', // Cấm vĩnh viễn (nếu cần)
  INACTIVE = 'INACTIVE', // Dùng cho khách hàng khi mới đăng ký tài khoản tránh việc trùng với SUSPENDED
}
