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

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
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

  // Đệ quy xây dựng cây danh mục
  private buildTree(categories: any[], parentId: string | null = null): any[] {
    return categories
      .filter((cat) => String(cat.parent_id) === String(parentId))
      .map((cat) => ({
        ...cat,
        children: this.buildTree(categories, String(cat._id)),
      }));
  }

  async findBySlug(slug: string) {
    // 1. Tìm trong DB theo slug và phải đang active
    const category = await this.categoryModel
      .findOne({ slug, is_active: true })
      .lean(); // Dùng lean() để tối ưu tốc độ đọc

    // 2. Nếu không thấy -> Báo lỗi 404
    if (!category) {
      throw new NotFoundException(
        `Không tìm thấy danh mục hoặc danh mục đã bị ẩn: ${slug}`,
      );
    }

    return category;
  }

  //MAIN FEATURES

  async create(createCategoryDto: CreateCategoryDto) {
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

    // 3. Xử lý Ancestors (Breadcrumb)
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

    // 4. Sanitize Description
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

    return {
      message: 'Tạo danh mục mới thành công',
      data: savedCategory,
    };
  }

  async update(id: string, updateDto: UpdateCategoryDto) {
    const category = await this.categoryModel.findById(id);
    if (!category) throw new NotFoundException('Danh mục không tồn tại');

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

    // PROPAGATION UPDATES
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

    return {
      message: 'Cập nhật danh mục thành công',
      data: savedCategory,
    };
  }

  async remove(id: string) {
    const hasChildren = await this.categoryModel.exists({ parent_id: id });
    if (hasChildren) {
      throw new BadRequestException(
        'Không thể xóa: Danh mục này đang chứa danh mục con. Vui lòng di chuyển hoặc xóa các mục con trước.',
      );
    }

    const hasProducts = await this.productModel.exists({ category_id: id });
    if (hasProducts) {
      throw new BadRequestException(
        'Không thể xóa: Danh mục này đang chứa sản phẩm. Vui lòng di chuyển sản phẩm sang nhóm khác.',
      );
    }

    await this.categoryModel.findByIdAndDelete(id);

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

  async updateOrder(updateOrderDto: UpdateCategoryOrderDto) {
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
