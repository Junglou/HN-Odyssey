import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AnyBulkWriteOperation } from 'mongodb';
import {
  Category,
  CategoryDocument,
  Ancestor,
} from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateCategoryOrderDto } from './dto/update-category-order.dto';
import defaultSlugify from 'slugify';
import sanitizeHtml from 'sanitize-html';
import { Product, ProductDocument } from '../catalog/schemas/product.schema';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  //HELPER METHODS
  private createSlug(name: string): string {
    return defaultSlugify(name, { lower: true, strict: true, locale: 'vi' });
  }

  private sanitizeContent(html: string): string {
    if (!html) return '';
    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        '*': ['style', 'class'],
      },
    });
  }

  private buildTree(categories: any[], parentId: string | null = null): any[] {
    return categories
      .filter((cat) => String(cat.parent_id) === String(parentId))
      .map((cat) => ({
        ...cat,
        children: this.buildTree(categories, String(cat._id)),
      }));
  }

  async findBySlug(slug: string) {
    const category = await this.categoryModel
      .findOne({ slug, is_active: true })
      .lean();

    if (!category) {
      throw new NotFoundException(
        `Không tìm thấy danh mục hoặc danh mục đã bị ẩn: ${slug}`,
      );
    }
    return category;
  }

  //MAIN FEATURES

  // 1. TẠO MỚI
  async create(
    createCategoryDto: CreateCategoryDto,
    actorId: string,
    ip: string,
    userAgent: string,
  ) {
    // 1. Validate Tên
    const existingName = await this.categoryModel.findOne({
      name: createCategoryDto.name,
    });
    if (existingName) throw new ConflictException('Tên danh mục đã tồn tại');

    // 2. Xử lý Slug
    let slug = createCategoryDto.slug;
    if (!slug) {
      slug = this.createSlug(createCategoryDto.name);
    }
    const existingSlug = await this.categoryModel.findOne({ slug });
    if (existingSlug)
      throw new ConflictException('Đường dẫn (Slug) đã tồn tại');

    // 3. Xử lý Ancestors
    let ancestors: Ancestor[] = [];
    if (createCategoryDto.parent_id) {
      const parent = await this.categoryModel.findById(
        createCategoryDto.parent_id,
      );
      if (!parent) throw new NotFoundException('Danh mục cha không tồn tại');

      ancestors = [
        ...parent.ancestors,
        {
          _id: parent._id.toString(),
          name: parent.name,
          slug: parent.slug,
        },
      ];
    }

    // 4. Sanitize
    const cleanDescription = this.sanitizeContent(
      createCategoryDto.description || '',
    );

    const newCategory = new this.categoryModel({
      ...createCategoryDto,
      slug,
      description: cleanDescription,
      ancestors,
    });

    const savedCategory = await newCategory.save();

    //Ghi Log
    await this.auditLogsService.log({
      action: 'CREATE_CATEGORY',
      collection_name: 'categories',
      actor_id: actorId,
      target_id: savedCategory._id,
      department: Department.SALE_MARKETING,
      detail: {
        name: savedCategory.name,
        slug: savedCategory.slug,
        parent_id: savedCategory.parent_id,
      },
      ip,
      user_agent: userAgent,
    });

    return {
      message: 'Tạo danh mục mới thành công',
      data: savedCategory,
    };
  }

  // 2. CẬP NHẬT
  async update(
    id: string,
    updateDto: UpdateCategoryDto,
    actorId: string,
    ip: string,
    userAgent: string,
  ) {
    const category = await this.categoryModel.findById(id);
    if (!category) throw new NotFoundException('Danh mục không tồn tại');

    const oldData = category.toObject();

    //XỬ LÝ ĐỔI TÊN & SLUG
    let nameChanged = false;
    if (updateDto.name && updateDto.name !== category.name) {
      const exists = await this.categoryModel.findOne({
        name: updateDto.name,
        _id: { $ne: id },
      });
      if (exists) throw new ConflictException('Tên danh mục mới bị trùng');
      nameChanged = true;
    }

    if (updateDto.update_slug_from_name && updateDto.name) {
      updateDto.slug = this.createSlug(updateDto.name);
      const slugExists = await this.categoryModel.findOne({
        slug: updateDto.slug,
        _id: { $ne: id },
      });
      if (slugExists) throw new ConflictException('Slug mới bị trùng');
    } else {
      if (!updateDto.slug) delete updateDto.slug;
    }

    //XỬ LÝ DI CHUYỂN CHA (MOVE CATEGORY)
    let parentChanged = false;
    let newAncestors: Ancestor[] = [];

    if (
      updateDto.parent_id !== undefined &&
      String(updateDto.parent_id) !== String(category.parent_id)
    ) {
      if (updateDto.parent_id === id) {
        throw new BadRequestException(
          'Không thể chọn chính mình làm danh mục cha',
        );
      }

      if (updateDto.parent_id === null) {
        newAncestors = [];
        category.parent_id = null as any;
      } else {
        const newParent = await this.categoryModel.findById(
          updateDto.parent_id,
        );
        if (!newParent)
          throw new NotFoundException('Danh mục cha mới không tồn tại');

        const isLoop = newParent.ancestors.some(
          (anc) => String(anc._id) === id,
        );
        if (isLoop) {
          throw new BadRequestException(
            'Không thể di chuyển vào danh mục con của chính nó (Lỗi vòng lặp)',
          );
        }

        newAncestors = [
          ...newParent.ancestors,
          {
            _id: newParent._id.toString(),
            name: newParent.name,
            slug: newParent.slug,
          },
        ];
        category.parent_id = newParent._id;
      }

      category.ancestors = newAncestors;
      parentChanged = true;
    }

    //SANITIZE DESCRIPTION
    if (updateDto.description) {
      updateDto.description = this.sanitizeContent(updateDto.description);
    }

    //XỬ LÝ ẨN/HIỆN
    if (updateDto.is_active === false) {
      await this.categoryModel.updateMany(
        { 'ancestors._id': id },
        { is_active: false },
      );
    }

    //SAVE CURRENT CATEGORY
    Object.assign(category, updateDto);
    const savedCategory = await category.save();

    // PROPAGATION UPDATES (Cập nhật dây chuyền)
    if (nameChanged || updateDto.slug) {
      await this.categoryModel.updateMany(
        { 'ancestors._id': id },
        {
          $set: {
            'ancestors.$.name': savedCategory.name,
            'ancestors.$.slug': savedCategory.slug,
          },
        },
      );
    }

    if (parentChanged) {
      const descendants = await this.categoryModel.find({
        'ancestors._id': id,
      });

      if (descendants.length > 0) {
        const bulkOps = descendants.map((child) => {
          const index = child.ancestors.findIndex((a) => String(a._id) === id);
          if (index === -1) return {};

          const childNewAncestors = [
            ...newAncestors,
            {
              _id: savedCategory._id.toString(),
              name: savedCategory.name,
              slug: savedCategory.slug,
            },
            ...child.ancestors.slice(index + 1),
          ];

          return {
            updateOne: {
              filter: { _id: child._id },
              update: { $set: { ancestors: childNewAncestors } },
            },
          };
        });

        const validOps = bulkOps.filter((op) => op.updateOne);
        if (validOps.length > 0) {
          await this.categoryModel.bulkWrite(
            validOps as AnyBulkWriteOperation<CategoryDocument>[],
          );
        }
      }
    }

    //Ghi Log
    await this.auditLogsService.log({
      action: 'UPDATE_CATEGORY',
      collection_name: 'categories',
      actor_id: actorId,
      target_id: category._id,
      department: Department.SALE_MARKETING,
      detail: {
        name: category.name,
        changes: {
          old_name: oldData.name !== category.name ? oldData.name : undefined,
          old_parent:
            oldData.parent_id !== category.parent_id
              ? oldData.parent_id
              : undefined,
          new_parent: updateDto.parent_id,
        },
      },
      ip,
      user_agent: userAgent,
    });

    return {
      message: 'Cập nhật danh mục thành công',
      data: savedCategory,
    };
  }

  // 3. XÓA
  async remove(id: string, actorId: string, ip: string, userAgent: string) {
    const hasChildren = await this.categoryModel.exists({ parent_id: id });
    if (hasChildren) {
      throw new BadRequestException(
        'Không thể xóa: Danh mục này đang chứa danh mục con.',
      );
    }

    const hasProducts = await this.productModel.exists({ category_id: id });
    if (hasProducts) {
      throw new BadRequestException(
        'Không thể xóa: Danh mục này đang chứa sản phẩm.',
      );
    }

    const category = await this.categoryModel.findByIdAndDelete(id);

    //Ghi Log
    await this.auditLogsService.log({
      action: 'DELETE_CATEGORY',
      collection_name: 'categories',
      actor_id: actorId,
      target_id: id,
      department: Department.SALE_MARKETING,
      detail: {
        name: category ? category.name : 'Unknown',
        slug: category ? category.slug : 'Unknown',
      },
      ip,
      user_agent: userAgent,
    });

    return {
      message: 'Xóa danh mục thành công',
    };
  }

  async getTree(includeHidden = false): Promise<any[]> {
    const filter: any = {};
    if (!includeHidden) filter.is_active = true;

    const categories = await this.categoryModel
      .find(filter)
      .sort({ display_order: 1, created_at: 1 })
      .lean();

    return this.buildTree(categories, null);
  }

  // 4. CẬP NHẬT THỨ TỰ
  async updateOrder(
    updateOrderDto: UpdateCategoryOrderDto,
    actorId: string,
    ip: string,
    userAgent: string,
  ) {
    const operations = updateOrderDto.items.map((item) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(item.id) },
        update: { $set: { display_order: item.order } },
      },
    }));

    if (operations.length > 0) {
      await this.categoryModel.bulkWrite(
        operations as AnyBulkWriteOperation<CategoryDocument>[],
      );

      // Ghi Log (Log tổng quát)
      await this.auditLogsService.log({
        action: 'REORDER_CATEGORIES',
        collection_name: 'categories',
        actor_id: actorId,
        target_id: null,
        department: Department.SALE_MARKETING,
        detail: { count: operations.length },
        ip,
        user_agent: userAgent,
      });
    }

    return {
      message: 'Cập nhật thứ tự hiển thị thành công',
    };
  }

  async search(keyword: string): Promise<any[]> {
    const categories = await this.categoryModel
      .find({
        name: { $regex: keyword, $options: 'i' },
      })
      .select('name slug ancestors is_active')
      .limit(20)
      .lean();

    return categories.map((cat) => {
      const pathNames = [...cat.ancestors.map((a) => a.name), cat.name];
      return {
        _id: cat._id,
        name: cat.name,
        slug: cat.slug,
        is_active: cat.is_active,
        breadcrumb: pathNames.join(' > '),
      };
    });
  }
}
