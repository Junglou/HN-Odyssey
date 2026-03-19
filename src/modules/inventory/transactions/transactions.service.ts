import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, Types, UpdateQuery } from 'mongoose';
import {
  StockTransaction,
  StockTransactionDocument,
} from './schemas/stock-transaction.schema';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import { CreateImportNoteDto } from './dto/create-import-note.dto';
import { GetTransactionsDto } from './dto/get-transactions.dto';
import { StockGateway } from '../stock/stock.gateway';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';
import { Resource } from 'src/common/enums/resource.enum';
import { Department } from 'src/common/enums/department.enum';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { User, UserDocument } from 'src/modules/users/schemas/user.schema';

// --- INTERFACES CHUẨN ---
export interface UpdatedProductInfo {
  productId: string;
  sku: string;
  newStock: number;
}

export interface PreviewItem {
  row: number;
  sku: string;
  quantity: number;
  note: string;
  status: 'VALID' | 'INVALID';
  errors: string[];
  product_id?: string;
}

export interface PopulatedActor {
  _id: Types.ObjectId;
  first_Name?: string;
  last_Name?: string;
  full_name?: string;
  email: string;
}

interface PopulatedProduct {
  _id: Types.ObjectId;
  name: string;
  thumbnail: string;
  sku: string;
  has_variants: boolean;
  variants: Array<{ sku: string; stock: number }>;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(StockTransaction.name)
    private transactionModel: Model<StockTransactionDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly stockGateway: StockGateway,
    private readonly auditLogsService: AuditLogsService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * FIX TRIỆT ĐỂ: @typescript-eslint/no-base-to-string (Dòng 93)
   */
  private extractString(value: unknown): string {
    if (value === null || value === undefined) return '';

    // Kiểm tra các kiểu dữ liệu nguyên thủy trước khi ép kiểu
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean')
      return String(value);

    if (typeof value === 'object') {
      const cellObj = value as {
        richText?: { text: string }[];
        text?: string;
        result?: string | number;
      };

      if (cellObj.richText && Array.isArray(cellObj.richText)) {
        return cellObj.richText.map((rt) => rt.text || '').join('');
      }
      if (cellObj.result !== undefined && cellObj.result !== null) {
        return String(cellObj.result);
      }
      if (cellObj.text) {
        return String(cellObj.text);
      }
    }

    return '';
  }

  private generateTransactionCode(): string {
    const date = new Date();
    const dateString = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomString = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();
    return `IMP-${dateString}-${randomString}`;
  }

  async createImportNote(
    dto: CreateImportNoteDto,
    actorId: string,
    ip?: string,
    userAgent?: string,
  ) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      let totalQuantity = 0;
      const updatedProducts: UpdatedProductInfo[] = [];

      for (const item of dto.items) {
        const product = await this.productModel
          .findById(item.product_id)
          .session(session);
        if (!product)
          throw new BadRequestException(
            `Sản phẩm ID ${item.product_id} không tồn tại.`,
          );

        const filter: FilterQuery<ProductDocument> = {
          _id: new Types.ObjectId(item.product_id),
        };
        const updateQuery: UpdateQuery<ProductDocument> = {};
        let currentStock = 0;

        if (product.has_variants) {
          const variant = product.variants.find((v) => v.sku === item.sku);
          if (!variant)
            throw new BadRequestException(
              `SKU ${item.sku} không thuộc sản phẩm ${product.name}.`,
            );
          filter['variants.sku'] = item.sku;
          updateQuery.$inc = {
            'variants.$.stock': item.quantity,
            stock: item.quantity,
          };
          currentStock = (variant.stock || 0) + item.quantity;
        } else {
          if (product.sku !== item.sku)
            throw new BadRequestException(`SKU ${item.sku} không khớp.`);
          updateQuery.$inc = { stock: item.quantity };
          currentStock = (product.stock || 0) + item.quantity;
        }

        const updatedProduct = await this.productModel.findOneAndUpdate(
          filter,
          updateQuery,
          { new: true, session },
        );
        if (!updatedProduct)
          throw new InternalServerErrorException(
            `Lỗi cập nhật tồn kho SKU ${item.sku}`,
          );
        totalQuantity += item.quantity;
        updatedProducts.push({
          productId: updatedProduct._id.toString(),
          sku: item.sku,
          newStock: currentStock,
        });
      }

      if (!Types.ObjectId.isValid(actorId)) {
        throw new BadRequestException(
          `ID người thực hiện (${actorId}) không hợp lệ.`,
        );
      }

