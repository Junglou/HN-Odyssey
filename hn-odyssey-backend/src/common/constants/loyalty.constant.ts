// Hạng có min_spent = 0 trong collection member_tiers (đã xác nhận từ DB: BRONZE).
// Dùng làm giá trị mặc định ở MỌI nơi thiếu thông tin hạng.
export const DEFAULT_TIER_CODE = 'BRONZE';

// Điểm có hạn 365 ngày kể từ khi được cộng / được hoàn
export const POINT_EXPIRY_DAYS = 365;
