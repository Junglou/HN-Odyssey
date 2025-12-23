import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Attribute, AttributeDocument } from './schemas/attribute.schema';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { Product, ProductDocument } from '../catalog/schemas/product.schema';

// Hàm helper escape regex
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class AttributesService {
  constructor(
    @InjectModel(Attribute.name)
    private attributeModel: Model<AttributeDocument>,
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
  ) {}

  async create(createAttributeDto: CreateAttributeDto) {
    const { name, values } = createAttributeDto;
    const escapedName = escapeRegExp(name);

    // Check trùng tên
    const exists = await this.attributeModel.findOne({
      name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
    });

    if (exists) {
      throw new ConflictException(`Nhóm thuộc tính '${name}' đã tồn tại`);
    }

    const newAttr = new this.attributeModel({
      ...createAttributeDto,
      values: values || [],
    });

    return newAttr.save();
  }

  async findAll() {
    return this.attributeModel.find().sort({ createdAt: -1 }).lean();
  }

  async findOne(id: string) {
    const attr = await this.attributeModel.findById(id).lean();
    if (!attr) throw new NotFoundException('Không tìm thấy thuộc tính');
    return attr;
  }

  async update(id: string, updateDto: UpdateAttributeDto) {
    const attr = await this.attributeModel.findById(id);
    if (!attr) throw new NotFoundException('Không tìm thấy thuộc tính');

    // Check trùng tên nếu đổi tên
    if (updateDto.name && updateDto.name !== attr.name) {
      const escapedName = escapeRegExp(updateDto.name);
      const exists = await this.attributeModel.findOne({
        name: { $regex: new RegExp(`^${escapedName}$`, 'i') },
        _id: { $ne: id },
      });
      if (exists)
        throw new ConflictException(`Tên '${updateDto.name}' đã được sử dụng`);
    }

    if (updateDto.name) attr.name = updateDto.name;
    if (updateDto.description !== undefined)
      attr.description = updateDto.description;

    if (updateDto.values) {
      attr.values = updateDto.values as any;
    }

    if (updateDto.is_active !== undefined) {
      attr.is_active = updateDto.is_active;
    }

    return attr.save();
  }

  async remove(id: string) {
    const attr = await this.attributeModel.findById(id);
    if (!attr) throw new NotFoundException('Không tìm thấy thuộc tính');

    // 1. Kiểm tra xem có sản phẩm nào đang dùng thuộc tính này không?
    // Ta check trong 'specs.name' (thông số) hoặc 'variants.attributes.k' (biến thể)
    const isUsed = await this.productModel.exists({
      $or: [
        { 'specs.name': attr.name },
        { 'variants.attributes.k': attr.name },
      ],
    });

    // 2. Nếu đang dùng -> Chặn xóa
    if (isUsed) {
      throw new BadRequestException(
        `Thuộc tính '${attr.name}' đang được sử dụng trong các sản phẩm. Không thể xóa vĩnh viễn. Vui lòng chuyển trạng thái sang 'Ẩn' (Inactive) thay vì xóa.`,
      );
    }

    // 3. Nếu không dùng -> Xóa
    return this.attributeModel.findByIdAndDelete(id);
  }
}
