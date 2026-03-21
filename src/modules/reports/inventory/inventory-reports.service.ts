import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { GetXntReportDto, StockStatusFilter } from './dto/query-xnt-report.dto';
import {
  Product,
  ProductDocument,
} from 'src/modules/products/catalog/schemas/product.schema';
import {
  StockTransaction,
  StockTransactionDocument,
} from 'src/modules/inventory/transactions/schemas/stock-transaction.schema';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { Department } from 'src/common/enums/department.enum';
import { Resource } from 'src/common/enums/resource.enum';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import * as path from 'path';
import * as fs from 'fs';

export interface XntRecord {
  sku: string;
  product_name: string;
  category_name?: string;
  beginning_stock: number;
  in_period: number;
  out_period: number;
  ending_stock: number;
}

interface ParsedTx {
  sku: string;
  qty: number;
  is_in: boolean;
  date: Date;
}

@Injectable()
export class InventoryReportsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(StockTransaction.name)
    private transactionModel: Model<StockTransactionDocument>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // Hàm Parser bóc tách dữ liệu từ các loại Transaction khác nhau
  private parseTransactionData(tx: StockTransactionDocument): ParsedTx[] {
    const changes: ParsedTx[] = [];
    const date = tx.created_at;

    // Các Transaction tạo từ StockService có changed_value ở root
    const rootSku = (tx as unknown as { sku?: string }).sku;
    const rootChangedValue = (tx as unknown as { changed_value?: number })
      .changed_value;

    if (tx.items && Array.isArray(tx.items) && tx.items.length > 0) {
      tx.items.forEach((item) => {
        const isImport =
          tx.action_type === 'IMPORT' || tx.action_type === 'RESTOCK';
        changes.push({
          sku: String(item.sku),
          qty: Number(item.quantity),
          is_in: isImport,
          date,
        });
      });
    } else if (rootSku && rootChangedValue !== undefined) {
      // Nhận diện MANUAL_ADJUST, ORDER_ACCEPTED
      const val = Number(rootChangedValue);
      changes.push({
        sku: String(rootSku),
        qty: Math.abs(val),
        is_in: val > 0,
        date,
      });
    }

    return changes;
  }

  async getXntReport(queryDto: GetXntReportDto) {
    const {
      start_date,
      end_date,
      search,
      category_id,
      stock_status,
      page = 1,
      limit = 20,
    } = queryDto;

    // Bắt lỗi khoảng thời gian
    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
      throw new BadRequestException(
        'Ngày bắt đầu không được lớn hơn ngày kết thúc.',
      );
    }

    // 1. LỌC MONGODB THEO CHUẨN SCHEMA
    const productFilter: FilterQuery<ProductDocument> = { is_deleted: false };

    // Xử lý an toàn category_id
    if (
      category_id &&
      typeof category_id === 'string' &&
      Types.ObjectId.isValid(category_id)
    ) {
      productFilter.categories = new Types.ObjectId(category_id);
    }

    if (search) {
      const searchStr = String(search).trim();
      const searchRegex = new RegExp(searchStr, 'i');

      // Tách từ khóa (VD: "Màu Đỏ" -> "Màu", "Đỏ")
      const terms = searchStr
        .split(/\s+/)
        .filter((t) => t.length > 0)
        .map((t) => new RegExp(t, 'i'));

      productFilter.$or = [
        { name: searchRegex },
        { sku: searchRegex },
        { 'variants.sku': searchRegex },
        { 'specs.name': { $in: terms } },
        { 'specs.values': { $in: terms } },
        { 'attributes.code': { $in: terms } },
        { 'attributes.value': { $in: terms } },
        { 'variants.attributes.code': { $in: terms } },
        { 'variants.attributes.value': { $in: terms } },
      ];
    }

    // Lấy data chuẩn
    const products = await this.productModel
      .find(productFilter)
      .setOptions({ strictQuery: false })
      .select(
        'name sku stock has_variants variants categories specs attributes',
      )
      .lean();

    if (!products || products.length === 0) {
      return { data: [], total: 0, page: Number(page), limit: Number(limit) };
    }

    // 2. LỌC TRÊN RAM - 100% TYPE SAFE
    const currentStockMap = new Map<string, { name: string; stock: number }>();

    products.forEach((p) => {
      const isMatchProductName =
        p.name &&
        String(p.name)
          .toLowerCase()
          .includes(
            String(search || '')
              .trim()
              .toLowerCase(),
          );
      const isMatchProductSku =
        p.sku &&
        String(p.sku)
          .toLowerCase()
          .includes(
            String(search || '')
              .trim()
              .toLowerCase(),
          );

      if (
        p.has_variants &&
        Array.isArray(p.variants) &&
        p.variants.length > 0
      ) {
        p.variants.forEach((v) => {
          if (search) {
            const searchLower = String(search).trim().toLowerCase();
            const isMatchSku =
              v.sku && String(v.sku).toLowerCase().includes(searchLower);

            let isMatchAttr = false;
            if (Array.isArray(v.attributes)) {
              isMatchAttr = v.attributes.some((attr) => {
                // Sử dụng đúng chuẩn Schema: attr.code và attr.value
                const code = String(attr.code || '').toLowerCase();
                const val = String(attr.value || '').toLowerCase();
                const combined = `${code} ${val}`; // Nối lại: "color blue"

                return (
                  combined.includes(searchLower) ||
                  val.includes(searchLower) ||
                  code.includes(searchLower)
                );
              });
            }

            if (!isMatchSku && !isMatchProductName && !isMatchAttr) {
              return; // Bỏ qua biến thể này
            }
          }

          currentStockMap.set(String(v.sku), {
            name: `${p.name} - ${v.sku}`,
            stock: Number(v.stock) || 0,
          });
        });
      } else {
        // Xử lý cho sản phẩm đơn lẻ
        if (search) {
          const searchLower = String(search).trim().toLowerCase();
          let isMatchSpec = false;
          if (Array.isArray(p.specs)) {
            isMatchSpec = p.specs.some((spec) => {
              const name = String(spec.name || '').toLowerCase();
              const vals = Array.isArray(spec.values)
                ? spec.values.map((v) => String(v).toLowerCase()).join(' ')
                : '';
              return `${name} ${vals}`.includes(searchLower);
            });
          }

          if (!isMatchProductName && !isMatchProductSku && !isMatchSpec) return;
        }
        currentStockMap.set(String(p.sku), {
          name: String(p.name),
          stock: Number(p.stock) || 0,
        });
      }
    });

    const targetSkus = Array.from(currentStockMap.keys());
    if (targetSkus.length === 0) {
      return { data: [], total: 0, page: Number(page), limit: Number(limit) };
    }

    const filterStart = start_date ? new Date(start_date) : new Date(0);
    const filterEnd = end_date ? new Date(end_date) : new Date();
    filterEnd.setHours(23, 59, 59, 999);

    // 3. TÍNH TOÁN ROLLBACK
    const transactions = await this.transactionModel
      .find({
        status: { $ne: 'CANCELLED' },
        created_at: { $gte: filterStart },
        $or: [
          { 'items.sku': { $in: targetSkus } },
          { sku: { $in: targetSkus } },
        ],
      })
      .select('items action_type created_at sku changed_value')
      .lean();

    const reportData: XntRecord[] = [];

    for (const sku of targetSkus) {
      const pInfo = currentStockMap.get(sku)!;
      let inPeriod = 0,
        outPeriod = 0,
        inFuture = 0,
        outFuture = 0;

      transactions.forEach((tx) => {
        const changes = this.parseTransactionData(
          tx as unknown as StockTransactionDocument,
        );
        const skuChange = changes.find((c) => c.sku === sku);

        if (skuChange) {
          if (skuChange.date >= filterStart && skuChange.date <= filterEnd) {
            if (skuChange.is_in) inPeriod += skuChange.qty;
            else outPeriod += skuChange.qty;
          } else if (skuChange.date > filterEnd) {
            if (skuChange.is_in) inFuture += skuChange.qty;
            else outFuture += skuChange.qty;
          }
        }
      });

      const endingStock = pInfo.stock - inFuture + outFuture;
      reportData.push({
        sku,
        product_name: pInfo.name,
        beginning_stock: endingStock - inPeriod + outPeriod,
        in_period: inPeriod,
        out_period: outPeriod,
        ending_stock: endingStock,
      });
    }

    // 4. LỌC HẬU KỲ VÀ PHÂN TRANG
    let finalData = reportData;
    if (stock_status === StockStatusFilter.NEGATIVE)
      finalData = finalData.filter((i) => i.ending_stock < 0);
    else if (stock_status === StockStatusFilter.ZERO)
      finalData = finalData.filter((i) => i.ending_stock === 0);

    const skip = (Number(page) - 1) * Number(limit);
    return {
      data: finalData.slice(skip, skip + Number(limit)),
      total: finalData.length,
      page: Number(page),
      limit: Number(limit),
    };
  }

  // AC5: Khoan sâu (Drill-down) lịch sử 1 sản phẩm
  async getSkuDrillDown(sku: string, queryDto: GetXntReportDto) {
    const filter: FilterQuery<StockTransactionDocument> = {
      status: { $ne: 'CANCELLED' },
      $or: [{ 'items.sku': sku }, { sku: sku }],
    };

    if (queryDto.start_date || queryDto.end_date) {
      const dateFilter: Record<string, Date> = {};
      if (queryDto.start_date)
        dateFilter['$gte'] = new Date(queryDto.start_date);
      if (queryDto.end_date) {
        const end = new Date(queryDto.end_date);
        end.setHours(23, 59, 59, 999);
        dateFilter['$lte'] = end;
      }
      filter.created_at = dateFilter;
    }

    const skip =
      (Number(queryDto.page || 1) - 1) * Number(queryDto.limit || 20);

    const [transactions, total] = await Promise.all([
      this.transactionModel
        .find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(Number(queryDto.limit || 20))
        .populate('actor_id', 'first_Name last_Name email full_name')
        .lean(),
      this.transactionModel.countDocuments(filter),
    ]);

    const formatted = transactions.map((tx) => {
      const parsed = this.parseTransactionData(
        tx as unknown as StockTransactionDocument,
      );
      const skuData = parsed.find((p) => p.sku === sku);
      const actor = tx.actor_id as unknown as {
        full_name?: string;
        email: string;
      };

      return {
        transaction_code: tx.transaction_code,
        action_type: tx.action_type,
        date: tx.created_at,
        actor: actor?.full_name || actor?.email || 'Hệ thống',
        change_quantity: skuData
          ? skuData.is_in
            ? `+${skuData.qty}`
            : `-${skuData.qty}`
          : '0',
        note: tx.note,
      };
    });

    return {
      data: formatted,
      total,
      page: Number(queryDto.page || 1),
      limit: Number(queryDto.limit || 20),
    };
  }

  // AC1 (US3): Xuất Excel
  async exportXntExcel(
    queryDto: GetXntReportDto,
    actorId: string,
    res: Response,
  ) {
    // 1. Lấy dữ liệu với limit cực đại để xuất file
    const fullQuery = { ...queryDto, page: 1, limit: 50001 }; // Set 50001 để check vượt ngưỡng
    const report = await this.getXntReport(fullQuery);

    // AC5 (US3): Báo lỗi nếu không có dữ liệu
    if (report.total === 0) {
      throw new BadRequestException(
        'Không có dữ liệu phát sinh trong kỳ báo cáo để xuất file.',
      );
    }

    // AC7 (US3): Giới hạn dòng dữ liệu, tránh treo hệ thống
    if (report.total > 50000) {
      throw new BadRequestException(
        'Lượng dữ liệu vượt quá 50.000 dòng. Vui lòng thu hẹp khoảng thời gian hoặc điều kiện lọc báo cáo.',
      );
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Bao Cao XNT');

    sheet.columns = [
      { header: 'Mã SKU', key: 'sku', width: 20 },
      { header: 'Tên Sản Phẩm', key: 'name', width: 45 },
      { header: 'Tồn Đầu Kỳ', key: 'beginning', width: 15 },
      { header: 'Tổng Nhập', key: 'in', width: 15 },
      { header: 'Tổng Xuất', key: 'out', width: 15 },
      { header: 'Tồn Cuối Kỳ', key: 'ending', width: 15 },
    ];

    sheet.insertRow(1, ['BÁO CÁO TỔNG HỢP XUẤT NHẬP TỒN KHO']);
    sheet.mergeCells('A1:F1');
    const titleCell = sheet.getCell('A1');
    titleCell.font = {
      name: 'Arial',
      size: 14,
      bold: true,
      color: { argb: 'FF1976D2' },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    sheet.insertRow(2, [
      `Kỳ báo cáo: ${queryDto.start_date || 'Từ trước tới nay'} - ${queryDto.end_date || 'Hiện tại'}`,
    ]);
    sheet.mergeCells('A2:F2');
    sheet.getCell('A2').alignment = { horizontal: 'center' };
    sheet.getCell('A2').font = { italic: true };

    sheet.getRow(3).values = [
      'Mã SKU',
      'Tên Sản Phẩm',
      'Tồn Đầu Kỳ',
      'Tổng Nhập',
      'Tổng Xuất',
      'Tồn Cuối Kỳ',
    ];
    const headerRow = sheet.getRow(3);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1976D2' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    report.data.forEach((item) => {
      const row = sheet.addRow([
        item.sku,
        item.product_name,
        item.beginning_stock,
        item.in_period,
        item.out_period,
        item.ending_stock,
      ]);

      if (item.ending_stock < 0) {
        row.getCell(6).font = { color: { argb: 'FFFF0000' }, bold: true };
      }
    });

    // AC4 (US3): Tự động đặt tên file theo quy chuẩn LoạiBáoCáo_ThờiGian
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // VD: 20260321
    const fileName = `BaoCaoXNT_${dateStr}.xlsx`;

    // AC8 (US3): Ghi Audit Log
    await this.auditLogsService.log({
      action: 'EXPORT_REPORT',
      collection_name: Resource.REPORTS,
      actor_id: actorId,
      department: Department.WAREHOUSE,
      detail: {
        report_type: 'XNT_EXCEL',
        file_name: fileName,
        filters: queryDto,
      },
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    return workbook.xlsx.write(res);
  }

  // AC2 (US3): Xuất PDF Chuyên Nghiệp
  async exportXntPdf(
    queryDto: GetXntReportDto,
    actorId: string,
    res: Response,
  ) {
    const fullQuery = { ...queryDto, page: 1, limit: 50001 };
    const report = await this.getXntReport(fullQuery);

    if (report.total === 0) {
      throw new BadRequestException(
        'Không có dữ liệu phát sinh trong kỳ báo cáo để xuất file.',
      );
    }

    if (report.total > 50000) {
      throw new BadRequestException(
        'Lượng dữ liệu vượt quá 50.000 dòng. Vui lòng thu hẹp khoảng thời gian.',
      );
    }

    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
      layout: 'landscape',
    });

    try {
      doc.registerFont('Roboto', 'src/common/fonts/Roboto-Regular.ttf');
      doc.registerFont('Roboto-Bold', 'src/common/fonts/Roboto-Bold.ttf');
      doc.registerFont('Roboto-Italic', 'src/common/fonts/Roboto-Italic.ttf');
      doc.font('Roboto');
    } catch (error: unknown) {
      console.error(
        'Không tìm thấy font Tiếng Việt. Chi tiết lỗi:',
        (error as Error).message,
      );
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `BaoCaoXNT_${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    doc.pipe(res);

    // 1. HEADER BÁO CÁO (CÔNG TY + LOGO)
    const logoPath = path.join(process.cwd(), 'src/common/assets/logo.jpg');
    let textStartX = 40;

    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 35, { width: 60 });
      textStartX = 115;
    }

    const headerY = 40;
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
      );
    doc.text(
      'Hotline: 1900 6789 | Website: hnodyssey.com',
      textStartX,
      headerY + 30,
    );

    // 2. TIÊU ĐỀ BÁO CÁO
    const titleY = 110;
    doc
      .font('Roboto-Bold')
      .fontSize(20)
      .fillColor('#E65100')
      .text('BÁO CÁO TỔNG HỢP XUẤT NHẬP TỒN KHO', 40, titleY, {
        align: 'center',
        width: 760,
      });

    const startDateStr = queryDto.start_date
      ? new Date(queryDto.start_date).toLocaleDateString('vi-VN')
      : 'Từ trước tới nay';
    const endDateStr = queryDto.end_date
      ? new Date(queryDto.end_date).toLocaleDateString('vi-VN')
      : 'Hiện tại';

    doc
      .font('Roboto-Italic')
      .fontSize(10)
      .fillColor('#424242')
      .text(`Kỳ báo cáo: ${startDateStr} đến ${endDateStr}`, 40, titleY + 28, {
        align: 'center',
        width: 760,
      });
    doc.text(
      `Ngày lập báo cáo: ${new Date().toLocaleString('vi-VN')}`,
      40,
      titleY + 42,
      { align: 'center', width: 760 },
    );

    // 3. CẤU HÌNH TỌA ĐỘ BẢNG
    const colW = { stt: 30, sku: 110, name: 300, num: 80 };
    const colX = {
      stt: 40,
      sku: 70,
      name: 180,
      beg: 480,
      in: 560,
      out: 640,
      end: 720,
    };

    let currentY = 180; // Bắt đầu bảng dưới tiêu đề

    const drawTableHeader = (y: number) => {
      doc.rect(40, y, 760, 30).fill('#1A237E');
      doc.fillColor('#FFFFFF').font('Roboto-Bold').fontSize(10);
      const textY = y + 10;
      doc.text('STT', colX.stt, textY, { width: colW.stt, align: 'center' });
      doc.text('MÃ SKU', colX.sku + 5, textY, {
        width: colW.sku - 10,
        align: 'left',
      });
      doc.text('TÊN SẢN PHẨM / BIẾN THỂ', colX.name + 5, textY, {
        width: colW.name - 10,
        align: 'left',
      });
      doc.text('TỒN ĐẦU', colX.beg, textY, {
        width: colW.num - 5,
        align: 'right',
      });
      doc.text('NHẬP', colX.in, textY, { width: colW.num - 5, align: 'right' });
      doc.text('XUẤT', colX.out, textY, {
        width: colW.num - 5,
        align: 'right',
      });
      doc.text('TỒN CUỐI', colX.end, textY, {
        width: colW.num - 5,
        align: 'right',
      });
      return y + 30;
    };

    currentY = drawTableHeader(currentY);

    // 4. ĐỔ DỮ LIỆU
    let totalIn = 0;
    let totalOut = 0;

    report.data.forEach((item, index) => {
      doc.font('Roboto').fontSize(9);
      const nameHeight = doc.heightOfString(item.product_name, {
        width: colW.name - 10,
      });
      const rowHeight = Math.max(25, nameHeight + 12);

      if (currentY + rowHeight > 520) {
        doc.addPage({ margin: 40, size: 'A4', layout: 'landscape' });
        currentY = 40;
        currentY = drawTableHeader(currentY);
        doc.font('Roboto').fontSize(9);
      }

      if (index % 2 === 0) {
        doc.rect(40, currentY, 760, rowHeight).fill('#F8FAFC');
      }

      doc.fillColor('#212121');
      const textY = currentY + 6;

      doc.text((index + 1).toString(), colX.stt, textY, {
        width: colW.stt,
        align: 'center',
      });
      doc.text(item.sku, colX.sku + 5, textY, {
        width: colW.sku - 10,
        align: 'left',
      });
      doc.text(item.product_name, colX.name + 5, textY, {
        width: colW.name - 10,
        align: 'left',
      });
      doc.text(item.beginning_stock.toString(), colX.beg, textY, {
        width: colW.num - 5,
        align: 'right',
      });
      doc.text(item.in_period.toString(), colX.in, textY, {
        width: colW.num - 5,
        align: 'right',
      });
      doc.text(item.out_period.toString(), colX.out, textY, {
        width: colW.num - 5,
        align: 'right',
      });

      if (item.ending_stock < 0) {
        doc.fillColor('#D32F2F').font('Roboto-Bold');
      } else {
        doc.fillColor('#212121').font('Roboto');
      }
      doc.text(item.ending_stock.toString(), colX.end, textY, {
        width: colW.num - 5,
        align: 'right',
      });

      doc
        .moveTo(40, currentY + rowHeight)
        .lineTo(800, currentY + rowHeight)
        .strokeColor('#EEEEEE')
        .stroke();
      totalIn += item.in_period;
      totalOut += item.out_period;
      currentY += rowHeight;
    });

    // 5. DÒNG TỔNG CỘNG
    if (currentY + 30 > 520) {
      doc.addPage({ margin: 40, size: 'A4', layout: 'landscape' });
      currentY = 40;
    }
    doc.rect(40, currentY, 760, 30).fill('#FFF3E0');
    doc.fillColor('#E65100').font('Roboto-Bold').fontSize(10);
    doc.text('TỔNG CỘNG:', colX.name, currentY + 10, {
      width: colW.name - 10,
      align: 'right',
    });
    doc.text(totalIn.toString(), colX.in, currentY + 10, {
      width: colW.num - 5,
      align: 'right',
    });
    doc.text(totalOut.toString(), colX.out, currentY + 10, {
      width: colW.num - 5,
      align: 'right',
    });
    currentY += 50;

    // 6. CHỮ KÝ
    if (currentY + 80 > 550) {
      doc.addPage({ margin: 40, size: 'A4', layout: 'landscape' });
      currentY = 40;
    }
    doc.fillColor('#212121').font('Roboto-Bold').fontSize(11);
    doc.text('Người Lập Báo Cáo', 150, currentY, {
      align: 'center',
      width: 150,
    });
    doc.text('Thủ Kho', 550, currentY, { align: 'center', width: 150 });
    doc.font('Roboto-Italic').fontSize(9).fillColor('#757575');
    doc.text('(Ký, ghi rõ họ tên)', 150, currentY + 15, {
      align: 'center',
      width: 150,
    });
    doc.text('(Ký, ghi rõ họ tên)', 550, currentY + 15, {
      align: 'center',
      width: 150,
    });

    // Ghi Audit Log
    await this.auditLogsService.log({
      action: 'EXPORT_REPORT',
      collection_name: Resource.REPORTS,
      actor_id: actorId,
      department: Department.WAREHOUSE,
      detail: {
        report_type: 'XNT_PDF',
        file_name: fileName,
        filters: queryDto,
      },
    });

    doc.end();
  }
}
