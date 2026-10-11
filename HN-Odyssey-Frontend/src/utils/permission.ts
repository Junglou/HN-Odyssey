import tokenStorage from "./tokenStorage";
import { Action } from "../types/permissions";

// Chỉ cần 2 field này → dùng được cho cả UserPayload và UserProfile
export interface PermissionSubject {
  roles?: unknown;
  permissions?: unknown;
}

// Đồng bộ với RESERVED_ROLE_SLUGS ở Backend (system-roles.constant.ts)
const SUPER_ROLE_KEYS = ["SUPER_ADMIN"];

// Chuẩn hóa giống hệt Backend: "Super-Admin" / "super admin" → "SUPER_ADMIN"
const normalize = (value: unknown): string =>
  typeof value === "string"
    ? value
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "_")
    : "";

/** Đọc user hiện tại — LUÔN qua tokenStorage, không tự đọc localStorage */
export const getCurrentUser = <T extends PermissionSubject>(): T | null =>
  tokenStorage.getUser<T>();

export const isSuperAdmin = (user: PermissionSubject | null): boolean => {
  if (!user || !Array.isArray(user.roles)) return false;
  const roles: unknown[] = user.roles;
  return roles.some((r) => SUPER_ROLE_KEYS.includes(normalize(r)));
};

/**
 * Kiểm tra quyền. Không truyền `action` → chỉ cần có resource (dùng cho AuthGuard).
 * Chỉ để ẩn/hiện UI — Backend vẫn là nơi chặn thật sự.
 */
export const hasPermission = (
  user: PermissionSubject | null,
  resource: string,
  action?: string,
): boolean => {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (!Array.isArray(user.permissions)) return false;

  const perms: unknown[] = user.permissions;
  const targetRes = normalize(resource);
  const targetAct = action ? normalize(action) : null;

  return perms.some((p) => {
    // Định dạng cũ dạng chuỗi: chỉ biết resource, không biết action
    if (typeof p === "string") return !targetAct && normalize(p) === targetRes;

    if (!p || typeof p !== "object") return false;
    const obj = p as Record<string, unknown>;
    if (normalize(obj.resource) !== targetRes) return false;
    if (!targetAct) return true;

    const acts: unknown[] = Array.isArray(obj.actions) ? obj.actions : [];
    return acts.some((a) => {
      const act = normalize(a);
      return act === targetAct || act === Action.MANAGE;
    });
  });
};
