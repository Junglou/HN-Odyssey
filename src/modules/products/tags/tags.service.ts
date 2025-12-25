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

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class TagsService {
  constructor(
    @InjectModel(Tag.name) private tagModel: Model<TagDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly auditLogsService: AuditLogsService, 
  ) {}

  // AC1: Lấy danh sách
  async findAll(scope?: TagScope) {
    const filter = scope ? { scope } : {};
    return this.tagModel.find(filter).sort({ usage_count: -1, name: 1 }).lean();
  }

  async findOne(id: string) {
    const tag = await this.tagModel.findById(id);
    if (!tag) throw new NotFoundException('Thẻ không tồn tại');
    return tag;
  }

  // AC2: Tạo mới 
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

    // [LOG]
    await this.auditLogsService.log({
      action: 'CREATE_TAG',
      collection_name: 'tags',
      actor_id: actorId,
      target_id: savedTag._id,
      detail: { name: savedTag.name, scope: savedTag.scope },
      ip,
      user_agent: userAgent,
    });

    return savedTag;
  }

  // AC4: Cập nhật & Đồng bộ
  async update(
    id: string,
    updateDto: UpdateTagDto,
    actorId: string,
    ip: string,
    userAgent: string,
  ) {
    const tag = await this.tagModel.findById(id);
    if (!tag) throw new NotFoundException('Thẻ không tồn tại');

    const oldName = tag.name;
    const oldData = tag.toObject();
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

    let affectedProducts = 0;

    // 3. REALTIME SYNC
    if (nameChanged) {
      const result = await this.productModel.updateMany(
        { tags: oldName },
        { $set: { 'tags.$': savedTag.name } },
      );
      affectedProducts = result.modifiedCount;
    }

    // [LOG]
    await this.auditLogsService.log({
      action: 'UPDATE_TAG',
      collection_name: 'tags',
      actor_id: actorId,
      target_id: savedTag._id,
      detail: {
        name_changed: nameChanged,
        old_name: oldName,
        new_name: savedTag.name,
        synced_products: affectedProducts,
      },
      ip,
      user_agent: userAgent,
    });

    return savedTag;
  }

  // AC5: Xóa an toàn
  async remove(id: string, actorId: string, ip: string, userAgent: string) {
    const tag = await this.tagModel.findById(id);
    if (!tag) throw new NotFoundException('Thẻ không tồn tại');

    if (tag.usage_count > 0) {
      await this.auditLogsService.log({
        action: 'DELETE_TAG_FAILED',
        collection_name: 'tags',
        actor_id: actorId,
        target_id: id,
        detail: { reason: 'Tag is in use', usage_count: tag.usage_count },
        is_success: false,
        ip,
        user_agent: userAgent,
      });

      throw new BadRequestException(
        `Không thể xóa: Thẻ đang gắn cho ${tag.usage_count} đối tượng. Hãy dùng chức năng 'Gộp thẻ'.`,
      );
    }

    await this.tagModel.findByIdAndDelete(id);

    // [LOG]
    await this.auditLogsService.log({
      action: 'DELETE_TAG',
      collection_name: 'tags',
      actor_id: actorId,
      target_id: id,
      detail: { name: tag.name },
      ip,
      user_agent: userAgent,
    });

    return { message: 'Đã xóa thẻ thành công' };
  }

  // AC6: Gộp Thẻ 
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

    // 1. Cộng dồn usage
    const oldTargetUsage = target.usage_count;
    target.usage_count += source.usage_count;
    await target.save();

    // 2. Chuyển SP
    // A. Thêm target
    await this.productModel.updateMany(
      { tags: source.name },
      { $addToSet: { tags: target.name } },
    );
    // B. Xóa source
    const result = await this.productModel.updateMany(
      { tags: source.name },
      { $pull: { tags: source.name } },
    );

    // 3. Xóa source tag
    await this.tagModel.findByIdAndDelete(sourceTagId);

    //Quan trọng
    await this.auditLogsService.log({
      action: 'MERGE_TAGS',
      collection_name: 'tags',
      actor_id: actorId,
      target_id: target._id,
      detail: {
        source_tag: source.name,
        target_tag: target.name,
        products_updated: result.modifiedCount, 
        usage_merged: source.usage_count,
      },
      ip,
      user_agent: userAgent,
    });

    return {
      message: `Đã gộp thẻ '${source.name}' vào '${target.name}' thành công`,
      merged_count: source.usage_count,
    };
  }

  // Private Helper
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
