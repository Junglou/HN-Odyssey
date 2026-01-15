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
import { AttributeType } from 'src/common/enums/attribute-type.enum';
import { isEqual } from 'lodash';
import { SearchService } from 'src/modules/search/search.service';

@Injectable()
export class AttributesService {
  constructor(
    @InjectModel(Attribute.name)
    private attributeModel: Model<AttributeDocument>,
    @InjectModel(Product.name)
    private productModel: Model<ProductDocument>,
    private readonly auditLogsService: AuditLogsService,
    private readonly searchService: SearchService,
  ) {}

  //Validate mã màu Hex (Chuyển vào trong class)
  private isValidHex(hex: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
  }

  //Trigger Re-index (Mock cho AC12)
  private async triggerReindexSystem() {
    console.log('>> [SYSTEM] Triggering ElasticSearch/Algolia Re-indexing...');
    await this.searchService.reindexAttributes();
  }

  // 1. TẠO MỚI (AC1, AC2, AC4, AC6, AC11, AC12)
  async create(
    createDto: CreateAttributeDto,
    actorId: string,
    ip: string,
    userAgent: string,
  ) {
    const { code, display_type, values } = createDto;

    //AC6: Trùng mã Code
    const existsCode = await this.attributeModel.findOne({ code });
    if (existsCode) {
      throw new ConflictException(`Mã thuộc tính '${code}' đã tồn tại.`);
    }

    //AC4: Logic cho Màu sắc (Bắt buộc có mã Hex hợp lệ)
    if (display_type === AttributeType.COLOR_SWATCH) {
      if (!values || values.length === 0) {
        throw new BadRequestException(
          'Loại màu sắc bắt buộc phải có danh sách giá trị.',
        );
      }
      // Loop check từng giá trị
      for (const val of values) {
        // SỬA: Gọi this.isValidHex
        if (!val.meta || !this.isValidHex(val.meta)) {
          throw new BadRequestException(
            `Giá trị '${val.label}' thiếu mã màu Hex hợp lệ (VD: #FF0000).`,
          );
        }
      }
    }

    //AC11: Logic cho Range Slider (Min < Max)
    if (display_type === AttributeType.RANGE_SLIDER) {
      if (!values || values.length < 2) {
        throw new BadRequestException(
          'Range Slider cần ít nhất 2 giá trị: Min và Max.',
        );
      }
      const min = parseFloat(values[0].value);
      const max = parseFloat(values[1].value);

      if (isNaN(min) || isNaN(max)) {
        throw new BadRequestException('Giá trị Min/Max của Slider phải là số.');
      }

      if (min >= max) {
        throw new BadRequestException('Giá trị Min phải nhỏ hơn Max.');
      }
    }

    //AC11: Trùng lặp giá trị con
    if (values && values.length > 0) {
      const distinctValues = new Set(values.map((v) => v.value));
      if (distinctValues.size !== values.length) {
        throw new BadRequestException(
          'Các giá trị con (Option Values) không được trùng lặp.',
        );
      }
    }

    const newAttr = new this.attributeModel(createDto);
    const savedAttr = await newAttr.save();

    //AC12: Re-index nếu thuộc tính này cho phép lọc
    if (savedAttr.is_filterable) {
      await this.triggerReindexSystem();
    }

    // Ghi Log
    await this.auditLogsService.log({
      action: 'CREATE_ATTRIBUTE',
      collection_name: 'attributes',
      actor_id: actorId,
      target_id: savedAttr._id,
      department: Department.WAREHOUSE,
      detail: { name: savedAttr.name, code: savedAttr.code },
      ip,
      user_agent: userAgent,
    });

    return savedAttr;
  }

  // 2. DANH SÁCH
  async findAll() {
    return this.attributeModel
      .find()
      .sort({ sort_order: 1, createdAt: -1 })
      .lean();
  }

  // 3. CHI TIẾT
  async findOne(id: string) {
    const attr = await this.attributeModel.findById(id).lean();
    if (!attr) throw new NotFoundException('Không tìm thấy thuộc tính');
    return attr;
  }

