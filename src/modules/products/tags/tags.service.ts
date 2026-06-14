import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tag, TagDocument } from './schemas/tag.schema';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagScope } from '../../../common/enums/tag-scope.enum';
import defaultSlugify from 'slugify';
import { Product, ProductDocument } from '../catalog/schemas/product.schema';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Định nghĩa Interface để xử lý triệt để lỗi no-unsafe-member-access của ESLint
interface TagUsageCount {
  _id: string;
  count: number;
}

@Injectable()
export class TagsService {
  constructor(
    @InjectModel(Tag.name) private tagModel: Model<TagDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // FIX LỖI "USAGE COUNT": Tính toán động dựa trên thực tế số lượng SP đang gắn thay vì count ảo
  async findAll(scope?: TagScope) {
    const filter = scope ? { scope } : {};
    const tags = await this.tagModel.find(filter).sort({ name: 1 }).lean();

    // Đếm chính xác Live count đang áp dụng từ bảng Product
    const tagNames = tags.map((t) => t.name);

    // Gắn Generic Type <TagUsageCount> để tránh lỗi any từ MongoDB Aggregation
    const usageCounts = await this.productModel.aggregate<TagUsageCount>([
      { $match: { tags: { $in: tagNames }, is_deleted: false } },
      { $unwind: '$tags' },
      { $match: { tags: { $in: tagNames } } },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
    ]);

    // Ép kiểu Map rõ ràng để tránh lỗi no-unsafe-assignment
    const countMap = new Map<string, number>(
      usageCounts.map((u) => [String(u._id), Number(u.count)]),
    );

    return tags
      .map((tag) => ({
        ...tag,
        usage_count: countMap.get(tag.name) || 0,
      }))
      .sort((a, b) => b.usage_count - a.usage_count);
  }

  async findOne(id: string) {
    const tag = await this.tagModel.findById(id);
    if (!tag) throw new NotFoundException('Thẻ không tồn tại');
    return tag;
  }

  async create(
    createTagDto: CreateTagDto,
    actorId: string,
    ip: string,
    userAgent: string,
  ) {
    const escapedName = escapeRegExp(createTagDto.name);
    const exists = await this.tagModel.findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
      scope: createTagDto.scope,
    });

    if (exists) {
      throw new ConflictException(
        `Thẻ '${createTagDto.name}' đã tồn tại trong mục ${createTagDto.scope}`,
      );
    }

    const slug = this.createSlug(createTagDto.name);
    const slugExists = await this.tagModel.findOne({
      slug,
      scope: createTagDto.scope,
    });

    if (slugExists) {
      throw new ConflictException(
        `Đường dẫn (Slug) này đã được sử dụng bởi thẻ khác`,
      );
    }

    const newTag = new this.tagModel({
      ...createTagDto,
      slug,
    });

    const savedTag = await newTag.save();

    await this.auditLogsService.log({
      action: 'CREATE_TAG',
      collection_name: 'tags',
      actor_id: actorId,
      target_id: savedTag._id,
      department: Department.MARKETING,
      detail: { name: savedTag.name, scope: savedTag.scope },
      ip,
      user_agent: userAgent,
    });

