import { Resource, Action } from '../enums/resource.enum';

export const PERMISSION_METADATA = [
  {
    group: 'QUẢN TRỊ HỆ THỐNG (SYSTEM)',
    resources: [
      {
        code: Resource.SYSTEM,
        name: 'Cấu hình & Giám sát hệ thống',
        availableActions: [Action.READ, Action.UPDATE],
      },
      {
        code: Resource.USERS,
        name: 'Quản lý nhân viên',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.ROLES,
        name: 'Phân quyền & Vai trò',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.AUDIT_LOGS,
        name: 'Nhật ký hoạt động',
        availableActions: [Action.READ, Action.EXPORT],
      },
    ],
  },
  {
    group: 'MARKETING & SẢN PHẨM (CATALOG)',
    resources: [
      {
        code: Resource.PRODUCTS,
        name: 'Thông tin Sản phẩm',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.IMPORT,
          Action.EXPORT,
        ],
      },
      {
        code: Resource.CATEGORIES,
        name: 'Danh mục sản phẩm',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.ATTRIBUTES,
        name: 'Thuộc tính & Nhãn (Tags)',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.PROMOTIONS,
        name: 'Khuyến mãi & Coupon',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.PUBLISH,
        ],
      },
      {
        code: Resource.BLOG,
        name: 'Tin tức & Trang tĩnh (Media)',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.PUBLISH,
        ],
      },
      {
        code: Resource.NOTIFICATIONS,
        name: 'Thông báo (Push/Email)',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.PUBLISH,
        ],
      },
      {
        code: Resource.LOYALTY,
        name: 'Khách hàng thân thiết',
        availableActions: [Action.READ, Action.UPDATE],
      },
    ],
  },
  {
    group: 'KINH DOANH (SALES)',
    resources: [
      {
        code: Resource.ORDERS,
        name: 'Quản lý đơn hàng',
        availableActions: [
          Action.READ,
          Action.UPDATE,
          Action.APPROVE,
          Action.CANCEL,
          Action.EXPORT,
        ],
      },
      {
        code: Resource.RETURNS,
        name: 'Yêu cầu Trả hàng/Hoàn tiền',
        availableActions: [Action.READ, Action.APPROVE, Action.REJECT],
      },
      {
        code: Resource.TRADE_IN,
        name: 'Thu cũ đổi mới',
        availableActions: [
          Action.READ,
          Action.UPDATE,
          Action.APPROVE,
          Action.EXPORT,
        ],
      },
      {
        code: Resource.CUSTOMERS,
        name: 'Hồ sơ Khách hàng',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.EXPORT,
          Action.MANAGE,
        ],
      },
    ],
  },
  {
    group: 'KHO VẬN (WAREHOUSE)',
    resources: [
      {
        code: Resource.INVENTORY,
        name: 'Tồn kho & Kiểm kê',
        availableActions: [Action.READ, Action.UPDATE, Action.EXPORT],
      },
      {
        code: Resource.TRANSFERS,
        name: 'Phiếu Nhập/Xuất kho',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE, // Đã bổ sung cho chức năng completeTicket
          Action.APPROVE,
          Action.CANCEL,
          Action.EXPORT,
        ],
      },
      {
        code: Resource.SUPPLIERS,
        name: 'Nhà cung cấp',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.SHIPPING,
        name: 'Cấu hình Vận chuyển',
        availableActions: [Action.READ, Action.UPDATE],
      },
    ],
  },
  {
    group: 'DỊCH VỤ KHÁCH HÀNG (SUPPORT)',
    resources: [
      {
        code: Resource.SUPPORT,
        name: 'Hỗ trợ khách hàng (Chat)',
        availableActions: [Action.READ, Action.UPDATE],
      },
      {
        code: Resource.WARRANTY,
        name: 'Bảo hành điện tử',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.APPROVE,
        ],
      },
      {
        code: Resource.REVIEWS,
        name: 'Duyệt Đánh giá',
        availableActions: [
          Action.READ,
          Action.APPROVE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
    ],
  },
  {
    group: 'KẾ TOÁN & BÁO CÁO',
    resources: [
      {
        code: Resource.REPORTS,
        name: 'Báo cáo thống kê',
        availableActions: [Action.READ, Action.UPDATE, Action.EXPORT],
      },
      {
        code: Resource.PAYMENT,
        name: 'Giao dịch Thanh toán',
        availableActions: [Action.READ, Action.UPDATE, Action.EXPORT],
      },
    ],
  },
  {
    group: 'TỔNG QUAN (DASHBOARD)',
    resources: [
      {
        code: Resource.DASHBOARD,
        name: 'Bảng điều khiển (Dashboard)',
        availableActions: [Action.READ],
      },
    ],
  },
];
