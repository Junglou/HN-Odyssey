import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog } from './schemas/audit-log.schema';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { User, UserDocument } from 'src/modules/users/schemas/user.schema';
import { Department } from 'src/common/enums/department.enum';
import { Resource } from 'src/common/enums/resource.enum';

export interface CreateAuditLogDto {
  action: string;
  collection_name: string;
  actor_id?: string | Types.ObjectId | null;
  actor_employee_code?: string;
  actor_email?: string;
  target_id?: string | Types.ObjectId | null;
  department: Department | string;
  detail?: any;
  is_success?: boolean;
  error_reason?: string;
  ip?: string;
  user_agent?: string;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLog>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private mapResourceToDepartment(resource: string): string {
    if (!resource) return Department.MANAGEMENT;

    // Chuyển về chữ hoa để so sánh an toàn
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

    if (accountingResources.includes(r)) {
      return Department.ACCOUNTING;
    }

    // Mặc định: SYSTEM, USERS, ROLES, AUDIT_LOGS, DASHBOARD -> MANAGEMENT
    return Department.MANAGEMENT;
  }

  private readonly SENSITIVE_KEYS = [
    'password',
    'token',
    'access_token',
    'refresh_token',
    'cc_number',
  ];

  private sanitizeDetail(data: any): any {
    if (!data || typeof data !== 'object') return data;
    const sanitized = JSON.parse(JSON.stringify(data));
    const recursiveSanitize = (obj: any) => {
      for (const key in obj) {
        if (this.SENSITIVE_KEYS.includes(key)) {
          obj[key] = '***REDACTED***'; // Che dữ liệu
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          recursiveSanitize(obj[key]);
        }
      }
    };

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
        department,
        is_success = true,
        error_reason,
        ip,
        user_agent,
      } = data;

      let { actor_employee_code, actor_email } = data;

      if (data.actor_id && (!actor_employee_code || !actor_email)) {
        const actor = await this.userModel
          .findById(data.actor_id)
          .select('email employee_code');

        if (actor) {
          const actorData = actor as any;

          if (!actor_employee_code && actorData.employee_code) {
            actor_employee_code = actorData.employee_code;
          }
          if (!actor_email && actorData.email) {
            actor_email = actorData.email;
          }
        }
      }

      // 1. Convert ID an toàn
      const actorObjectId = this.toObjectId(actor_id);
      const targetObjectId = this.toObjectId(target_id);

      // 2. Làm sạch dữ liệu nhạy cảm
      const safeDetail = this.sanitizeDetail(data.detail || {});

      let finalDepartment = data.department;
      if (!finalDepartment && data.collection_name) {
        // Giả sử collection_name chính là Resource key
        finalDepartment = this.mapResourceToDepartment(data.collection_name);
      }

      // Fallback về Management nếu vẫn null
      if (!finalDepartment) finalDepartment = Department.MANAGEMENT;

      // 3. Lưu vào DB
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
    } catch (error) {
      this.logger.error(
        `[AUDIT LOG FAIL] Action: ${data.action} - Error: ${error.message}`,
        error.stack,
      );
    }
  }

  // Helper chuyển đổi ID an toàn
  private toObjectId(
    id?: string | Types.ObjectId | null,
  ): Types.ObjectId | null {
    if (!id) return null;
    if (id instanceof Types.ObjectId) return id;
    if (Types.ObjectId.isValid(id)) return new Types.ObjectId(id);
    return null;
  }

  // 2. Hàm Tìm Kiếm
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
    } = query as any;

    const skip = (Number(page) - 1) * Number(limit);
    const filter: any = {};

    // Filter cơ bản
    if (action) filter.action = action;
    if (collection_name) filter.collection_name = collection_name;

    // Filter theo ID
    if (actor_id && Types.ObjectId.isValid(actor_id)) {
      filter.actor_id = new Types.ObjectId(actor_id);
    }
    if (target_id && Types.ObjectId.isValid(target_id)) {
      filter.target_id = new Types.ObjectId(target_id);
    }

    // Filter theo thời gian
    if (from_date || to_date) {
      filter.createdAt = {};
      if (from_date) filter.createdAt.$gte = new Date(from_date);
      if (to_date) filter.createdAt.$lte = new Date(to_date);
    }

    // Filter theo trạng thái
    if (is_success !== undefined) {
      filter.is_success = String(is_success) === 'true';
    }

    if (query.department) {
      filter.department = query.department;
    }

    if (actor_employee_code) {
      // Tìm gần đúng (không phân biệt hoa thường)
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
