// Sử dụng Object hằng số (as const) thay cho enum để không bị lỗi trình biên dịch (erasableSyntaxOnly)
export const Resource = {
  // 1. NHÓM TỔNG QUAN & BÁO CÁO
  DASHBOARD: "DASHBOARD",
  REPORT_REVENUE: "REPORT_REVENUE",
  REPORT_INVENTORY: "REPORT_INVENTORY",
  REPORT_MARKETING: "REPORT_MARKETING",
  REPORT_STOCK: "REPORT_STOCK", // <-- FIX: Thêm mã quyền mới cho Báo Cáo Kho

  // 2. NHÓM SẢN PHẨM & DANH MỤC
  CATALOG_PRODUCTS: "CATALOG_PRODUCTS",
  CATALOG_CATEGORIES: "CATALOG_CATEGORIES",
  CATALOG_ATTRIBUTES: "CATALOG_ATTRIBUTES",
  CATALOG_TAGS: "CATALOG_TAGS",
  CATALOG_PRICING: "CATALOG_PRICING",

  // 3. NHÓM BÁN HÀNG & ĐƠN HÀNG
  SALES_ORDERS: "SALES_ORDERS",
  SALES_TRADE_IN: "SALES_TRADE_IN",

  // 4. NHÓM KHO VẬN (WMS)
  INVENTORY_STOCK: "INVENTORY_STOCK",
  INVENTORY_TRANSFERS: "INVENTORY_TRANSFERS",

  // 5. NHÓM MARKETING & KHUYẾN MÃI
  PROMO_COUPONS: "PROMO_COUPONS",
  PROMO_FLASH_SALES: "PROMO_FLASH_SALES",
  PROMO_COMBOS: "PROMO_COMBOS",

  // 6. NHÓM NỘI DUNG & TRUYỀN THÔNG (COMMUNICATION)
  CONTENT_POSTS: "CONTENT_POSTS",
  CONTENT_PAGES: "CONTENT_PAGES",
  CONTENT_BANNERS: "CONTENT_BANNERS",
  CONTENT_MEDIA: "CONTENT_MEDIA",
  CONTENT_CONFIG: "CONTENT_CONFIG",

  // 7. NHÓM CHĂM SÓC KHÁCH HÀNG (CRM)
  CRM_CUSTOMERS: "CRM_CUSTOMERS",
  CRM_CHAT: "CRM_CHAT",
  CRM_REVIEWS: "CRM_REVIEWS",
  CRM_WARRANTY: "CRM_WARRANTY",

  // 8. NHÓM HỆ THỐNG
  SYSTEM_USERS: "SYSTEM_USERS",
  SYSTEM_ROLES: "SYSTEM_ROLES",
  SYSTEM_AUDIT: "SYSTEM_AUDIT",
  SYSTEM_MONITORING: "SYSTEM_MONITORING",
  SYSTEM_NOTIFICATIONS: "SYSTEM_NOTIFICATIONS",
} as const;

export type Resource = (typeof Resource)[keyof typeof Resource];

export const Action = {
  // --- Basic CRUD ---
  READ: "READ",
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",

  // --- Workflow & Approval (Quy trình Duyệt) ---
  SUBMIT_APPROVAL: "SUBMIT_APPROVAL",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  PUBLISH: "PUBLISH",
  UNPUBLISH: "UNPUBLISH",

  // --- Data & Document ---
  IMPORT: "IMPORT",
  EXPORT: "EXPORT",
  PRINT: "PRINT",

  // --- Specific Actions (Hành động đặc thù) ---
  CANCEL: "CANCEL",
  REFUND: "REFUND",
  REPLY: "REPLY",
  ASSIGN: "ASSIGN",
  RECEIVE: "RECEIVE",
  CHANGE_STATUS: "CHANGE_STATUS",

  // --- Super Action ---
  MANAGE: "MANAGE",
} as const;

export type Action = (typeof Action)[keyof typeof Action];

export interface IPermissionResourceMeta {
  code: Resource;
  name: string;
  availableActions: Action[];
}

export interface IPermissionGroupMeta {
  group: string;
  resources: IPermissionResourceMeta[];
}

