import { Action, Resource } from '../enums/resource.enum';

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
    group: 'DASHBOARD & REPORTS',
    resources: [
      {
        code: Resource.DASHBOARD,
        name: 'Overview',
        availableActions: [Action.READ],
      },
      {
        code: Resource.REPORT_REVENUE,
        name: 'Revenue Report',
        availableActions: [Action.READ, Action.EXPORT],
      },
      {
        code: Resource.REPORT_MARKETING,
        name: 'Marketing & Promotion',
        availableActions: [Action.READ, Action.EXPORT, Action.UPDATE],
      },
      {
        code: Resource.REPORT_INVENTORY,
        name: 'Business Intelligence (BI)',
        availableActions: [Action.READ],
      },
      {
        code: Resource.REPORT_STOCK, // <-- FIX: Tách thành quyền Báo cáo kho
        name: 'Inventory Management',
        availableActions: [Action.READ, Action.EXPORT],
      },
    ],
  },
  {
    group: 'PRODUCT CATALOG',
    resources: [
      {
        code: Resource.CATALOG_PRODUCTS,
        name: 'Product Management',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.CATALOG_CATEGORIES,
        name: 'Category Management',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.CATALOG_ATTRIBUTES,
        name: 'Variant Management',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.CATALOG_PRICING,
        name: 'Price Management',
        availableActions: [
          Action.READ,
          Action.SUBMIT_APPROVAL,
          Action.APPROVE,
          Action.REJECT,
        ],
      },
      {
        code: Resource.CATALOG_TAGS,
        name: 'Tag Management',
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
    group: 'ORDER MANAGEMENT',
    resources: [
      {
        code: Resource.SALES_ORDERS,
        name: 'Order Management',
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
        name: 'Trade-in Management',
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
    group: 'WAREHOUSE (WMS)',
    resources: [
      {
        code: Resource.INVENTORY_STOCK, // <-- Giữ nguyên cho việc quản lý kho thực tế
        name: 'Stock Management',
        availableActions: [Action.READ, Action.UPDATE],
      },
      {
        code: Resource.INVENTORY_TRANSFERS,
        name: 'Stock Tickets & Transfers',
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
    group: 'CUSTOMER CRM',
    resources: [
      {
        code: Resource.CRM_CUSTOMERS,
        name: 'Customer Management',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.EXPORT,
        ],
      },
      {
        code: Resource.CRM_CHAT,
        name: 'Live Chat Support',
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
    group: 'MARKETING SUITE',
    resources: [
      {
        code: Resource.PROMO_FLASH_SALES,
        name: 'Promotion Management',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.UNPUBLISH,
          Action.PUBLISH,
        ],
      },
      {
        code: Resource.CRM_REVIEWS,
        name: 'Review & Rating Management',
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
        name: 'Coupon Management',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.UNPUBLISH,
          Action.PUBLISH,
        ],
      },
      {
        code: Resource.PROMO_COMBOS,
        name: 'Combo Deals',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.UNPUBLISH,
          Action.PUBLISH,
        ],
      },
    ],
  },
  {
    group: 'USERS & ROLES',
    resources: [
      {
        code: Resource.SYSTEM_USERS,
        name: 'User Management',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.SYSTEM_ROLES,
        name: 'Role Management',
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
    group: 'COMMUNICATION',
    resources: [
      {
        code: Resource.CONTENT_PAGES,
        name: 'Static Page Management',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.PUBLISH,
          Action.UNPUBLISH,
        ],
      },
      {
        code: Resource.CONTENT_MEDIA,
        name: 'Media Management',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.CONTENT_BANNERS,
        name: 'Banner Management',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.UNPUBLISH,
          Action.PUBLISH,
        ],
      },
      {
        code: Resource.CONTENT_POSTS,
        name: 'Blog & News Management',
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
        name: 'Content Config',
        availableActions: [Action.READ, Action.UPDATE],
      },
    ],
  },
  {
    group: 'SYSTEM',
    resources: [
      {
        code: Resource.SYSTEM_MONITORING,
        name: 'System Overview & Security',
        availableActions: [Action.READ],
      },
      {
        code: Resource.SYSTEM_AUDIT,
        name: 'Audit Logs',
        availableActions: [Action.READ, Action.EXPORT],
      },
      {
        code: Resource.SYSTEM_NOTIFICATIONS,
        name: 'Notification Management',
        availableActions: [Action.READ],
      },
    ],
  },
];
