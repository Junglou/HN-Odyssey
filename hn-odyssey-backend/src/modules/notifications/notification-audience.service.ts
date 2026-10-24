import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  Role,
  RoleDocument,
} from 'src/modules/users/roles/schemas/role.schema';
import { User, UserDocument } from 'src/modules/users/schemas/user.schema';
import { Action } from 'src/common/enums/resource.enum';
import { RoleLevel } from 'src/common/enums/role-level.enum';
import { UserStatus } from 'src/common/enums/user-status.enum';
import {
  RESERVED_ROLE_SLUGS,
  isReservedRoleKey,
} from 'src/common/constants/system-roles.constant';
import {
  NotificationLog,
  NotificationScope,
} from './schemas/notification-log.schema';

export interface AudienceTarget {
  resource: string;
  action: string;
  minLevel: number | null;
}

interface LeanRole {
  slug: string;
  level?: number;
  is_system?: boolean;
  permissions?: { resource: string; actions?: string[] }[];
}

/**
 * Trả lời 2 câu hỏi, đều dựa trên ma trận quyền của Role Management:
 *  1. Khi phát sự kiện: AI nhận? (resolveRecipientIds)
 *  2. Khi user mở chuông: user này được THẤY những thông báo nào? (buildVisibilityFilter)
 * Hai hàm dùng cùng một quy tắc nên realtime và danh sách luôn khớp nhau.
 */
@Injectable()
export class NotificationAudienceService {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /** Danh sách user ID có quyền nhận thông báo theo resource + action (+ cấp) */
  async resolveRecipientIds(target: AudienceTarget): Promise<string[]> {
    const permissionMatch: Record<string, unknown> = {
      permissions: {
        $elemMatch: {
          resource: target.resource,
          actions: { $in: [target.action, Action.MANAGE] },
        },
      },
    };
    if (target.minLevel !== null) {
      permissionMatch.level = { $lte: target.minLevel };
    }

    const roles = await this.roleModel
      .find({
        is_active: { $ne: false },
        $or: [
          { is_system: true },
          { slug: { $in: RESERVED_ROLE_SLUGS } },
          permissionMatch,
        ],
      })
      .select('slug')
      .lean<{ slug: string }[]>()
      .exec();

    // Super Admin luôn nhận tất cả, kể cả khi DB chưa có document role tương ứng
    const slugs = Array.from(
      new Set([...roles.map((r) => r.slug), ...RESERVED_ROLE_SLUGS]),
    );

    const users = await this.userModel
      .find({
        roles: { $in: slugs },
        status: UserStatus.ACTIVE,
        is_deleted: { $ne: true },
        is_active: { $ne: false },
      })
      .select('_id')
      .lean<{ _id: Types.ObjectId }[]>()
      .exec();

    return users.map((u) => String(u._id));
  }

  /** Người nhận của 1 thông báo đã lưu (dùng khi gộp / resolve) */
  async resolveRecipientsForDoc(
    doc: Pick<
      NotificationLog,
      'recipient_id' | 'target_resource' | 'required_action' | 'min_level'
    >,
  ): Promise<string[]> {
    if (doc.recipient_id) return [String(doc.recipient_id)];
    if (!doc.target_resource || !doc.required_action) return [];
    return this.resolveRecipientIds({
      resource: doc.target_resource,
      action: doc.required_action,
      minLevel: doc.min_level ?? null,
    });
  }

  /** Bộ lọc Mongo: những thông báo user được phép thấy */
  async buildVisibilityFilter(
    userId: string,
  ): Promise<FilterQuery<NotificationLog>> {
    const uid = new Types.ObjectId(userId);
    const personal = { recipient_id: uid };
    const portalBroadcast = {
      scope: NotificationScope.PORTAL,
      recipient_id: null,
    };

    const user = await this.userModel
      .findById(uid)
      .select('roles')
      .lean<{ roles?: string[] }>()
      .exec();
    const slugs = (user?.roles ?? []).map(String);

    // Super Admin: thấy mọi thông báo Portal (không thấy thông báo cá nhân của người khác)
    if (slugs.some((s) => isReservedRoleKey(s))) {
      return {
        $or: [personal, portalBroadcast],
      } as FilterQuery<NotificationLog>;
    }

    const roles = await this.roleModel
      .find({ slug: { $in: slugs }, is_active: { $ne: false } })
      .select('slug level is_system permissions')
      .lean<LeanRole[]>()
      .exec();

    if (roles.some((r) => r.is_system)) {
      return {
        $or: [personal, portalBroadcast],
      } as FilterQuery<NotificationLog>;
    }

    // Mỗi (role, permission) sinh 1 điều kiện. Cấp được xét theo CHÍNH role cấp quyền đó,
    // giống hệt resolveRecipientIds.
    const permissionConditions = roles.flatMap((role) => {
      const level = role.level ?? RoleLevel.STAFF;
      return (role.permissions ?? []).map((p) => {
        const actions = (p.actions ?? []).map(String);
        return {
          ...portalBroadcast,
          target_resource: p.resource,
          ...(actions.includes(Action.MANAGE)
            ? {}
            : { required_action: { $in: actions } }),
          $or: [{ min_level: null }, { min_level: { $gte: level } }],
        };
      });
    });

    return {
      $or: [personal, ...permissionConditions],
    } as FilterQuery<NotificationLog>;
  }
}
