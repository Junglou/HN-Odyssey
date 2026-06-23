import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { User, UserDocument } from 'src/modules/users/schemas/user.schema';
import { Department } from 'src/common/enums/department.enum';
import { Resource } from 'src/common/enums/resource.enum';

// Interface cục bộ hoặc import từ DTO
export interface CreateAuditLogDto {
  action: string;
  collection_name: string;
  actor_id?: string | Types.ObjectId | null;
  actor_employee_code?: string;
  actor_email?: string;
  target_id?: string | Types.ObjectId | null;
  department: Department | string;
  detail?: Record<string, any>;
  is_success?: boolean;
  error_reason?: string;
  ip?: string;
  user_agent?: string;
}

interface ActorProjection {
  email?: string;
  employee_code?: string;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private mapResourceToDepartment(resource: string): string {
    if (!resource) return Department.MANAGEMENT;

    const r = resource.toUpperCase();

    // 1. NHÓM KHO VẬN (WAREHOUSE)
    const warehouseResources = [
      Resource.INVENTORY,
      Resource.TRANSFERS,
      Resource.SUPPLIERS,
      Resource.SHIPPING,
    ].map((x) => x.toString());

    if (warehouseResources.includes(r)) {
      return Department.WAREHOUSE;
    }

    // 2. NHÓM MARKETING & CATALOG
    const marketingResources = [
      Resource.PRODUCTS,
      Resource.CATEGORIES,
      Resource.ATTRIBUTES,
      Resource.PROMOTIONS,
      Resource.BLOG,
      Resource.NOTIFICATIONS,
      Resource.LOYALTY,
    ].map((x) => x.toString());

    if (marketingResources.includes(r)) {
      return Department.MARKETING;
    }

    // 3. NHÓM KINH DOANH (SALES)
    const salesResources = [
      Resource.ORDERS,
      Resource.RETURNS,
      Resource.TRADE_IN,
      Resource.CUSTOMERS,
    ].map((x) => x.toString());

    if (salesResources.includes(r)) {
      return Department.SALES;
    }

    // 4. NHÓM DỊCH VỤ KHÁCH HÀNG (SUPPORT)
    const supportResources = [
      Resource.SUPPORT,
      Resource.WARRANTY,
      Resource.REVIEWS,
    ].map((x) => x.toString());

    if (supportResources.includes(r)) {
      return Department.SUPPORT;
    }

    // 5. NHÓM KẾ TOÁN (ACCOUNTING)
    const accountingResources = [Resource.REPORTS, Resource.PAYMENT].map((x) =>
      x.toString(),
    );
    if (accountingResources.includes(resource.toUpperCase())) {
      return Department.ACCOUNTING;
    }

    return Department.MANAGEMENT;
  }

  private readonly SENSITIVE_KEYS = [
    'password',
    'token',
    'access_token',
    'refresh_token',
    'cc_number',
    'cvv',
    'bank_account',
    'secret',
    'apiKey',
  ];

  private sanitizeDetail(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;

    // [FIX 126]: Ép kiểu ngay sau khi parse để tránh 'any'
    const sanitized = JSON.parse(JSON.stringify(data)) as Record<string, any>;

    const recursiveSanitize = (obj: Record<string, any>) => {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (this.SENSITIVE_KEYS.includes(key)) {
            obj[key] = '***REDACTED***';
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            // [FIX 140]: Tham số gọi đệ quy giờ đã an toàn do obj[key] được check type
            recursiveSanitize(obj[key] as Record<string, any>);
          }
        }
      }
    };

    // [FIX 134]: sanitized đã được ép kiểu ở trên
    recursiveSanitize(sanitized);
    return sanitized;
  }

  async log(data: CreateAuditLogDto): Promise<void> {
    try {
      const {
        action,
        collection_name,
        actor_id,
        target_id,
        is_success = true,
        error_reason,
        ip,
        user_agent,
      } = data;

      let { actor_employee_code, actor_email } = data;

      if (data.actor_id && (!actor_employee_code || !actor_email)) {
        const actor = await this.userModel
          .findById(data.actor_id)
          .select('email employee_code')
          .lean<ActorProjection>()
          .exec();

        if (actor) {
          if (!actor_employee_code && actor.employee_code) {
            actor_employee_code = actor.employee_code;
          }
          if (!actor_email && actor.email) {
            actor_email = actor.email;
          }
        }
      }

      const actorObjectId = this.toObjectId(actor_id);
      const targetObjectId = this.toObjectId(target_id);
      const safeDetail = this.sanitizeDetail(data.detail || {});

      let finalDepartment = data.department;
      if (!finalDepartment && data.collection_name) {
        finalDepartment = this.mapResourceToDepartment(data.collection_name);
      }

      if (!finalDepartment) finalDepartment = Department.MANAGEMENT;

      await this.auditLogModel.create({
        action,
        collection_name,
        actor_id: actorObjectId,
        actor_employee_code,
        actor_email,
        target_id: targetObjectId,
        department: finalDepartment,
        detail: safeDetail,
        is_success,
        error_reason: is_success ? undefined : error_reason,
        ip,
        user_agent,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `[AUDIT LOG FAIL] Action: ${data.action} - Error: ${msg}`,
        stack,
      );
    }
  }

  private toObjectId(
    id?: string | Types.ObjectId | null,
  ): Types.ObjectId | null {
    if (!id) return null;
    if (id instanceof Types.ObjectId) return id;
    if (Types.ObjectId.isValid(id)) return new Types.ObjectId(id);
    return null;
  }

  async findAll(query: QueryAuditLogDto) {
    const {
      page = 1,
      limit = 20,
      action,
      collection_name,
      actor_id,
      target_id,
      from_date,
      to_date,
      is_success,
      actor_employee_code,
      actor_email,
      department,
    } = query;

    const skip = (Number(page) - 1) * Number(limit);
    const filter: FilterQuery<AuditLog> = {};

    if (action) filter.action = action;
    if (collection_name) filter.collection_name = collection_name;

    if (actor_id && Types.ObjectId.isValid(actor_id)) {
      filter.actor_id = new Types.ObjectId(actor_id);
    }
    if (target_id && Types.ObjectId.isValid(target_id)) {
      filter.target_id = new Types.ObjectId(target_id);
    }

    // [FIX 266-267]: Sử dụng biến trung gian có type rõ ràng
    // thay vì gán trực tiếp vào filter.createdAt
    if (from_date || to_date) {
      const dateQuery: Record<string, Date> = {};

      if (from_date) {
        dateQuery['$gte'] = new Date(from_date);
      }
      if (to_date) {
        dateQuery['$lte'] = new Date(to_date);
      }

      // Gán object đã hoàn thiện vào filter
      if (Object.keys(dateQuery).length > 0) {
        filter.createdAt = dateQuery;
      }
    }

    if (is_success !== undefined) {
      const isSuccessBool = String(is_success) === 'true';
      filter.is_success = isSuccessBool;
    }

    if (department) {
      filter.department = department;
    }

    if (actor_employee_code) {
      filter.actor_employee_code = {
        $regex: actor_employee_code,
        $options: 'i',
      };
    }

    if (actor_email) {
      filter.actor_email = { $regex: actor_email, $options: 'i' };
    }

    const [total, data] = await Promise.all([
      this.auditLogModel.countDocuments(filter),
      this.auditLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('actor_id', 'first_Name last_Name email fullName')
        .lean(),
    ]);

    return {
      data,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(total / Number(limit)),
      },
    };
  }
}