      const transactionCode = this.generateTransactionCode();
      const newTransaction = await this.transactionModel.create(
        [
          {
            transaction_code: transactionCode,
            action_type: 'IMPORT',
            items: dto.items.map((i) => {
              // Kiểm tra từng product_id trong mảng items
              if (!Types.ObjectId.isValid(i.product_id)) {
                throw new BadRequestException(
                  `ID sản phẩm ${i.product_id} không hợp lệ.`,
                );
              }
              return {
                product_id: new Types.ObjectId(i.product_id),
                sku: i.sku,
                quantity: i.quantity,
                note: dto.note,
              };
            }),
            total_quantity: totalQuantity,

            note: dto.note,

            reference_code: dto.reference_code,

            actor_id: Types.ObjectId.isValid(actorId)
              ? new Types.ObjectId(actorId)
              : null,
          },
        ],
        { session },
      );

      await this.auditLogsService.log({
        action: 'CREATE_IMPORT_NOTE',
        collection_name: Resource.TRANSFERS,
        actor_id: actorId,
        target_id: newTransaction[0]._id.toString(),
        department: Department.WAREHOUSE,
        detail: {
          message: dto.file_name
            ? `Nhập từ file [${dto.file_name}]`
            : 'Nhập thủ công',
          code: transactionCode,
          total: totalQuantity,
          items: dto.items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
        },
        ip,
        user_agent: userAgent,
      });

