import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog } from './schemas/audit-log.schema';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

export interface CreateAuditLogDto {
  action: string;
  collection_name: string;
  actor_id?: string | Types.ObjectId | null;
  target_id?: string | Types.ObjectId | null;
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
  ) {}

  async log(data: CreateAuditLogDto): Promise<void> {
    try {
      const {
        action,
        collection_name,
        actor_id,
        target_id,
        detail,
        is_success = true, // Mặc định là thành công
        error_reason,
        ip,
        user_agent,
      } = data;

      // Convert String ID sang ObjectId an toàn (để tránh lỗi MongoDB CastError)
      const actorObjectId = this.toObjectId(actor_id);
      const targetObjectId = this.toObjectId(target_id);

      await this.auditLogModel.create({
        action,
        collection_name,
        actor_id: actorObjectId,
        target_id: targetObjectId,
        detail: detail || {},
        is_success,
        error_reason: is_success ? undefined : error_reason, // Chỉ lưu lý do nếu lỗi
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
    return null; // Trả về null nếu ID không hợp lệ (tránh crash)
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
    } = query;

    const filter: any = {};

    // Xây dựng bộ lọc dynamic
    if (action) filter.action = action;
    if (collection_name) filter.collection_name = collection_name;
    if (actor_id && Types.ObjectId.isValid(actor_id))
      filter.actor_id = new Types.ObjectId(actor_id);
    if (target_id && Types.ObjectId.isValid(target_id))
      filter.target_id = new Types.ObjectId(target_id);

    // Lọc theo khoảng thời gian
    if (from_date || to_date) {
      filter.createdAt = {};
      if (from_date) filter.createdAt.$gte = new Date(from_date);
      if (to_date) filter.createdAt.$lte = new Date(to_date);
    }

    if (is_success !== undefined) {
      filter.is_success = is_success === 'true';
    }

    // Query DB
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ createdAt: -1 }) // Mới nhất lên đầu
        .skip(skip)
        .limit(limit)
        .populate('actor_id', 'full_name email roles') // Populate để lấy tên người làm
        .lean(), // Tăng tốc độ đọc
      this.auditLogModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        last_page: Math.ceil(total / limit),
      },
    };
  }
}
