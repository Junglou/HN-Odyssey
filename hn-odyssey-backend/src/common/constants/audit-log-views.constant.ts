import { Department } from 'src/common/enums/department.enum';

export const AUDIT_LOG_MAIN_COLLECTION = 'audit_logs';

export interface AuditLogViewMeta {
  name: string; // tên View trong MongoDB
  department: Department;
  label: string; // tên hiển thị trên UI
}

// Mỗi phòng ban có 1 MongoDB View riêng, lọc sẵn từ bảng audit_logs
export const AUDIT_LOG_VIEWS: AuditLogViewMeta[] = [
  {
    name: 'view_audit_management',
    department: Department.MANAGEMENT,
    label: 'Management',
  },
  { name: 'view_audit_sales', department: Department.SALES, label: 'Sales' },
  {
    name: 'view_audit_warehouse',
    department: Department.WAREHOUSE,
    label: 'Warehouse',
  },
  {
    name: 'view_audit_marketing',
    department: Department.MARKETING,
    label: 'Marketing',
  },
  {
    name: 'view_audit_accounting',
    department: Department.ACCOUNTING,
    label: 'Accounting',
  },
  {
    name: 'view_audit_support',
    department: Department.SUPPORT,
    label: 'Support',
  },
];

export const findAuditViewByDepartment = (
  department?: string,
): AuditLogViewMeta | undefined =>
  department
    ? AUDIT_LOG_VIEWS.find((v) => String(v.department) === department)
    : undefined;