  // 4. CẬP NHẬT
  async update(
    id: string,
    updateDto: UpdateAttributeDto,
    actorId: string,
    ip: string,
    userAgent: string,
  ) {
    const attr = await this.attributeModel.findById(id);
    if (!attr) throw new NotFoundException('Không tìm thấy thuộc tính');
    const oldData = attr.toObject();

    // Check trùng Code
    if (updateDto.code && updateDto.code !== attr.code) {
      // 1. Kiểm tra xem code cũ đã được dùng chưa
      const isUsed = await this.productModel.exists({
        'attributes.code': attr.code,
      });

      if (isUsed) {
        throw new BadRequestException(
          `Không thể đổi mã Code '${attr.code}' vì đã được gán cho sản phẩm. Hãy tạo thuộc tính mới hoặc chỉ đổi Tên hiển thị.`,
        );
      }

      // 2. Nếu chưa dùng thì mới check trùng code mới
      const exists = await this.attributeModel.findOne({
        code: updateDto.code,
      });
      if (exists) throw new ConflictException('Mã code mới đã tồn tại');
    }

    // Validate Hex nếu update values của Color (Optional nhưng nên có)
    if (attr.display_type === AttributeType.COLOR_SWATCH && updateDto.values) {
      for (const val of updateDto.values) {
        // Check nếu val là object đầy đủ (do DTO Partial)
        if (val['meta'] && !this.isValidHex(val['meta'])) {
          throw new BadRequestException(
            `Giá trị '${val['label']}' mã màu không hợp lệ.`,
          );
        }
      }
    }

    Object.assign(attr, updateDto);
    const updatedAttr = await attr.save();

    const newData = updatedAttr.toObject();

    // Re-index Check
    const isConfigChanged =
      oldData.is_filterable !== newData.is_filterable ||
      oldData.is_active !== newData.is_active ||
      !isEqual(oldData.values, newData.values);

    if (isConfigChanged) {
      await this.triggerReindexSystem();
    }

    // Log
    await this.auditLogsService.log({
      action: 'UPDATE_ATTRIBUTE',
      collection_name: 'attributes',
      actor_id: actorId,
      target_id: attr._id,
      department: Department.WAREHOUSE,
      detail: {
        attribute_code: attr.code,
        changes: updateDto,
      },
      ip,
      user_agent: userAgent,
    });

    return updatedAttr;
  }

  // 5. XÓA (AC9 & AC13)
  async remove(id: string, actorId: string, ip: string, userAgent: string) {
    const attr = await this.attributeModel.findById(id);
    if (!attr) throw new NotFoundException('Không tìm thấy thuộc tính');

    //AC9: Kiểm tra Usage
    const isUsed = await this.productModel.exists({
      'attributes.code': attr.code,
    });

    if (isUsed) {
      await this.auditLogsService.log({
        action: 'DELETE_ATTRIBUTE_FAILED',
        collection_name: 'attributes',
        actor_id: actorId,
        target_id: id,
        department: Department.WAREHOUSE,
        detail: { reason: 'In use by products', code: attr.code },
        is_success: false,
        ip,
        user_agent: userAgent,
      });

      throw new BadRequestException(
        `Thuộc tính '${attr.name}' (${attr.code}) đang được dùng cho sản phẩm. Vui lòng chọn 'Vô hiệu hóa' (Inactive) thay vì xóa.`,
      );
    }

    await this.attributeModel.findByIdAndDelete(id);

    // AC12: Re-index sau khi xóa
    await this.triggerReindexSystem();

    await this.auditLogsService.log({
      action: 'DELETE_ATTRIBUTE',
      collection_name: 'attributes',
      actor_id: actorId,
      target_id: id,
      department: Department.WAREHOUSE,
      detail: { code: attr.code, name: attr.name },
      ip,
      user_agent: userAgent,
    });

    return { message: 'Đã xóa thuộc tính thành công' };
  }
}