export const PERMISSION_METADATA: IPermissionGroupMeta[] = [
  {
    group: "DASHBOARD & REPORTS",
    resources: [
      {
        code: Resource.DASHBOARD,
        name: "Overview",
        availableActions: [Action.READ],
      },
      {
        code: Resource.REPORT_REVENUE,
        name: "Revenue Report",
        availableActions: [Action.READ, Action.EXPORT],
      },
      {
        code: Resource.REPORT_MARKETING,
        name: "Marketing & Promotion Report",
        availableActions: [Action.READ, Action.EXPORT, Action.UPDATE],
      },
      {
        code: Resource.REPORT_INVENTORY,
        name: "Business Intelligence (BI)",
        availableActions: [Action.READ],
      },
      {
        code: Resource.REPORT_STOCK, // <-- FIX: Tách thành quyền Báo cáo kho
        name: "Inventory Management",
        availableActions: [Action.READ, Action.EXPORT],
      },
    ],
  },
  {
    group: "PRODUCT CATALOG",
    resources: [
      {
        code: Resource.CATALOG_PRODUCTS,
        name: "Product Management",
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.CHANGE_STATUS,
        ],
      },
      {
        code: Resource.CATALOG_CATEGORIES,
        name: "Category Management",
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.CHANGE_STATUS,
        ],
      },
      {
        code: Resource.CATALOG_ATTRIBUTES,
        name: "Variant Management",
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.CHANGE_STATUS,
        ],
      },
      {
        code: Resource.CATALOG_PRICING,
        name: "Price Management",
        availableActions: [
          Action.READ,
          Action.SUBMIT_APPROVAL,
          Action.APPROVE,
          Action.REJECT,
        ],
      },
      {
        code: Resource.CATALOG_TAGS,
        name: "Tag Management",
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
    ],
  },
  {
    group: "ORDER MANAGEMENT",
    resources: [
      {
        code: Resource.SALES_ORDERS,
        name: "Order Management",
        availableActions: [
          Action.READ,
          Action.UPDATE,
          Action.CANCEL,
          Action.REFUND,
          Action.PRINT,
          Action.EXPORT,
        ],
      },
      {
        code: Resource.SALES_TRADE_IN,
        name: "Trade-in Management",
        availableActions: [
          Action.READ,
          Action.UPDATE,
          Action.RECEIVE,
          Action.APPROVE,
          Action.REJECT,
          Action.PRINT,
          Action.EXPORT,
        ],
      },
    ],
  },
  {
    group: "WAREHOUSE (WMS)",
    resources: [
      {
        code: Resource.INVENTORY_STOCK, // <-- Giữ nguyên cho việc quản lý kho thực tế
        name: "Stock Management",
        availableActions: [Action.READ, Action.UPDATE],
      },
      {
        code: Resource.INVENTORY_TRANSFERS,
        name: "Stock Tickets & Transfers",
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.APPROVE,
          Action.REJECT,
          Action.CANCEL,
          Action.EXPORT,
          Action.PRINT,
        ],
      },
    ],
  },
  {
    group: "CUSTOMER CRM",
    resources: [
      {
        code: Resource.CRM_CUSTOMERS,
        name: "Customer Management",
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.EXPORT,
          Action.CHANGE_STATUS,
        ],
      },
      {
        code: Resource.CRM_CHAT,
        name: "Live Chat Support",
        availableActions: [
          Action.READ,
          Action.REPLY,
          Action.UPDATE,
          Action.ASSIGN,
        ],
      },
    ],
  },
  {
    group: "MARKETING SUITE",
    resources: [
      {
        code: Resource.PROMO_FLASH_SALES,
        name: "Promotion Management",
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.CHANGE_STATUS,
        ],
      },
      {
        code: Resource.CRM_REVIEWS,
        name: "Review & Rating Management",
        availableActions: [
          Action.READ,
          Action.REPLY,
          Action.APPROVE,
          Action.PUBLISH,
          Action.UNPUBLISH,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.PROMO_COUPONS,
        name: "Coupon Management",
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.CHANGE_STATUS,
        ],
      },
      {
        code: Resource.PROMO_COMBOS,
        name: "Combo Deals",
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.CHANGE_STATUS,
        ],
      },
    ],
  },
  {
    group: "USERS & ROLES",
    resources: [
      {
        code: Resource.SYSTEM_USERS,
        name: "User Management",
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.CHANGE_STATUS,
        ],
      },
      {
        code: Resource.SYSTEM_ROLES,
        name: "Role Management",
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.CHANGE_STATUS,
        ],
      },
    ],
  },
  {
    group: "COMMUNICATION",
    resources: [
      {
        code: Resource.CONTENT_PAGES,
        name: "Static Page Management",
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.CHANGE_STATUS,
        ],
      },
      {
        code: Resource.CONTENT_MEDIA,
        name: "Media Management",
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.CONTENT_BANNERS,
        name: "Banner Management",
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.CHANGE_STATUS,
        ],
      },
      {
        code: Resource.CONTENT_POSTS,
        name: "Blog & News Management",
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.SUBMIT_APPROVAL,
          Action.APPROVE,
          Action.PUBLISH,
          Action.UNPUBLISH,
        ],
      },
      {
        code: Resource.CONTENT_CONFIG,
        name: "Content Config",
        availableActions: [Action.READ, Action.UPDATE],
      },
    ],
  },
  {
    group: "SYSTEM",
    resources: [
      {
        code: Resource.SYSTEM_MONITORING,
        name: "System Overview & Security",
        availableActions: [Action.READ, Action.UPDATE],
      },
      {
        code: Resource.SYSTEM_AUDIT,
        name: "Audit Logs",
        availableActions: [Action.READ, Action.EXPORT],
      },
    ],
  },
];
