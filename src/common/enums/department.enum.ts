export enum Department {
  MANAGEMENT = 'MANAGEMENT', // 1. Ban quản trị (User, Role, Setting)
  SALES = 'SALES', // 2. Kinh doanh (Đơn hàng, Khách hàng)
  WAREHOUSE = 'WAREHOUSE', // 3. Kho vận (Sản phẩm, Tồn kho, Nhập xuất)
  MARKETING = 'MARKETING', // 4. Marketing (Bài viết, KM, Banner)
  ACCOUNTING = 'ACCOUNTING', // 5. Kế toán (Thanh toán, Đối soát)
  SUPPORT = 'SUPPORT', // 6. CSKH (Chat, Bảo hành, Khiếu nại)
}

//Map dùng cho sinh mã nhân viên
export const DEPARTMENT_CODES: Record<Department, string> = {
  [Department.MANAGEMENT]: '1',
  [Department.SALES]: '2',
  [Department.WAREHOUSE]: '3',
  [Department.MARKETING]: '4',
  [Department.ACCOUNTING]: '5',
  [Department.SUPPORT]: '6',
};

//Map dùng để hiển thị tiếng Việt (cho Frontend hoặc xuất Excel)
export const DEPARTMENT_LABELS: Record<Department, string> = {
  [Department.MANAGEMENT]: 'Ban quản trị',
  [Department.SALES]: 'Kinh doanh',
  [Department.WAREHOUSE]: 'Kho vận',
  [Department.MARKETING]: 'Marketing',
  [Department.ACCOUNTING]: 'Kế toán',
  [Department.SUPPORT]: 'CSKH',
};
