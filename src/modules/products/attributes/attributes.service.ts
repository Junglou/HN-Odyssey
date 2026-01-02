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
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';

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
    private readonly auditLogsService: AuditLogsService, // [THÊM] Inject
  ) {}

  // 1. TẠO THUỘC TÍNH
  async create(
    createAttributeDto: CreateAttributeDto,
    actorId: string,
    ip: string,
    userAgent: string,
  ) {
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

    const savedAttr = await newAttr.save();

    // [THÊM] Ghi Log
    await this.auditLogsService.log({
      action: 'CREATE_ATTRIBUTE',
      collection_name: 'attributes',
      actor_id: actorId,
      target_id: savedAttr._id,
      department: Department.SALE_MARKETING,
      detail: {
        name: savedAttr.name,
        values: savedAttr.values,
        description: savedAttr.description,
      },
      ip,
      user_agent: userAgent,
    });

    return savedAttr;
  }

  async findAll() {
    return this.attributeModel.find().sort({ createdAt: -1 }).lean();
  }

  async findOne(id: string) {
    const attr = await this.attributeModel.findById(id).lean();
    if (!attr) throw new NotFoundException('Không tìm thấy thuộc tính');
    return attr;
  }

  // 2. CẬP NHẬT
  async update(
    id: string,
    updateDto: UpdateAttributeDto,
    actorId: string,
    ip: string,
    userAgent: string,
  ) {
    const attr = await this.attributeModel.findById(id);
    if (!attr) throw new NotFoundException('Không tìm thấy thuộc tính');

    // Lưu data cũ để so sánh
    const oldData = attr.toObject();

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

    const updatedAttr = await attr.save();

    // [THÊM] Ghi Log (Kèm Data Diff)
    await this.auditLogsService.log({
      action: 'UPDATE_ATTRIBUTE',
      collection_name: 'attributes',
      actor_id: actorId,
      target_id: attr._id,
      department: Department.SALE_MARKETING,
      detail: {
        attribute_name: attr.name,
        changes: {
          old_values: oldData.values,
          new_values: updatedAttr.values,
          old_name:
            oldData.name !== updatedAttr.name ? oldData.name : undefined,
        },
      },
      ip,
      user_agent: userAgent,
    });

    return updatedAttr;
  }

  // 3. XÓA
  async remove(id: string, actorId: string, ip: string, userAgent: string) {
    const attr = await this.attributeModel.findById(id);
    if (!attr) throw new NotFoundException('Không tìm thấy thuộc tính');

    // 1. Kiểm tra xem có sản phẩm nào đang dùng thuộc tính này không?
    const isUsed = await this.productModel.exists({
      $or: [
        { 'specs.name': attr.name },
        { 'variants.attributes.k': attr.name },
      ],
    });

    // 2. Nếu đang dùng -> Chặn xóa
    if (isUsed) {
      // [THÊM] Có thể log cảnh báo việc admin cố xóa (Optional)
      await this.auditLogsService.log({
        action: 'DELETE_ATTRIBUTE_FAILED',
        collection_name: 'attributes',
        actor_id: actorId,
        target_id: id,
        department: Department.SALE_MARKETING,
        detail: { reason: 'Attribute is in use by products', name: attr.name },
        is_success: false,
        ip,
        user_agent: userAgent,
      });

      throw new BadRequestException(
        `Thuộc tính '${attr.name}' đang được sử dụng trong các sản phẩm. Không thể xóa vĩnh viễn. Vui lòng chuyển trạng thái sang 'Ẩn' (Inactive) thay vì xóa.`,
      );
    }

    // 3. Nếu không dùng -> Xóa
    await this.attributeModel.findByIdAndDelete(id);

    // [THÊM] Ghi Log Xóa thành công
    await this.auditLogsService.log({
      action: 'DELETE_ATTRIBUTE',
      collection_name: 'attributes',
      actor_id: actorId,
      target_id: id,
      department: Department.SALE_MARKETING,
      detail: {
        name: attr.name,
        values: attr.values,
      },
      ip,
      user_agent: userAgent,
    });

    return { message: 'Đã xóa thuộc tính thành công' };
  }
}
