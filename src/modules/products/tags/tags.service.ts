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

// Helper function: Escape ký tự đặc biệt cho Regex
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class TagsService {
  constructor(
    @InjectModel(Tag.name) private tagModel: Model<TagDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  // AC1: Lấy danh sách (Master List)
  async findAll(scope?: TagScope) {
    const filter = scope ? { scope } : {};
    // Sắp xếp theo usage_count giảm dần (Hot tags) rồi đến tên
    return this.tagModel.find(filter).sort({ usage_count: -1, name: 1 }).lean();
  }

  async findOne(id: string) {
    const tag = await this.tagModel.findById(id);
    if (!tag) throw new NotFoundException('Thẻ không tồn tại');
    return tag;
  }

  // AC2: Tạo mới & Kiểm tra trùng lặp
  async create(createTagDto: CreateTagDto) {
    // 1. Check trùng tên (Dùng Regex an toàn)
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

    // 2. Tạo Slug và check trùng Slug
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

    // 3. Lưu
    const newTag = new this.tagModel({
      ...createTagDto,
      slug,
    });

    return newTag.save();
  }

  // AC4: Cập nhật & Đồng bộ
  async update(id: string, updateDto: UpdateTagDto) {
    const tag = await this.tagModel.findById(id);
    if (!tag) throw new NotFoundException('Thẻ không tồn tại');

    const oldName = tag.name;
    let nameChanged = false;

    // 1. Check trùng tên nếu có đổi tên
    if (updateDto.name && updateDto.name !== oldName) {
      const escapedName = escapeRegExp(updateDto.name);
      const exists = await this.tagModel.findOne({
        name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
        scope: tag.scope,
        _id: { $ne: id },
      });
      if (exists)
        throw new ConflictException(`Tên thẻ '${updateDto.name}' đã tồn tại`);

      // Update Slug nếu được yêu cầu
      if (updateDto.update_slug) {
        tag.slug = this.createSlug(updateDto.name);
      }
      nameChanged = true;
    }

    // 2. Lưu thay đổi vào bảng Tag
    Object.assign(tag, updateDto);
    const savedTag = await tag.save();

    // 3. [AC4 - REALTIME SYNC] ĐỒNG BỘ SANG SẢN PHẨM
    // Nếu tên thay đổi, tìm tất cả sản phẩm đang chứa tên cũ và đổi thành tên mới
    if (nameChanged) {
      await this.productModel.updateMany(
        { tags: oldName }, // Tìm những SP có chứa tag cũ
        { $set: { 'tags.$': savedTag.name } }, // Dấu $ đại diện cho phần tử tìm thấy trong mảng
      );

      console.log(
        `[SYNC] Đã cập nhật thẻ từ '${oldName}' sang '${savedTag.name}' cho toàn bộ sản phẩm.`,
      );
    }

    return savedTag;
  }

  // AC5: Xóa an toàn
  async remove(id: string) {
    const tag = await this.tagModel.findById(id);
    if (!tag) throw new NotFoundException('Thẻ không tồn tại');

    if (tag.usage_count > 0) {
      throw new BadRequestException(
        `Không thể xóa: Thẻ đang gắn cho ${tag.usage_count} đối tượng. Hãy dùng chức năng 'Gộp thẻ'.`,
      );
    }

    return this.tagModel.findByIdAndDelete(id);
  }

  // AC6: Gộp Thẻ (Merge Tags) - Mới bổ sung
  async mergeTags(targetTagId: string, sourceTagId: string) {
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

    // 1. Cộng dồn số lượng sử dụng (Tracking)
    target.usage_count += source.usage_count;
    await target.save();

    // 2. [AC6 - GLOBAL REPLACE] CHUYỂN SẢN PHẨM SANG THẺ MỚI
    // Bước A: Thêm thẻ đích vào các SP đang có thẻ nguồn (dùng $addToSet để không trùng)
    await this.productModel.updateMany(
      { tags: source.name },
      { $addToSet: { tags: target.name } },
    );

    // Bước B: Xóa thẻ nguồn khỏi các SP đó (dùng $pull)
    await this.productModel.updateMany(
      { tags: source.name },
      { $pull: { tags: source.name } },
    );

    console.log(
      `[SYNC] Đã gộp sản phẩm từ thẻ '${source.name}' sang '${target.name}'`,
    );

    // 3. Xóa thẻ nguồn vĩnh viễn
    await this.tagModel.findByIdAndDelete(sourceTagId);

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

    // Đếm số lượng tag tìm thấy trong DB khớp với danh sách gửi lên
    const count = await this.tagModel.countDocuments({
      name: { $in: tagNames },
    });

    // Nếu số lượng tìm thấy == số lượng gửi lên -> Hợp lệ
    return count === tagNames.length;
  }
}
