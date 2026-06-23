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

  private isValidHex(hex: string): boolean {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
  }

  private async triggerReindexSystem() {
    console.log('>> [SYSTEM] Triggering ElasticSearch/Algolia Re-indexing...');
    await this.searchService.reindexAttributes();
  }

  async create(
    createDto: CreateAttributeDto,
    actorId: string,
    ip: string,
    userAgent: string,
  ) {
    const { code, display_type, values } = createDto;

    const existsCode = await this.attributeModel.findOne({ code });
    if (existsCode) {
      throw new ConflictException(`Mã thuộc tính '${code}' đã tồn tại.`);
    }

    const existsName = await this.attributeModel.findOne({
      name: createDto.name,
    });
    if (existsName) {
      throw new ConflictException(
        `Tên thuộc tính '${createDto.name}' đã tồn tại.`,
      );
    }

    if (display_type === AttributeType.COLOR_SWATCH) {
      if (!values || values.length === 0) {
        throw new BadRequestException(
          'Loại màu sắc bắt buộc phải có danh sách giá trị.',
        );
      }
      for (const val of values) {
        if (!val.meta || !this.isValidHex(val.meta)) {
          throw new BadRequestException(
            `Giá trị '${val.label}' thiếu mã màu Hex hợp lệ (VD: #FF0000).`,
          );
        }
      }
    }

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

    if (savedAttr.is_filterable) {
      await this.triggerReindexSystem();
    }

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

  async findAll() {
    return this.attributeModel
      .find()
      .sort({ sort_order: 1, createdAt: -1 })
      .lean();
  }

  async findOne(id: string) {
    const attr = await this.attributeModel.findById(id).lean();
    if (!attr) throw new NotFoundException('Không tìm thấy thuộc tính');
    return attr;
  }

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

    // KIỂM TRA RÀNG BUỘC: ĐANG ÁP DỤNG THÌ CẤM SỬA HOÀN TOÀN
    const isUsed = await this.productModel.exists({
      'attributes.code': attr.code,
      is_deleted: false,
    });

    if (isUsed) {
      throw new BadRequestException(
        `Thuộc tính (Biến thể) '${attr.name}' đang được áp dụng cho sản phẩm, KHÔNG ĐƯỢC PHÉP SỬA. Vui lòng vào trang quản lý sản phẩm tắt/xóa biến thể này trước.`,
      );
    }

    if (updateDto.code && updateDto.code !== attr.code) {
      if (updateDto.name && updateDto.name !== attr.name) {
        const existsName = await this.attributeModel.findOne({
          name: updateDto.name,
          _id: { $ne: id },
        });
        if (existsName) {
          throw new ConflictException('Tên thuộc tính mới đã tồn tại');
        }
      }

      const exists = await this.attributeModel.findOne({
        code: updateDto.code,
      });
      if (exists) throw new ConflictException('Mã code mới đã tồn tại');
    }

    if (attr.display_type === AttributeType.COLOR_SWATCH && updateDto.values) {
      for (const val of updateDto.values) {
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

    const isConfigChanged =
      oldData.is_filterable !== newData.is_filterable ||
      oldData.is_active !== newData.is_active ||
      !isEqual(oldData.values, newData.values);

    if (isConfigChanged) {
      await this.triggerReindexSystem();
    }

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

  async remove(id: string, actorId: string, ip: string, userAgent: string) {
    const attr = await this.attributeModel.findById(id);
    if (!attr) throw new NotFoundException('Không tìm thấy thuộc tính');

    // KIỂM TRA RÀNG BUỘC: ĐANG ÁP DỤNG THÌ CẤM XÓA HOÀN TOÀN
    const isUsed = await this.productModel.exists({
      'attributes.code': attr.code,
      is_deleted: false,
    });

    if (isUsed) {
      throw new BadRequestException(
        `Thuộc tính (Biến thể) '${attr.name}' đang được áp dụng cho sản phẩm, KHÔNG ĐƯỢC PHÉP XÓA. Vui lòng vào trang quản lý sản phẩm tắt/xóa biến thể này trước.`,
      );
    }

    await this.attributeModel.findByIdAndDelete(id);
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