    return savedTag;
  }

  async update(
    id: string,
    updateDto: UpdateTagDto,
    actorId: string,
    ip: string,
    userAgent: string,
  ) {
    const tag = await this.tagModel.findById(id);
    if (!tag) throw new NotFoundException('Thẻ không tồn tại');

    // KIỂM TRA RÀNG BUỘC: ĐANG ÁP DỤNG THÌ CẤM SỬA
    const usageCount = await this.productModel.countDocuments({
      tags: tag.name,
      is_deleted: false,
    });
    if (usageCount > 0) {
      throw new BadRequestException(
        `Thẻ (Tag) '${tag.name}' đang được áp dụng cho ${usageCount} sản phẩm, KHÔNG ĐƯỢC PHÉP SỬA. Vui lòng gỡ thẻ khỏi các sản phẩm trước.`,
      );
    }

    const oldName = tag.name;
    let nameChanged = false;

    if (updateDto.name && updateDto.name !== oldName) {
      const escapedName = escapeRegExp(updateDto.name);
      const exists = await this.tagModel.findOne({
        name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
        scope: tag.scope,
        _id: { $ne: id },
      });
      if (exists)
        throw new ConflictException(`Tên thẻ '${updateDto.name}' đã tồn tại`);

      if (updateDto.update_slug) {
        tag.slug = this.createSlug(updateDto.name);
      }
      nameChanged = true;
    }

    Object.assign(tag, updateDto);
    const savedTag = await tag.save();

    await this.auditLogsService.log({
      action: 'UPDATE_TAG',
      collection_name: 'tags',
      actor_id: actorId,
      target_id: savedTag._id,
      department: Department.MARKETING,
      detail: {
        name_changed: nameChanged,
        old_name: oldName,
        new_name: savedTag.name,
      },
      ip,
      user_agent: userAgent,
    });

    return savedTag;
  }

  async remove(id: string, actorId: string, ip: string, userAgent: string) {
    const tag = await this.tagModel.findById(id);
    if (!tag) throw new NotFoundException('Thẻ không tồn tại');

    // KIỂM TRA RÀNG BUỘC: ĐANG ÁP DỤNG THÌ CẤM XÓA
    const usageCount = await this.productModel.countDocuments({
      tags: tag.name,
      is_deleted: false,
    });
    if (usageCount > 0) {
      throw new BadRequestException(
        `Thẻ (Tag) '${tag.name}' đang được áp dụng cho ${usageCount} sản phẩm, KHÔNG ĐƯỢC PHÉP XÓA. Vui lòng gỡ thẻ khỏi các sản phẩm trước.`,
      );
    }

    await this.tagModel.findByIdAndDelete(id);

    await this.auditLogsService.log({
      action: 'DELETE_TAG',
      collection_name: 'tags',
      actor_id: actorId,
      target_id: id,
      department: Department.MARKETING,
      detail: { name: tag.name },
      ip,
      user_agent: userAgent,
    });

    return { message: 'Đã xóa thẻ thành công' };
  }

  async mergeTags(
    targetTagId: string,
    sourceTagId: string,
    actorId: string,
    ip: string,
    userAgent: string,
  ) {
    if (targetTagId === sourceTagId) {
      throw new BadRequestException('Không thể gộp thẻ vào chính nó');
    }

    const [target, source] = await Promise.all([
      this.tagModel.findById(targetTagId),
      this.tagModel.findById(sourceTagId),
    ]);

    if (!target || !source)
      throw new NotFoundException('Không tìm thấy thẻ đích hoặc thẻ nguồn');
    if (target.scope !== source.scope) {
      throw new BadRequestException('Chỉ có thể gộp 2 thẻ cùng phạm vi');
    }

    const sourceUsageCount = await this.productModel.countDocuments({
      tags: source.name,
      is_deleted: false,
    });

    // Cập nhật sản phẩm
    await this.productModel.updateMany(
      { tags: source.name },
      { $addToSet: { tags: target.name } },
    );
    const result = await this.productModel.updateMany(
      { tags: source.name },
      { $pull: { tags: source.name } },
    );

    // Xóa source tag
    await this.tagModel.findByIdAndDelete(sourceTagId);

    await this.auditLogsService.log({
      action: 'MERGE_TAGS',
      collection_name: 'tags',
      actor_id: actorId,
      target_id: target._id,
      department: Department.MARKETING,
      detail: {
        source_tag: source.name,
        target_tag: target.name,
        products_updated: result.modifiedCount,
        usage_merged: sourceUsageCount,
      },
      ip,
      user_agent: userAgent,
    });

    return {
      message: `Đã gộp thẻ '${source.name}' vào '${target.name}' thành công`,
      merged_count: sourceUsageCount,
    };
  }

  private createSlug(name: string): string {
    return defaultSlugify(name, { lower: true, strict: true, locale: 'vi' });
  }

  async validateTagsExist(tagNames: string[]): Promise<boolean> {
    if (!tagNames || tagNames.length === 0) return true;
    const count = await this.tagModel.countDocuments({
      name: { $in: tagNames },
    });
    return count === tagNames.length;
  }
}
