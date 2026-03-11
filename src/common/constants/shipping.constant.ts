// src/common/constants/shipping.constant.ts
import { OrderStatus } from '../interfaces/order.interface';
export const PROVINCES = {
  SUPPORTED_INSTANT: ['79', '01'], // 79: HCM, 01: HN (Chỉ 2 TP này có Hỏa tốc)
};

// Danh sách Quận/Huyện Nội thành (Dùng để tính phí rẻ & Hỗ trợ hỏa tốc)
export const INNER_DISTRICTS = {
  // TP. Hồ Chí Minh (79)
  '79': [
    '760', // Quận 1
    '769', // Quận 2 (TP Thủ Đức)
    '770', // Quận 3
    '771', // Quận 4
    '772', // Quận 5
    '773', // Quận 6
    '774', // Quận 7
    '775', // Quận 8
    '761', // Quận 12
    '776', // Quận Gò Vấp
    '777', // Quận Tân Bình
    '778', // Quận Tân Phú
    '780', // Quận Bình Thạnh
    '781', // Quận Phú Nhuận
    '764', // Quận Gò Vấp
    '765', // Quận Bình Tân
    '768', // TP Thủ Đức
  ],
  // Hà Nội (01)
  '01': [
    '001', // Ba Đình
    '002', // Hoàn Kiếm
    '003', // Tây Hồ
    '004', // Long Biên
    '005', // Cầu Giấy
    '006', // Đống Đa
    '007', // Hai Bà Trưng
    '008', // Hoàng Mai
    '009', // Thanh Xuân
    '019', // Nam Từ Liêm
    '021', // Bắc Từ Liêm
  ],
};

export const SHIPPING_FEES = {
  INNER_CITY: 15000, // Nội thành (HCM/HN)
  OUTER_CITY: 30000, // Ngoại thành (Củ Chi, Nhà Bè, Sóc Sơn...)
  OTHER_PROVINCE: 35000, // Các tỉnh khác

  INSTANT_SURCHARGE: 25000, // Phụ phí hỏa tốc
  BULKY_SURCHARGE: 20000, // Phụ phí hàng cồng kềnh (>30kg)

  MAX_WEIGHT_INSTANT: 30, // Max kg hỏa tốc
  MAX_WEIGHT_STANDARD: 50, // Max kg thường

  UNSUPPORTED_PROVINCES: ['97', '98', '99'],
};

export const GHN_INTERNAL_MAP: Record<string, OrderStatus> = {
  ready_to_pick: OrderStatus.READY_TO_SHIP,
  picking: OrderStatus.SHIPPING,
  storing: OrderStatus.SHIPPING,
  delivered: OrderStatus.COMPLETED,
  return: OrderStatus.RETURNED,
  cancel: OrderStatus.DELIVERY_FAILED,
};

export const GHTK_INTERNAL_MAP: Record<string, OrderStatus> = {
  '2': OrderStatus.READY_TO_SHIP, // Đang chờ lấy hàng
  '3': OrderStatus.SHIPPING, // Đã lấy hàng/Đang giao
  '4': OrderStatus.SHIPPING, // Đang giao hàng
  '45': OrderStatus.COMPLETED, // Đã giao hàng thành công
  '21': OrderStatus.RETURNED, // Đã trả hàng
  '-1': OrderStatus.CANCELLED, // Đã hủy
};