      await session.commitTransaction();
      updatedProducts.forEach((p) =>
        this.stockGateway.emitStockUpdate(p.productId, p.sku, p.newStock),
      );
      return newTransaction[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      void session.endSession();
    }
  }

  async getImportHistory(queryDto: GetTransactionsDto) {
    const {
      search,
      start_date,
      end_date,
      sort_by,
      sort_order,
      page = 1,
      limit = 10,
    } = queryDto;

    const filter: FilterQuery<StockTransactionDocument> = {
      action_type: 'IMPORT',
    };

    if (search) {
      // BƯỚC 1: Tìm các ID của User có full_name hoặc email khớp với từ khóa search
      const matchedUsers = await this.userModel
        .find({
          $or: [
            { full_name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        })
        .select('_id')
        .lean();

      const matchedUserIds = matchedUsers.map((u) => u._id);

      // BƯỚC 2: Thêm actor_id vào mảng $or filter cùng với Mã phiếu và Mã tham chiếu
      filter.$or = [
        { transaction_code: { $regex: search, $options: 'i' } },
        { reference_code: { $regex: search, $options: 'i' } },
        { actor_id: { $in: matchedUserIds } },
      ];
    }

    if (start_date || end_date) {
      const dateFilter: Record<string, Date> = {};
      if (start_date) dateFilter['$gte'] = new Date(start_date);
      if (end_date) dateFilter['$lte'] = new Date(end_date);
      filter.created_at = dateFilter;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(filter)
        .populate('actor_id', 'first_Name last_Name email')
        .sort({ [sort_by || 'created_at']: sort_order === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      this.transactionModel.countDocuments(filter),
    ]);

    return {
      data: transactions,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  async getImportDetail(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã định danh phiếu nhập không hợp lệ.');
    }

    const transaction = await this.transactionModel
      .findById(id)
      .populate('actor_id', 'first_Name last_Name email')
      .populate('items.product_id', 'name thumbnail sku has_variants variants')
      .lean();
    if (!transaction || transaction.action_type !== 'IMPORT')
      throw new BadRequestException('Phiếu nhập không tồn tại.');
    const formattedItems = transaction.items.map((item) => {
      const product = item.product_id as unknown as PopulatedProduct;
      let variantName = '';
      if (product?.has_variants) {
        const v = product.variants.find((x) => x.sku === item.sku);
        if (v) variantName = ` - ${String(v.sku)}`;
      }
      return {
        sku: String(item.sku),
        product_name: product ? `${product.name}${variantName}` : 'N/A',
        thumbnail: product ? String(product.thumbnail) : '',
        quantity_imported: Number(item.quantity),
        note: String(item.note || ''),
      };
    });
    return {
      ...transaction,
      items: formattedItems,
      actor: transaction.actor_id as unknown as PopulatedActor,
    };
  }

  async previewExcelImport(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng tải lên file Excel');

    const workbook = new ExcelJS.Workbook();

    // Dùng as any để bypass xung đột kiểu Buffer giữa Node20+ và ExcelJS
    await workbook.xlsx.load(file.buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('File rỗng');

    // BƯỚC 1: TỰ ĐỘNG TÌM DÒNG HEADER
    // (Vì file xuất ra có 3 dòng đầu là tiêu đề trang trí, dòng 4 mới là header)
    let headerRowNumber = -1;
    let headerRowValues: (string | undefined)[] = [];

    for (let i = 1; i <= 10; i++) {
      const row = worksheet.getRow(i);
      const values = row.values as (string | undefined)[];
      // Kiểm tra dòng nào có chứa chữ "sku" (không phân biệt hoa thường)
      if (
        values &&
        values.some((v) => String(v).toLowerCase().includes('sku'))
      ) {
        headerRowNumber = i;
        headerRowValues = values;
        break;
      }
    }

    if (headerRowNumber === -1) {
      throw new BadRequestException(
        'Không tìm thấy dòng tiêu đề hợp lệ (Yêu cầu có cột SKU)',
      );
    }

    // Làm sạch danh sách header để so khớp (bỏ phần tử trống ở index 0 của exceljs)
    const fileHeaders = headerRowValues
      .slice(1)
      .map((h) => (h ? String(h).trim().toLowerCase() : ''));

    const required = ['sku', 'số lượng', 'ghi chú'];
    const isValid = required.every((req) =>
      fileHeaders.some((header) => header.includes(req)),
    );

    if (!isValid) {
      throw new BadRequestException(
        `Sai template mẫu. File có các cột: [${fileHeaders.filter(Boolean).join(', ')}]. Yêu cầu: SKU, Số lượng, Ghi chú.`,
      );
    }

    // BƯỚC 2: XÁC ĐỊNH CHỈ SỐ CỘT ĐỘNG
    let skuIdx = -1,
      qtyIdx = -1,
      noteIdx = -1;
    headerRowValues.forEach((val, idx) => {
      if (!val) return;
      const cleanVal = String(val).trim().toLowerCase();
      if (cleanVal.includes('sku')) skuIdx = idx;
      if (cleanVal.includes('số lượng')) qtyIdx = idx;
      if (cleanVal.includes('ghi chú')) noteIdx = idx;
    });

    const previewData: PreviewItem[] = [];
    let hasError = false;

    const allProducts = await this.productModel
      .find({ is_deleted: false })
      .select('_id sku has_variants variants')
      .lean();

    // BƯỚC 3: ĐỌC DỮ LIỆU TỪ SAU DÒNG HEADER
    worksheet.eachRow((row, rowNumber) => {
      // Chỉ đọc các dòng nằm dưới dòng Header
      if (rowNumber <= headerRowNumber) return;

      const sku = this.extractString(row.getCell(skuIdx).value);
      if (!sku) return; // Bỏ qua nếu dòng trống SKU

      const note = this.extractString(row.getCell(noteIdx).value);
      const rawQty = row.getCell(qtyIdx).value;
      const qty =
        typeof rawQty === 'number'
          ? rawQty
          : Number(this.extractString(rawQty));

      const rowResult: PreviewItem = {
        row: rowNumber,
        sku,
        quantity: qty,
        note,
        status: 'VALID',
        errors: [],
      };

      // Validate số lượng
      if (!qty || qty <= 0 || !Number.isInteger(qty)) {
        rowResult.status = 'INVALID';
        rowResult.errors.push('Số lượng không hợp lệ');
      }

      // Validate SKU tồn tại
      const found = allProducts.find(
        (p) =>
          (!p.has_variants && p.sku === sku) ||
          (p.has_variants && p.variants?.some((v) => v.sku === sku)),
      );

      if (!found) {
        rowResult.status = 'INVALID';
        rowResult.errors.push('SKU không tồn tại');
      } else {
        rowResult.product_id = found._id.toString();
      }

      if (rowResult.status === 'INVALID') hasError = true;
      previewData.push(rowResult);
    });

    return {
      data: previewData,
      can_import: !hasError && previewData.length > 0,
    };
  }

  async exportHistoryExcel(queryDto: GetTransactionsDto, res: Response) {
    const history = await this.getImportHistory(queryDto);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Lịch sử nhập hàng');

    // 1. Cấu hình độ rộng 4 cột (Thêm cột Người thực hiện)
    sheet.getColumn(1).width = 25; // Mã Phiếu
    sheet.getColumn(2).width = 35; // Người thực hiện
    sheet.getColumn(3).width = 15; // Tổng SL
    sheet.getColumn(4).width = 45; // Ghi chú

    // 2. Tiêu đề báo cáo (Dòng 1 - Chữ đỏ to, căn giữa)
    sheet.mergeCells('A1:D1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'BÁO CÁO TỔNG HỢP LỊCH SỬ NHẬP KHO';
    titleCell.font = {
      name: 'Arial',
      size: 14,
      bold: true,
      color: { argb: 'FFD32F2F' },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    // 3. Thông tin bộ lọc & Thời gian xuất (Dòng 2 - In nghiêng)
    sheet.mergeCells('A2:D2');
    const infoCell = sheet.getCell('A2');

    // Format ngày giờ đẹp để hiển thị
    const startDateStr = queryDto.start_date
      ? new Date(queryDto.start_date).toLocaleDateString('vi-VN')
      : 'Từ trước tới nay';
    const endDateStr = queryDto.end_date
      ? new Date(queryDto.end_date).toLocaleDateString('vi-VN')
      : 'Hiện tại';
    const nowStr = new Date().toLocaleString('vi-VN');

    infoCell.value = `Kỳ báo cáo: ${startDateStr} - ${endDateStr}  |  Ngày xuất: ${nowStr}`;
    infoCell.font = { name: 'Arial', size: 10, italic: true };
    infoCell.alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.addRow([]); // Dòng 3 để trống tạo khoảng cách

    // 4. Header của Bảng dữ liệu (Dòng 4 - Nền xanh chữ trắng)
    const headerRow = sheet.addRow([
      'Mã Phiếu',
      'Người thực hiện',
      'Tổng SL',
      'Ghi chú',
    ]);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.font = {
        name: 'Arial',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1976D2' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // 5. Đổ dữ liệu Data (Từ dòng 5 trở đi)
    history.data.forEach((t) => {
      const actor = t.actor_id as unknown as PopulatedActor;

      let actorInfo = 'Hệ thống';

      // TypeScript giờ đã hiểu actor có first_Name và last_Name
      if (actor && actor.first_Name && actor.last_Name) {
        actorInfo = `${actor.first_Name} ${actor.last_Name}\n(${actor.email})`;
      } else if (actor && actor.email) {
        actorInfo = `${actor.email}`;
      }

      const row = sheet.addRow([
        t.transaction_code,
        actorInfo,
        t.total_quantity,
        t.note,
      ]);

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 3 ? 'center' : 'left',
          wrapText: colNumber === 2 || colNumber === 4,
        };
      });
    });

    // 6. Gán tên file chuẩn chuyên nghiệp
    const exportDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `LichSuNhapHang_${exportDate}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    return workbook.xlsx.write(res);
  }

  async exportDetailExcel(id: string, res: Response) {
    const detail = await this.getImportDetail(id);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Chi Tiết Phiếu Nhập');

    // 1. Cấu hình độ rộng cột
    sheet.getColumn(1).width = 20; // SKU
    sheet.getColumn(2).width = 45; // Tên SP
    sheet.getColumn(3).width = 15; // SL
    sheet.getColumn(4).width = 40; // Ghi chú

    // 2. Tiêu đề báo cáo (Merge cell, chữ to in đậm)
    sheet.mergeCells('A1:D1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `PHIẾU NHẬP KHO: ${detail.transaction_code}`;
    titleCell.font = {
      name: 'Arial',
      size: 14,
      bold: true,
      color: { argb: 'FFD32F2F' },
    }; // Chữ đỏ Material
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    // 3. Thông tin người thực hiện (Nhỏ, in nghiêng bên góc phải)
    sheet.mergeCells('A2:D2');
    const infoCell = sheet.getCell('A2');

    const actor = detail.actor as unknown as PopulatedActor;
    let actorName = 'N/A';
    if (actor && actor.first_Name && actor.last_Name) {
      actorName = `${actor.first_Name} ${actor.last_Name}`;
    }

    infoCell.value = `Người thực hiện: ${actorName} - Email: ${actor?.email || 'N/A'}`;
    infoCell.font = { name: 'Arial', size: 10, italic: true };
    infoCell.alignment = { vertical: 'middle', horizontal: 'right' };

    sheet.addRow([]); // Dòng 3 để trống cho thoáng

    // 4. Header của Bảng dữ liệu (Dòng 4)
    const headerRow = sheet.addRow([
      'SKU',
      'Tên sản phẩm',
      'Số lượng',
      'Ghi chú',
    ]);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.font = {
        name: 'Arial',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1976D2' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // 5. Đổ dữ liệu Data
    detail.items.forEach((i) => {
      const row = sheet.addRow([
        i.sku,
        i.product_name,
        i.quantity_imported,
        i.note,
      ]);
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        // Căn giữa cột Số lượng, tên SP và Ghi chú thì wrap text (tự động xuống dòng)
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 3 ? 'center' : 'left',
          wrapText: colNumber === 2 || colNumber === 4,
        };
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const fileName = `PhieuNhapKho_${detail.transaction_code}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    return workbook.xlsx.write(res);
  }
}
