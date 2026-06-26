import { Resource, Action } from '../enums/resource.enum';

export const PERMISSION_METADATA = [
  {
    group: 'PHÂN HỆ KHO VẬN',
    resources: [
      {
        code: Resource.ORDERS,
        name: 'Quản lý đơn hàng',
        // Gộp toàn bộ quyền của Kho (export) và CSKH (approve, cancel) vào chung một màn hình UI
        availableActions: [
          Action.READ,
          Action.UPDATE,
          Action.APPROVE,
          Action.CANCEL,
          Action.EXPORT,
        ],
      },
      // Tách bạch 3 tab của WMS thành 3 UI riêng biệt trên frontend
      {
        code: Resource.TRANSFERS,
        name: 'Hàng chờ yêu cầu (Request Queue)',
        availableActions: [Action.READ, Action.APPROVE, Action.REJECT],
      },
      {
        code: Resource.INVENTORY,
        name: 'Tổng quan tồn kho (Total Stock Overview)',
        availableActions: [Action.READ, Action.UPDATE],
      },
      {
        code: Resource.TRANSFERS,
        name: 'Lịch sử phiếu kho (Ticket History)',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.EXPORT,
        ],
      },
    ],
  },
  {
    group: 'PHÂN HỆ QUẢN LÝ',
    resources: [
      {
        code: Resource.DASHBOARD,
        name: 'Tổng quan (Overview)',
        availableActions: [Action.READ],
      },
      {
        code: Resource.REPORTS,
        name: 'Báo cáo doanh thu',
        availableActions: [Action.READ],
      },
      {
        code: Resource.REPORTS,
        name: 'Thống kê tiếp thị và khuyến mãi',
        availableActions: [Action.READ],
      },
      {
        code: Resource.REPORTS,
        name: 'Phân tích dữ liệu kinh doanh',
        availableActions: [Action.READ],
      },
      {
        code: Resource.REPORTS,
        name: 'Thống kê quản lý kho hàng',
        // Vẫn giữ export vì giao diện có nút xuất PDF và Excel
        availableActions: [Action.READ, Action.EXPORT],
      },
    ],
  },
  {
    group: 'PHÂN HỆ SALE & MARKETING',
    resources: [
      {
        code: Resource.CATEGORIES,
        name: 'Quản lý danh mục',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.ATTRIBUTES,
        name: 'Quản lý nhãn (Tags)',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.ATTRIBUTES,
        name: 'Quản lý biến thể',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.PRODUCTS,
        name: 'Quản lý sản phẩm',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.PRODUCTS,
        name: 'Quản lý giá',
        availableActions: [Action.READ, Action.UPDATE, Action.APPROVE],
      },
      {
        code: Resource.PROMOTIONS,
        name: 'Quản lý mã giảm giá',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.PUBLISH,
        ],
      },
      {
        code: Resource.PROMOTIONS,
        name: 'Quản lý khuyến mãi',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.PUBLISH,
        ],
      },
      {
        code: Resource.REVIEWS,
        name: 'Quản lý đánh giá',
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
    group: 'PHÂN HỆ VẬN HÀNH VÀ BẢO TRÌ',
    resources: [
      {
        code: Resource.USERS,
        name: 'Quản lý người dùng',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.ROLES,
        name: 'Quản lý vai trò và phân quyền',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.SYSTEM,
        name: 'Phân tích hành vi người dùng',
        availableActions: [Action.READ],
      },
      {
        code: Resource.SYSTEM,
        name: 'Giám sát hệ thống',
        availableActions: [Action.READ, Action.UPDATE],
      },
    ],
  },
  {
    group: 'PHÂN HỆ CHĂM SÓC KHÁCH HÀNG',
    resources: [
      {
        code: Resource.CUSTOMERS,
        name: 'Quản lý tài khoản khách hàng',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.EXPORT,
        ],
      },
      {
        code: Resource.SUPPORT,
        name: 'Danh sách hội thoại (Live Chat)',
        availableActions: [Action.READ, Action.UPDATE],
      },
      {
        code: Resource.TRADE_IN,
        name: 'Tiếp nhận yêu cầu thu cũ',
        availableActions: [
          Action.READ,
          Action.UPDATE,
          Action.APPROVE,
          Action.EXPORT,
        ],
      },
    ],
  },
  {
    group: 'PHÂN HỆ CHIẾN DỊCH TRUYỀN THÔNG',
    resources: [
      {
        code: Resource.SYSTEM,
        name: 'Quản lý trang Landing Page',
        availableActions: [Action.READ, Action.UPDATE],
      },
      {
        code: Resource.BLOG,
        name: 'Quản lý trang tĩnh',
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
        name: 'Quản lý video và hình ảnh',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
        ],
      },
      {
        code: Resource.BLOG,
        name: 'Quản lý banner',
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
        name: 'Quản lý bài viết và tin tức',
        availableActions: [
          Action.READ,
          Action.CREATE,
          Action.UPDATE,
          Action.DELETE,
          Action.PUBLISH,
        ],
      },
    ],
  },
];
