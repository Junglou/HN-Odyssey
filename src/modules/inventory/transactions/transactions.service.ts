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
import { CreateExportNoteDto } from './dto/create-export-note.dto';
import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';

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

export interface ExportDetail {
  transaction_code: string;
  status: string;
  created_at: Date;
  note: string;
  reference_code?: string;
  actor: {
    full_name?: string;
    first_Name?: string;
    last_Name?: string;
    email: string;
  };
  items: Array<{
    sku: string;
    product_name: string;
    quantity_exported: number;
    note?: string;
  }>;
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

  private generateCode(prefix: 'IMP' | 'EXP'): string {
    const date = new Date();
    const dateString = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomString = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();
    return `${prefix}-${dateString}-${randomString}`;
  }

  private async getBaseHistory(
    type: 'IMPORT' | 'EXPORT',
    queryDto: GetTransactionsDto,
  ) {
    const {
      search,
      start_date,
      end_date,
      sort_by,
      sort_order,
      reason,
      page = 1,
      limit = 10,
    } = queryDto;

    const filter: FilterQuery<StockTransactionDocument> = { action_type: type };

    if (search) {
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
      filter.$or = [
        { transaction_code: { $regex: search, $options: 'i' } },
        { reference_code: { $regex: search, $options: 'i' } },
        { actor_id: { $in: matchedUserIds } },
      ];
    }

    if (reason) {
      filter.note = { $regex: reason, $options: 'i' };
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
        .populate('actor_id', 'first_Name last_Name email full_name')
        .sort({ [sort_by || 'created_at']: sort_order === 'asc' ? 1 : -1 })
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
        } else {
          if (product.sku !== item.sku)
            throw new BadRequestException(`SKU ${item.sku} không khớp.`);
          updateQuery.$inc = { stock: item.quantity };
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

        // FIX: Lấy tồn kho chuẩn xác từ DB sau khi đã cộng vào
        let actualNewStock = 0;
        if (updatedProduct.has_variants) {
          const v = updatedProduct.variants.find((v) => v.sku === item.sku);
          actualNewStock = v?.stock || 0;
        } else {
          actualNewStock = updatedProduct.stock || 0;
        }

        totalQuantity += item.quantity;
        updatedProducts.push({
          productId: updatedProduct._id.toString(),
          sku: item.sku,
          newStock: actualNewStock, // Dùng số lấy từ DB
        });
      }

      if (!Types.ObjectId.isValid(actorId)) {
        throw new BadRequestException(
          `ID người thực hiện (${actorId}) không hợp lệ.`,
        );
      }

      const transactionCode = this.generateCode('IMP');
      const newTransaction = await this.transactionModel.create(
        [
          {
            transaction_code: transactionCode,
            action_type: 'IMPORT',
            // FIX: Xóa vòng lặp check ID thừa thãi
            items: dto.items.map((i) => ({
              product_id: new Types.ObjectId(i.product_id),
              sku: i.sku,
              quantity: i.quantity,
              note: dto.note,
            })),
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
    return this.getBaseHistory('IMPORT', queryDto);
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
    await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('File rỗng');

    let headerRowNumber = -1;
    let headerRowValues: (string | undefined)[] = [];

    // BƯỚC 1: TÌM DÒNG HEADER CHUẨN XÁC
    for (let i = 1; i <= 10; i++) {
      const row = worksheet.getRow(i);
      const values = row.values as (string | undefined)[];

      if (!values || values.length === 0) continue;

      // Lấy text của tất cả các ô trong dòng để kiểm tra
      const cellTexts = values.map((v) =>
        String(v || '')
          .trim()
          .toLowerCase(),
      );

      // Dòng header phải có chứa ô chính xác là 'sku' hoặc 'mã sku' VÀ có ô 'số lượng'
      const hasSku = cellTexts.some(
        (text) => text === 'sku' || text === 'mã sku',
      );
      const hasQty = cellTexts.some((text) => text.includes('số lượng'));

      if (hasSku && hasQty) {
        headerRowNumber = i;
        headerRowValues = values;
        break;
      }
    }

    if (headerRowNumber === -1) {
      throw new BadRequestException(
        'Không tìm thấy dòng tiêu đề hợp lệ (Yêu cầu có cột Mã SKU và Số lượng ở các ô riêng biệt)',
      );
    }

    // BƯỚC 2: XÁC ĐỊNH CHỈ SỐ CỘT ĐỘNG
    let skuIdx = -1,
      qtyIdx = -1,
      noteIdx = -1;

    headerRowValues.forEach((val, idx) => {
      if (!val) return;
      const cleanVal = String(val).trim().toLowerCase();
      if (cleanVal === 'sku' || cleanVal === 'mã sku') skuIdx = idx;
      if (cleanVal.includes('số lượng')) qtyIdx = idx;
      if (cleanVal.includes('ghi chú') || cleanVal.includes('lý do'))
        noteIdx = idx;
    });

    if (skuIdx === -1 || qtyIdx === -1) {
      throw new BadRequestException(
        'Bố cục file sai. Vui lòng đảm bảo giữ nguyên tên cột Mã SKU và Số lượng.',
      );
    }

    const previewData: PreviewItem[] = [];
    let hasError = false;

    const allProducts = await this.productModel
      .find({ is_deleted: false })
      .select('_id sku has_variants variants')
      .lean();

    // BƯỚC 3: ĐỌC DỮ LIỆU
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return;

      const sku = this.extractString(row.getCell(skuIdx).value);
      if (!sku) return; // Bỏ qua dòng trống

      const note =
        noteIdx !== -1 ? this.extractString(row.getCell(noteIdx).value) : '';
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

      if (!qty || qty <= 0 || !Number.isInteger(qty)) {
        rowResult.status = 'INVALID';
        rowResult.errors.push('Số lượng không hợp lệ');
      }

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

  // NGHIỆP VỤ XUẤT KHO (EXPORT STOCK)

  async createExportNote(
    dto: CreateExportNoteDto, // Sử dụng CreateExportNoteDto
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

        // AC2 & AC4: Đối chiếu tồn kho khả dụng và trừ kho
        if (product.has_variants) {
          const variant = product.variants.find((v) => v.sku === item.sku);
          if (!variant)
            throw new BadRequestException(
              `SKU ${item.sku} không thuộc sản phẩm ${product.name}.`,
            );

          if ((variant.stock || 0) < item.quantity) {
            throw new BadRequestException(
              `Số lượng xuất vượt quá tồn kho hiện có cho SKU ${item.sku} (Tồn: ${variant.stock}).`,
            );
          }

          filter['variants.sku'] = item.sku;
          updateQuery.$inc = {
            'variants.$.stock': -item.quantity,
            stock: -item.quantity,
          };
        } else {
          if (product.sku !== item.sku)
            throw new BadRequestException(`SKU ${item.sku} không khớp.`);
          if ((product.stock || 0) < item.quantity) {
            throw new BadRequestException(
              `Số lượng xuất vượt quá tồn kho hiện có cho SKU ${item.sku} (Tồn: ${product.stock}).`,
            );
          }

          updateQuery.$inc = { stock: -item.quantity };
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

        // FIX: Lấy tồn kho chuẩn xác từ DB sau khi đã trừ đi (giống hệt hàm Import)
        let actualNewStock = 0;
        if (updatedProduct.has_variants) {
          const v = updatedProduct.variants.find((v) => v.sku === item.sku);
          actualNewStock = v?.stock || 0;
        } else {
          actualNewStock = updatedProduct.stock || 0;
        }

        totalQuantity += item.quantity;
        updatedProducts.push({
          productId: updatedProduct._id.toString(),
          sku: item.sku,
          newStock: actualNewStock, // Dùng số lấy từ DB
        });
      }

      const transactionCode = this.generateCode('EXP');
      const newTransaction = await this.transactionModel.create(
        [
          {
            transaction_code: transactionCode,
            action_type: 'EXPORT', // Đánh dấu là phiếu xuất
            status: 'COMPLETED',
            items: dto.items.map((i) => ({
              product_id: new Types.ObjectId(i.product_id),
              sku: i.sku,
              quantity: i.quantity,
              note: dto.note,
            })),
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

      // AC5: Ghi Audit Log
      await this.auditLogsService.log({
        action: 'CREATE_EXPORT_NOTE',
        collection_name: Resource.TRANSFERS,
        actor_id: actorId,
        target_id: newTransaction[0]._id.toString(),
        department: Department.WAREHOUSE,
        detail: {
          message: dto.file_name
            ? `Xuất từ file [${dto.file_name}]`
            : 'Xuất thủ công',
          code: transactionCode,
          status: 'STOCK_DECREASED_SUCCESSFULLY',
          reason: dto.note,
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

  // AC7 (US1): Hủy phiếu xuất và hoàn tồn kho
  async cancelExportNote(
    transactionId: string,
    reason: string,
    actorId: string,
    ip?: string,
    userAgent?: string,
  ) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const transaction = await this.transactionModel
        .findById(transactionId)
        .session(session);

      if (!transaction || transaction.action_type !== 'EXPORT') {
        throw new BadRequestException('Phiếu xuất không tồn tại.');
      }
      if (transaction.status === 'CANCELLED') {
        throw new BadRequestException('Phiếu xuất này đã được hủy trước đó.');
      }

      const updatedProducts: UpdatedProductInfo[] = [];

      for (const item of transaction.items) {
        const filter: FilterQuery<ProductDocument> = { _id: item.product_id };
        const updateQuery: UpdateQuery<ProductDocument> = {};

        // Xác định filter cho biến thể hoặc sản phẩm đơn lẻ
        const productCheck = await this.productModel
          .findById(item.product_id)
          .session(session);
        if (productCheck?.has_variants) {
          filter['variants.sku'] = item.sku;
          updateQuery.$inc = {
            'variants.$.stock': item.quantity,
            stock: item.quantity,
          };
        } else {
          updateQuery.$inc = { stock: item.quantity };
        }

        // THỰC HIỆN CẬP NHẬT VÀ LẤY DỮ LIỆU MỚI NHẤT
        const updatedProduct = await this.productModel.findOneAndUpdate(
          filter,
          updateQuery,
          { new: true, session },
        );

        if (updatedProduct) {
          let actualStock = 0;
          if (updatedProduct.has_variants) {
            const v = updatedProduct.variants.find((v) => v.sku === item.sku);
            actualStock = v?.stock || 0;
          } else {
            actualStock = updatedProduct.stock || 0;
          }

          updatedProducts.push({
            productId: updatedProduct._id.toString(),
            sku: item.sku,
            newStock: actualStock, // Lấy từ kết quả DB trả về
          });
        }
      }

      transaction.status = 'CANCELLED';
      transaction.note = `${transaction.note} | Lý do hủy: ${reason}`;
      await transaction.save({ session });

      // Ghi log chi tiết
      await this.auditLogsService.log({
        action: 'CANCEL_EXPORT_NOTE',
        collection_name: Resource.TRANSFERS,
        actor_id: actorId,
        target_id: transaction._id.toString(),
        department: Department.WAREHOUSE,
        detail: {
          code: transaction.transaction_code,
          reason: reason,
          total_items: transaction.items.length,
        },
        ip,
        user_agent: userAgent,
      });

      await session.commitTransaction();

      // Phát tín hiệu cập nhật qua Socket
      updatedProducts.forEach((p) =>
        this.stockGateway.emitStockUpdate(p.productId, p.sku, p.newStock),
      );
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      void session.endSession();
    }
  }

  // AC1, AC2, AC3, AC5 (US Lịch Sử)
  async getExportHistory(queryDto: GetTransactionsDto) {
    return this.getBaseHistory('EXPORT', queryDto);
  }

  async getExportDetail(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Mã định danh phiếu xuất không hợp lệ.');

    const transaction = await this.transactionModel
      .findById(id)
      .populate('actor_id', 'first_Name last_Name email full_name')
      .populate('items.product_id', 'name thumbnail sku has_variants variants')
      .lean();
    if (!transaction || transaction.action_type !== 'EXPORT')
      throw new BadRequestException('Phiếu xuất không tồn tại.');

    const formattedItems = transaction.items.map((item) => {
      const product = item.product_id as unknown as PopulatedProduct;
      let variantName = '';
      if (product?.has_variants) {
        const v = product.variants.find((x) => x.sku === item.sku);
        if (v) variantName = ` - ${String(v.sku)}`;
      }
      return {
        sku: String(item.sku),
        product_name: product
          ? `${product.name}${variantName}`
          : 'Sản phẩm đã bị xóa',
        thumbnail: product ? String(product.thumbnail) : '',
        quantity_exported: Number(item.quantity),
        note: String(item.note || ''),
      };
    });

    return {
      ...transaction,
      items: formattedItems,
      actor: transaction.actor_id as unknown as PopulatedActor,
    };
  }

  // Preview Excel với logic Kiểm tra Tồn kho gắt gao hơn
  async previewExcelExport(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng tải lên file Excel');

    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await workbook.xlsx.load(file.buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new BadRequestException('File rỗng');

    let headerRowNumber = -1;
    let headerRowValues: (string | undefined)[] = [];

    for (let i = 1; i <= 10; i++) {
      const row = worksheet.getRow(i);
      const values = row.values as (string | undefined)[];
      if (
        values &&
        values.some((v) => String(v).toLowerCase().includes('sku'))
      ) {
        headerRowNumber = i;
        headerRowValues = values;
        break;
      }
    }

    if (headerRowNumber === -1)
      throw new BadRequestException(
        'Không tìm thấy dòng tiêu đề hợp lệ (Yêu cầu có cột SKU)',
      );

    let skuIdx = -1,
      qtyIdx = -1,
      noteIdx = -1;
    headerRowValues.forEach((val, idx) => {
      if (!val) return;
      const cleanVal = String(val).trim().toLowerCase();
      if (cleanVal.includes('sku')) skuIdx = idx;
      if (cleanVal.includes('số lượng')) qtyIdx = idx;
      if (cleanVal.includes('lý do') || cleanVal.includes('ghi chú'))
        noteIdx = idx;
    });

    if (skuIdx === -1 || qtyIdx === -1)
      throw new BadRequestException('File thiếu cột SKU hoặc Số lượng.');

    const previewData: PreviewItem[] = [];
    let hasError = false;

    const allProducts = await this.productModel
      .find({ is_deleted: false })
      .select('_id sku has_variants variants stock')
      .lean();

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return;

      const sku = this.extractString(row.getCell(skuIdx).value);
      if (!sku) return;

      const note =
        noteIdx !== -1 ? this.extractString(row.getCell(noteIdx).value) : '';
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

      if (!qty || qty <= 0 || !Number.isInteger(qty)) {
        rowResult.status = 'INVALID';
        rowResult.errors.push('Số lượng không hợp lệ');
      }

      const foundProduct = allProducts.find(
        (p) =>
          (!p.has_variants && p.sku === sku) ||
          (p.has_variants && p.variants?.some((v) => v.sku === sku)),
      );

      if (!foundProduct) {
        rowResult.status = 'INVALID';
        rowResult.errors.push('SKU không tồn tại');
      } else {
        rowResult.product_id = foundProduct._id.toString();
        // Kiểm tra tồn kho ngay lúc preview (AC6)
        let currentStock = 0;
        if (foundProduct.has_variants) {
          const v = foundProduct.variants.find((v) => v.sku === sku);
          currentStock = v?.stock || 0;
        } else {
          currentStock = foundProduct.stock || 0;
        }

        if (currentStock < qty) {
          rowResult.status = 'INVALID';
          rowResult.errors.push(`Vượt tồn kho (Hiện có: ${currentStock})`);
        }
      }

      if (rowResult.status === 'INVALID') hasError = true;
      previewData.push(rowResult);
    });

    return {
      data: previewData,
      can_export: !hasError && previewData.length > 0,
    };
  }

  async exportHistoryExcelReport(queryDto: GetTransactionsDto, res: Response) {
    // US3 - AC9: Xử lý chặn xuất nếu dữ liệu quá lớn để tránh treo server
    const filter: FilterQuery<StockTransactionDocument> = {
      action_type: 'EXPORT',
    };
    if (queryDto.start_date || queryDto.end_date) {
      const dateFilter: Record<string, Date> = {};
      if (queryDto.start_date)
        dateFilter['$gte'] = new Date(queryDto.start_date);
      if (queryDto.end_date) dateFilter['$lte'] = new Date(queryDto.end_date);
      filter.created_at = dateFilter;
    }
    const countCheck = await this.transactionModel.countDocuments(filter);
    if (countCheck > 50000) {
      throw new BadRequestException(
        'Lượng dữ liệu vượt quá 50.000 dòng. Vui lòng thu hẹp khoảng thời gian báo cáo.',
      );
    }

    // Tái sử dụng query nhưng limit cực lớn để lấy hết data xuất file
    const fullQuery = { ...queryDto, limit: 50000, page: 1 };
    const history = await this.getExportHistory(fullQuery);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Báo Cáo Xuất Kho');

    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 35;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 20;
    sheet.getColumn(5).width = 40;

    sheet.mergeCells('A1:E1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'BÁO CÁO TỔNG HỢP XUẤT KHO';
    titleCell.font = {
      name: 'Arial',
      size: 14,
      bold: true,
      color: { argb: 'FFE65100' },
    }; // Chữ Cam sẫm
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    sheet.mergeCells('A2:E2');
    const infoCell = sheet.getCell('A2');
    infoCell.value = `Ngày xuất báo cáo: ${new Date().toLocaleString('vi-VN')}`;
    infoCell.font = { name: 'Arial', size: 10, italic: true };
    infoCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.addRow([]);

    const headerRow = sheet.addRow([
      'Mã Phiếu',
      'Người xuất',
      'Tổng SL',
      'Trạng thái',
      'Lý do xuất (Ghi chú)',
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
        fgColor: { argb: 'FFEF6C00' },
      }; // Nền cam
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // US3 - AC7: Xử lý file trống không báo lỗi, chỉ trả Header
    if (history.data.length > 0) {
      history.data.forEach((t) => {
        const actor = t.actor_id as unknown as PopulatedActor;
        const actorInfo = actor
          ? `${actor.first_Name || ''} ${actor.last_Name || ''}\n(${actor.email})`
          : 'Hệ thống';

        const row = sheet.addRow([
          t.transaction_code,
          actorInfo,
          t.total_quantity,
          t.status === 'CANCELLED' ? 'Đã hủy' : 'Hoàn tất',
          t.note,
        ]);
        row.eachCell((cell, colNumber) => {
          cell.font = {
            name: 'Arial',
            size: 10,
            color: t.status === 'CANCELLED' ? { argb: 'FFD32F2F' } : undefined,
          }; // Đỏ nếu hủy
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber === 3 ? 'center' : 'left',
            wrapText: colNumber === 2 || colNumber === 5,
          };
        });
      });
    }

    // US3 - AC5: Tự động đặt tên file
    const exportDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `XuatKho_${exportDate}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    return workbook.xlsx.write(res);
  }

  // AC1 (US Xuất Excel): Xuất Chi tiết 1 phiếu ra Excel
  async exportDetailExcelReport(id: string, res: Response) {
    const detail = await this.getExportDetail(id);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Chi Tiết Phiếu Xuất');

    sheet.getColumn(1).width = 20;
    sheet.getColumn(2).width = 45;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 40;

    sheet.mergeCells('A1:D1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `PHIẾU XUẤT KHO: ${detail.transaction_code} ${detail.status === 'CANCELLED' ? '(ĐÃ HỦY)' : ''}`;
    titleCell.font = {
      name: 'Arial',
      size: 14,
      bold: true,
      color: { argb: detail.status === 'CANCELLED' ? 'FFD32F2F' : 'FFE65100' },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    sheet.mergeCells('A2:D2');
    const infoCell = sheet.getCell('A2');
    const actor = detail.actor as unknown as PopulatedActor;
    infoCell.value = `Người thực hiện: ${actor?.first_Name || ''} ${actor?.last_Name || 'Hệ thống'} - Lý do tổng: ${detail.note}`;
    infoCell.font = { name: 'Arial', size: 10, italic: true };
    infoCell.alignment = { vertical: 'middle', horizontal: 'right' };
    sheet.addRow([]);

    const headerRow = sheet.addRow([
      'SKU',
      'Tên sản phẩm',
      'Số lượng xuất',
      'Ghi chú dòng',
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
        fgColor: { argb: 'FFEF6C00' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    detail.items.forEach((i) => {
      const row = sheet.addRow([
        i.sku,
        i.product_name,
        i.quantity_exported,
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
    const fileName = `ChiTietXuatKho_${detail.transaction_code}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    return workbook.xlsx.write(res);
  }

  // TẠO FILE MẪU NHẬP/XUẤT EXCEL

  private buildExcelTemplateConfig(
    sheet: ExcelJS.Worksheet,
    title: string,
    titleColor: string,
    headerColor: string,
    instructions: string[],
    sampleData: (string | number)[][],
  ) {
    sheet.getColumn(1).width = 20;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 50;

    sheet.mergeCells('A1:C1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = {
      name: 'Arial',
      size: 12,
      bold: true,
      color: { argb: titleColor },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    for (let i = 0; i < instructions.length; i++) {
      const rowNum = i + 2;
      sheet.mergeCells(`A${rowNum}:C${rowNum}`);
      const cell = sheet.getCell(`A${rowNum}`);
      cell.value = instructions[i];
      cell.font = {
        name: 'Arial',
        size: 10,
        italic: true,
        color: { argb: 'FF5A5A5A' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      sheet.getRow(rowNum).height = 20;
    }

    for (let r = 1; r <= 4; r++) {
      for (let c = 1; c <= 3; c++) {
        const cell = sheet.getCell(r, c);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8F9FA' },
        };
        cell.border = {
          top:
            r === 1
              ? { style: 'thin', color: { argb: 'FFCCCCCC' } }
              : undefined,
          bottom:
            r === 4 || r === 1
              ? { style: 'thin', color: { argb: 'FFCCCCCC' } }
              : undefined,
          left:
            c === 1
              ? { style: 'thin', color: { argb: 'FFCCCCCC' } }
              : undefined,
          right:
            c === 3
              ? { style: 'thin', color: { argb: 'FFCCCCCC' } }
              : undefined,
        };
      }
    }

    sheet.getRow(5).height = 10;

    const headers = [
      'SKU',
      'Số lượng',
      title.includes('NHẬP') ? 'Ghi chú' : 'Lý do',
    ];
    const headerRow = sheet.addRow(headers);
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
        fgColor: { argb: headerColor },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    sampleData.forEach((data) => {
      const row = sheet.addRow(data);
      row.height = 25;
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 2 ? 'center' : 'left',
          wrapText: true,
        };
        cell.border = {
          top: { style: 'dashed', color: { argb: 'FFBDBDBD' } },
          bottom: { style: 'dashed', color: { argb: 'FFBDBDBD' } },
          left: { style: 'dashed', color: { argb: 'FFBDBDBD' } },
          right: { style: 'dashed', color: { argb: 'FFBDBDBD' } },
        };
      });
    });
  }

  async downloadImportTemplate(res: Response) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Mẫu Nhập Kho');

    const instructions = [
      '- Cột "SKU" và "Số lượng" là bắt buộc nhập.',
      '- Số lượng phải là số nguyên dương (lớn hơn 0).',
      '- KHÔNG thay đổi thứ tự hoặc xóa các cột tiêu đề ở dòng 6.',
    ];
    const sampleData = [
      ['IP15-PL', 20, 'Nhập hàng đợt 1 tháng 3 để chuẩn bị Flash Sale'],
      ['IP15-M', 15, 'Nhập hàng đợt 1 tháng 3 để chuẩn bị Flash Sale'],
    ];

    this.buildExcelTemplateConfig(
      sheet,
      'HƯỚNG DẪN NHẬP KHO BẰNG EXCEL',
      'FF1976D2',
      'FF1976D2',
      instructions,
      sampleData,
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Template_NhapKho.xlsx',
    );
    return workbook.xlsx.write(res);
  }

  async downloadExportTemplate(res: Response) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Mẫu Xuất Kho');

    const instructions = [
      '- Cột "SKU", "Số lượng" và "Lý do" là bắt buộc nhập.',
      '- Số lượng xuất KHÔNG ĐƯỢC vượt quá tồn kho thực tế hiện có.',
      '- KHÔNG thay đổi thứ tự hoặc xóa các cột tiêu đề ở dòng 6.',
    ];
    const sampleData = [
      ['IP15-PL', 11, 'Xuất bán trực tiếp tại quầy POS'],
      ['IP15-M', 5, 'Xuất bán trực tiếp tại quầy POS'],
    ];

    this.buildExcelTemplateConfig(
      sheet,
      'HƯỚNG DẪN XUẤT KHO BẰNG EXCEL',
      'FFE65100',
      'FFEF6C00',
      instructions,
      sampleData,
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Template_XuatKho.xlsx',
    );
    return workbook.xlsx.write(res);
  }

  async exportDetailPdf(id: string, res: Response) {
    const rawData = await this.getExportDetail(id);
    const detail = rawData as unknown as ExportDetail;

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    // 1. Đăng ký Font
    const fontPath = 'src/common/fonts/Roboto-Regular.ttf';
    const fontBoldPath = 'src/common/fonts/Roboto-Bold.ttf';
    const fontItalicPath = 'src/common/fonts/Roboto-Italic.ttf';

    try {
      doc.registerFont('Roboto', fontPath);
      doc.registerFont('Roboto-Bold', fontBoldPath);
      doc.registerFont('Roboto-Italic', fontItalicPath);
      doc.font('Roboto');
    } catch (error: unknown) {
      console.error(
        'Thiếu font trong src/common/fonts/ - Chi tiết:',
        (error as Error).message,
      );
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=PhieuXuat_${detail.transaction_code}.pdf`,
    );
    doc.pipe(res);

    // 2. WATERMARK (Nếu đơn bị hủy)
    if (detail.status === 'CANCELLED') {
      doc
        .save()
        .opacity(0.07)
        .fillColor('#FF0000')
        .fontSize(70)
        .rotate(-45, { origin: [300, 400] })
        .text('ĐÃ HỦY PHIẾU', 100, 400, { align: 'center' })
        .restore();
    }

    // Khung viền trang chuyên nghiệp
    doc.rect(20, 20, 555, 802).stroke('#CCCCCC');

    // 3. HEADER (TÍCH HỢP LOGO.JPG)
    const logoPath = path.join(process.cwd(), 'src/common/assets/Logo.jpg');
    let textStartX = 40;
    const headerY = 40;

    if (fs.existsSync(logoPath)) {
      // Chèn Logo.jpg
      doc.image(logoPath, 40, 35, { width: 55 });
      textStartX = 105; // Đẩy chữ sang phải để nhường chỗ cho logo
    }

    doc
      .font('Roboto-Bold')
      .fontSize(14)
      .fillColor('#1A237E')
      .text('H&N ODYSSEY - E-COMMERCE SYSTEM', textStartX, headerY);

    doc
      .font('Roboto')
      .fontSize(9)
      .fillColor('#616161')
      .text(
        'Địa chỉ: 45 Nguyễn Khắc Nhu, P. Cô Giang, Q. 1, TP. HCM',
        textStartX,
        headerY + 18,
      )
      .text(
        'Hotline: 1900 6789 | Website: hnodyssey.com',
        textStartX,
        headerY + 30,
      );

    // Box mã phiếu (Góc phải trên cùng)
    doc.rect(400, 40, 155, 45).stroke('#E0E0E0');
    doc
      .font('Roboto-Bold')
      .fontSize(8)
      .fillColor('#757575')
      .text('MÃ GIAO DỊCH:', 410, 50);
    doc
      .fontSize(11)
      .fillColor('#D32F2F')
      .text(detail.transaction_code, 410, 62);

    doc.moveTo(40, 110).lineTo(555, 110).stroke('#EEEEEE');

    // 4. TIÊU ĐỀ PHIẾU
    doc.y = 130;
    doc
      .font('Roboto-Bold')
      .fontSize(22)
      .fillColor('#E65100')
      .text('PHIẾU XUẤT KHO', { align: 'center' });
    doc
      .font('Roboto')
      .fontSize(10)
      .fillColor('#616161')
      .text(
        `Ngày lập: ${new Date(detail.created_at).toLocaleString('vi-VN')}`,
        { align: 'center' },
      );
    doc.moveDown(1);

    // 5. KHỐI THÔNG TIN CHUNG
    const startInfoY = doc.y;
    doc.fontSize(10).fillColor('#212121');

    const reasonText = `Lý do xuất: ${detail.note || 'N/A'}`;
    const reasonHeight = doc.heightOfString(reasonText, { width: 490 });
    const infoBoxHeight = 45 + reasonHeight;

    doc
      .rect(40, startInfoY, 515, infoBoxHeight)
      .fill('#FAFAFA')
      .stroke('#EEEEEE');
    doc.fillColor('#212121');

    doc
      .font('Roboto-Bold')
      .text('Người thực hiện:', 55, startInfoY + 10, { continued: true })
      .font('Roboto')
      .text(` ${detail.actor?.full_name || detail.actor?.email}`);

    doc
      .font('Roboto-Bold')
      .text('Trạng thái:', 360, startInfoY + 10, { continued: true })
      .font('Roboto')
      .fillColor(detail.status === 'CANCELLED' ? '#D32F2F' : '#2E7D32')
      .text(` ${detail.status === 'CANCELLED' ? 'ĐÃ HỦY' : 'HOÀN TẤT'}`);

    doc
      .fillColor('#212121')
      .font('Roboto-Bold')
      .text('Tham chiếu:', 360, startInfoY + 25, { continued: true })
      .font('Roboto')
      .text(` ${String(detail.reference_code || 'N/A')}`);

    doc
      .font('Roboto-Bold')
      .text('Lý do xuất:', 55, startInfoY + 25, { continued: false });
    doc
      .font('Roboto')
      .text(detail.note || 'N/A', 130, startInfoY + 25, { width: 220 });

    doc.y = startInfoY + infoBoxHeight + 20;

    // 6. BẢNG SẢN PHẨM (Đã canh lề chuẩn)
    const tableTop = doc.y;
    const col = { stt: 40, sku: 80, name: 180, qty: 470 };

    doc.rect(40, tableTop, 515, 25).fill('#1A237E');
    doc.fillColor('#FFFFFF').font('Roboto-Bold');
    doc.text('STT', col.stt + 5, tableTop + 7, { width: 30, align: 'center' });
    doc.text('MÃ SKU', col.sku, tableTop + 7);
    doc.text('TÊN SẢN PHẨM / BIẾN THỂ', col.name, tableTop + 7);
    doc.text('SL XUẤT', col.qty, tableTop + 7, { width: 80, align: 'center' });

    doc.y = tableTop + 25;
    let totalQty = 0;

    detail.items.forEach((item, index) => {
      const rowY = doc.y;
      const nameHeight = doc.heightOfString(item.product_name, { width: 280 });
      const rowHeight = Math.max(25, nameHeight + 10);

      if (rowY + rowHeight > 760) {
        doc.addPage();
        doc.rect(20, 20, 555, 802).stroke('#CCCCCC');
        doc.y = 40;
      }

      if (index % 2 === 0) {
        doc.rect(40, doc.y, 515, rowHeight).fill('#F9F9F9');
      }

      doc.fillColor('#212121').font('Roboto');
      doc.text((index + 1).toString(), col.stt + 5, rowY + 7, {
        width: 30,
        align: 'center',
      });
      doc.text(item.sku, col.sku, rowY + 7);
      doc.text(item.product_name, col.name, rowY + 7, { width: 280 });
      doc.text(item.quantity_exported.toString(), col.qty, rowY + 7, {
        width: 80,
        align: 'center',
      });

      totalQty += item.quantity_exported;
      doc.y = rowY + rowHeight;
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#EEEEEE').stroke();
    });

    // 7. TỔNG CỘNG
    const finalY = doc.y;
    doc.rect(40, finalY, 515, 30).fill('#EEEEEE').stroke('#BDBDBD');
    doc
      .fillColor('#000000')
      .font('Roboto-Bold')
      .text('TỔNG CỘNG SỐ LƯỢNG:', col.sku, finalY + 10);
    doc.fontSize(13).text(totalQty.toString(), col.qty, finalY + 9, {
      width: 80,
      align: 'center',
    });

    // 8. CHỮ KÝ
    doc.y = finalY + 50;
    const signY = doc.y;
    const signCol = { c1: 60, c2: 240, c3: 420 };

    doc.fontSize(10).font('Roboto-Bold').fillColor('#212121');
    doc.text('Người lập phiếu', signCol.c1, signY);
    doc.text('Người nhận hàng', signCol.c2, signY);
    doc.text('Thủ kho xuất', signCol.c3, signY);

    doc.font('Roboto-Italic').fontSize(8).fillColor('#757575');
    doc.text('(Ký và ghi rõ họ tên)', signCol.c1 + 5, signY + 15);
    doc.text('(Ký và ghi rõ họ tên)', signCol.c2 + 5, signY + 15);
    doc.text('(Ký và ghi rõ họ tên)', signCol.c3 + 5, signY + 15);

    doc.end();
  }
}
