// Các slug chỉ được tạo bởi seeder; API tạo/sửa Role sẽ chặn (xem A17)
export const RESERVED_ROLE_SLUGS = ['SUPER_ADMIN'];

// Chuẩn hóa giống hệt Frontend: "Super-Admin" / "super admin" → "SUPER_ADMIN"
export const normalizeRoleKey = (value: string): string =>
  value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

export const isReservedRoleKey = (value: string): boolean =>
  RESERVED_ROLE_SLUGS.includes(normalizeRoleKey(value));
