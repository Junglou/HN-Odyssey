import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection, Types, FilterQuery, PipelineStage } from 'mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Order, OrderDocument } from './schemas/order.schema';
import { Cart } from '../cart/schemas/cart.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { Product } from 'src/modules/products/catalog/schemas/product.schema';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';
import { ProductStatus } from 'src/common/enums/product-status.enum';
import { Department } from 'src/common/enums/department.enum';
import { FilterOrderDto } from './dto/filter-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { EmailService } from 'src/modules/notifications/channels/email.service';
import { PdfService } from './pdf.service';
import { PromotionEngineService } from 'src/modules/marketing/promotions/promotion-engine.service';
import { StockService } from 'src/modules/inventory/stock/stock.service';
import {
  InitGuestCheckoutDto,
  VerifyGuestOtpDto,
} from './dto/guest-checkout.dto';
import { randomUUID } from 'crypto';
import {
  AggregateResult,
  CartItem,
  InvoiceOrder,
  MongooseOrderDoc,
  type OrderData,
  OrderItem,
  OrderStatus,
  PrintTemplateData,
  Voucher,
  VoucherType,
} from 'src/common/interfaces/order.interface';
import { VnpayService } from '../payment/providers/vnpay.service';
import { ShippingConfig } from 'src/modules/shipping/schemas/shipping-config.schema';
import { ShippingService } from 'src/modules/shipping/shipping.service';
import { PaymentService } from '../payment/payment.service';
import { GhnService } from 'src/modules/shipping/providers/ghn.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { GhtkService } from 'src/modules/shipping/providers/ghtk.service';
import { OrderStateMachine } from './flow/order-state-machine.service';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import {
  FlashSale,
  FlashSaleDiscountType,
  FlashSaleStatus,
} from 'src/modules/marketing/promotions/schemas/flash-sale.schema';
import { LoyaltyService } from 'src/modules/marketing/loyalty/loyalty.service';
import {
  LoyaltyHistory,
  PointStatus,
} from 'src/modules/marketing/loyalty/schemas/loyalty-history.schema';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';

// type OrderDocWithShipping = MongooseOrderDoc & {
//   waybillCode?: string;
//   actualShippingFee?: number;
// };

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(
    @InjectModel(Order.name) private orderModel: Model<Order>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    @InjectConnection() private connection: Connection,
    @InjectRedis() private readonly redis: Redis,
    @InjectModel(ShippingConfig.name)
    private shippingConfigModel: Model<ShippingConfig>,
    private readonly auditLogsService: AuditLogsService,
    private readonly emailService: EmailService,
    private readonly pdfService: PdfService,
    private readonly promotionEngine: PromotionEngineService,
    private readonly stockService: StockService,
    private readonly vnpayService: VnpayService,
    private readonly paymentService: PaymentService,
    private readonly shippingService: ShippingService,
    private readonly ghnService: GhnService,
    private readonly ghtkService: GhtkService,
    private readonly eventEmitter: EventEmitter2,
    private readonly stateMachine: OrderStateMachine,
    @InjectModel(FlashSale.name) private flashSaleModel: Model<FlashSale>,
    private readonly loyaltyService: LoyaltyService,
    @InjectModel(LoyaltyHistory.name)
    private loyaltyHistoryModel: Model<LoyaltyHistory>,
  ) {}

  // US.121: DANH SÁCH ĐƠN HÀNG
  async findAll(query: FilterOrderDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const { search, status, fromDate, toDate, sort } = query;

    // SỬ DỤNG PIPELINE STAGE CHUẨN ĐỂ LOẠI BỎ LỖI ESLINT 'ANY'
    const pipeline: PipelineStage[] = [];

    // GIAI ĐOẠN 1: SEARCH
    if (search && search.trim().length > 0) {
      pipeline.push({
        $search: {
          index: 'default',
          compound: {
            should: [
              {
                text: {
                  query: search,
                  path: 'order_code',
                  score: { boost: { value: 5 } },
                },
              },
              {
                text: {
                  query: search,
                  path: ['shipping_info.phone', 'guest_info.phone'],
                  score: { boost: { value: 3 } },
                },
              },
              {
                text: {
                  query: search,
                  // BỔ SUNG guest_info.name ĐỂ TÌM CẢ KHÁCH VÃNG LAI
                  path: ['shipping_info.name', 'guest_info.name'],
                  // BỎ fuzzy ĐỂ TRÁNH NHẬN DIỆN "MAP" THÀNH "MAI"
                  // Bỏ cấu hình fuzzy: { maxEdits: 1 } đi
                },
              },
            ],
            minimumShouldMatch: 1,
          },
        },
      } as PipelineStage);
    }

    // GIAI ĐOẠN 2: MATCH VÀ PHIÊN DỊCH STATUS (FE -> BE)
    const matchStage: FilterQuery<Order> = {
      status: { $ne: 'TEMPORARY' },
      'payment.method': { $ne: 'TRADE-IN' },
    };

    if (status && status !== 'all') {
      const upperStatus = status.toUpperCase();
      // Gom nhóm Status từ Backend để map đúng ý đồ của Frontend
      if (upperStatus === 'PACKAGING') {
        matchStage.status = { $in: ['PROCESSING', 'READY_TO_SHIP', 'ON_HOLD'] };
      } else if (upperStatus === 'DELIVERED') {
        matchStage.status = { $in: ['DELIVERED', 'COMPLETED'] };
      } else if (upperStatus === 'REFUNDED') {
        matchStage.status = {
          $in: ['REFUND_PENDING', 'REFUND_NEEDED', 'REFUNDED', 'RETURNED'],
        };
      } else if (upperStatus === 'CONFIRMED') {
        matchStage.status = {
          $in: ['CONFIRMED', 'PRIORITY', 'TRADE_IN_REVIEW'],
        };
      } else {
        matchStage.status = upperStatus;
      }
    }

    if (query.user_id) {
      matchStage.user_id = new Types.ObjectId(query.user_id);
    }

    // Xử lý an toàn cho bộ lọc ngày tháng
    if (fromDate || toDate) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};

      if (fromDate && typeof fromDate === 'string' && fromDate.trim() !== '') {
        const parsedFromDate = new Date(fromDate);
        parsedFromDate.setHours(0, 0, 0, 0);
        dateFilter.$gte = parsedFromDate;
      }

      if (toDate && typeof toDate === 'string' && toDate.trim() !== '') {
        const parsedToDate = new Date(toDate);
        parsedToDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = parsedToDate;
      }

      if (Object.keys(dateFilter).length > 0) {
        matchStage.createdAt = dateFilter;
      }
    }

    pipeline.push({ $match: matchStage } as PipelineStage);

    // GIAI ĐOẠN 3: SORT
    let sortStage: Record<string, 1 | -1> = {};
    if (sort) {
      const [key, val] = sort.split(':');
      sortStage[key] = val === 'desc' ? -1 : 1;
    } else {
      sortStage = { sort_weight: 1, createdAt: -1 };
    }

    const skip = (page - 1) * limit;

    // GIAI ĐOẠN 4: FACET
    pipeline.push({
      $facet: {
        data: [
          {
            $addFields: {
              sort_weight: {
                $cond: {
                  if: { $eq: ['$status', 'PRIORITY'] },
                  then: 1,
                  else: 2,
                },
              },
            },
          },
          { $sort: sortStage },
          { $skip: skip },
          { $limit: limit },
          { $project: { sort_weight: 0 } },
        ],
        totalCount: [{ $count: 'count' }],
      },
    } as PipelineStage);

    const [result] =
      await this.orderModel.aggregate<AggregateResult<Order>>(pipeline);
    const data = result?.data ?? [];
    const total = result?.totalCount?.[0]?.count ?? 0;

    return {
      data,
      meta: {
        total,
        page,
        last_page: Math.ceil(total / limit),
      },
    };
  }

  async exportExcel(adminId: string, queryDto: FilterOrderDto, res: Response) {
    // 1. Ép kiểu an toàn (Safe Type Casting) để loại bỏ lỗi 'any' từ MongoDB
    type ExporterDoc = {
      email?: string;
      first_Name?: string;
      last_Name?: string;
    };

    const exporterRaw = await this.connection
      .collection('users')
      .findOne(
        { _id: new Types.ObjectId(adminId) },
        { projection: { email: 1, first_Name: 1, last_Name: 1 } },
      );

    const exporter = exporterRaw as ExporterDoc | null;

    const exporterEmail = exporter?.email || 'N/A';
    let exporterName = 'N/A';

    if (exporter) {
      if (exporter.first_Name && exporter.last_Name) {
        exporterName = `${exporter.first_Name} ${exporter.last_Name}`;
      } else if (exporter.email) {
        exporterName = exporter.email.split('@')[0] || 'N/A';
      }
    }

    // 2. Ép limit thật lớn để xuất toàn bộ data theo filter, bỏ qua phân trang
    const fullQuery = { ...queryDto, limit: 50000, page: 1 };

    // 3. Tận dụng lại chính hàm findAll đã được xử lý PipelineStage Strict Type ở trên
    const result = await this.findAll(fullQuery);

    // Nếu dữ liệu vượt quá 50,000 dòng, chặn lại để không làm sập RAM
    if (result.meta.total > 50000) {
      throw new BadRequestException(
        'Lượng dữ liệu vượt quá 50.000 dòng. Vui lòng thu hẹp khoảng thời gian hoặc thêm bộ lọc.',
      );
    }

    const orders = result.data;

    // 4. Khởi tạo Excel Workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Báo Cáo Đơn Hàng');

    // 5. Thiết lập độ rộng cột
    sheet.getColumn(1).width = 20; // Mã đơn
    sheet.getColumn(2).width = 25; // Ngày tạo
    sheet.getColumn(3).width = 30; // Khách hàng
    sheet.getColumn(4).width = 18; // SĐT
    sheet.getColumn(5).width = 20; // Trạng thái
    sheet.getColumn(6).width = 20; // Thanh toán
    sheet.getColumn(7).width = 20; // Tổng tiền

    // 6. Tiêu đề báo cáo
    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'BÁO CÁO TỔNG HỢP DANH SÁCH ĐƠN HÀNG';
    titleCell.font = {
      name: 'Arial',
      size: 14,
      bold: true,
      color: { argb: 'FF1976D2' }, // Xanh dương đồng bộ với FE OrderManagement
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    // 7. Thông tin phụ (Kỳ báo cáo)
    sheet.mergeCells('A2:G2');
    const infoCell = sheet.getCell('A2');

    const startDateStr = queryDto.fromDate
      ? new Date(queryDto.fromDate).toLocaleDateString('vi-VN')
      : 'Từ trước tới nay';
    const endDateStr = queryDto.toDate
      ? new Date(queryDto.toDate).toLocaleDateString('vi-VN')
      : 'Hiện tại';
    const nowStr = new Date().toLocaleString('vi-VN');

    // FIX LỖI "unused-vars": Nối tên và email người xuất vào chuỗi báo cáo
    infoCell.value = `Kỳ báo cáo: ${startDateStr} - ${endDateStr}  |  Ngày xuất: ${nowStr}  |  Người xuất: ${exporterName} (${exporterEmail})`;
    infoCell.font = { name: 'Arial', size: 10, italic: true };
    infoCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.addRow([]);

    // 8. Render Header Table
    const headerRow = sheet.addRow([
      'Mã Đơn Hàng',
      'Ngày Đặt',
      'Tên Khách Hàng',
      'Số Điện Thoại',
      'Trạng Thái',
      'Thanh Toán',
      'Tổng Tiền (VNĐ)',
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

    // 9. Đổ dữ liệu vào bảng
    if (orders.length > 0) {
      type ExportOrderDoc = {
        order_code: string;
        createdAt?: Date | string | number;
        status: string;
        total_amount: number;
        shipping_info?: { name?: string; phone?: string };
        guest_info?: { name?: string; phone?: string };
        payment?: { status?: string };
      };

      orders.forEach((order) => {
        const orderDoc = order as unknown as ExportOrderDoc;

        const customerName =
          orderDoc.shipping_info?.name || orderDoc.guest_info?.name || 'N/A';
        const customerPhone =
          orderDoc.shipping_info?.phone || orderDoc.guest_info?.phone || 'N/A';
        const orderDate = orderDoc.createdAt
          ? new Date(orderDoc.createdAt).toLocaleString('vi-VN')
          : 'N/A';

        const row = sheet.addRow([
          orderDoc.order_code,
          orderDate,
          customerName,
          customerPhone,
          orderDoc.status,
          orderDoc.payment?.status || 'PENDING',
          orderDoc.total_amount || 0,
        ]);

        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Arial', size: 10 };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };

          let align: 'left' | 'center' | 'right' = 'left';
          if (colNumber === 7) align = 'right';
          if ([4, 5, 6].includes(colNumber)) align = 'center';

          cell.alignment = {
            vertical: 'middle',
            horizontal: align,
            wrapText: true,
          };

          if (colNumber === 7) {
            cell.numFmt = '#,##0';
          }

          if (
            colNumber === 5 &&
            ['CANCELLED', 'REFUNDED', 'REFUND_PENDING'].includes(
              String(orderDoc.status),
            )
          ) {
            cell.font = {
              name: 'Arial',
              size: 10,
              color: { argb: 'FFD32F2F' },
            };
          }
        });
      });
    }

    // 10. Cấu hình Header và Stream file về Frontend
    const exportDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `BaoCao_DonHang_${exportDate}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    return workbook.xlsx.write(res);
  }

  //US.122: CHI TIẾT ĐƠN HÀNG
  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Đơn hàng không tồn tại');
    }
    const order = await this.orderModel
      .findById(id)
      .populate('user_id', 'name email phone avatar first_name last_name')
      .exec();
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    return order;
  }

  // 1. Thêm Helper giả lập tính Voucher (Hoặc Inject VoucherService thật vào đây)
  private async applyVoucher(
    originalTotal: number,
    code?: string,
    userId?: string | null,
    items?: OrderItem[],
  ): Promise<{ finalTotal: number; discount: number }> {
    if (!code) return { finalTotal: originalTotal, discount: 0 };

    // 1. Query DB tìm Voucher
    const voucher = await this.connection
      .collection<Voucher>('coupons') // Đổi 'promotions' thành 'coupons'
      .findOne({
        code: code.toUpperCase(),
        status: 'ACTIVE',
        is_deleted: false,
        start_date: { $lte: new Date() },
        end_date: { $gte: new Date() },
      });

    if (!voucher) {
      throw new BadRequestException('Mã giảm giá không hợp lệ hoặc đã hết hạn');
    }

    // [FIX LỖI TYPESCRIPT & ESLINT]:
    // Khai báo type mở rộng để bổ sung các thuộc tính có trong DB nhưng chưa có trong interface Voucher
    type ExtendedVoucher = Voucher & {
      user_usage_limit?: number;
      applicable_category_ids?: string[];
    };
    // Ép kiểu an toàn
    const extendedVoucher = voucher as ExtendedVoucher;

    if (userId) {
      const usedCountByUser = await this.orderModel.countDocuments({
        user_id: new Types.ObjectId(userId),
        voucher_code: code.toUpperCase(),
        status: {
          $nin: [
            'CANCELLED',
            'TEMPORARY',
            'REFUND_PENDING',
            'REFUNDED',
            'RETURNED',
          ],
        },
      });

      // Sử dụng extendedVoucher thay cho voucher để TypeScript không báo lỗi
      const limitPerUser = extendedVoucher.user_usage_limit || 1;

      if (usedCountByUser >= limitPerUser) {
        throw new BadRequestException(
          `Bạn đã vượt quá giới hạn sử dụng mã này (${limitPerUser} lần/người).`,
        );
      }
    }

    // 2. LOGIC CHECK DANH MỤC (SCOPE)
    if (
      items &&
      extendedVoucher.applicable_category_ids &&
      extendedVoucher.applicable_category_ids.length > 0
    ) {
      const productIds = items.map((i) => i.product_id);

      // Tìm các sản phẩm trong giỏ hàng có thuộc danh mục được khuyến mãi không
      const validProducts = await this.productModel
        .find({
          _id: { $in: productIds },
          categories: { $in: extendedVoucher.applicable_category_ids },
        })
        .select('_id')
        .lean();

      const validProductIds = validProducts.map((p) => p._id.toString());

      // Tính tổng tiền của CÁC SẢN PHẨM HỢP LỆ thôi
      const eligibleAmount = items.reduce((sum, item) => {
        if (validProductIds.includes(item.product_id.toString())) {
          return sum + item.price * item.quantity;
        }
        return sum;
      }, 0);

      if (eligibleAmount < (extendedVoucher.min_order_value || 0)) {
        throw new BadRequestException(
          `Mã này chỉ áp dụng cho sản phẩm thuộc danh mục quy định (Tối thiểu ${extendedVoucher.min_order_value}đ).`,
        );
      }
    } else {
      // Logic check giá trị tối thiểu thông thường
      if (
        extendedVoucher.min_order_value !== undefined &&
        originalTotal < extendedVoucher.min_order_value
      ) {
        throw new BadRequestException(
          `Đơn hàng chưa đủ ${extendedVoucher.min_order_value}đ để dùng mã này`,
        );
      }
    }

    if (
      extendedVoucher.usage_limit !== undefined &&
      extendedVoucher.usage_count >= extendedVoucher.usage_limit
    ) {
      throw new BadRequestException('Mã này đã hết lượt sử dụng');
    }

    // 3. Tính mức giảm
    let discount = 0;

    if (extendedVoucher.type === VoucherType.FIXED) {
      discount = extendedVoucher.value;
    } else if (extendedVoucher.type === VoucherType.PERCENT) {
      discount = Math.round(originalTotal * (extendedVoucher.value / 100));
      if (extendedVoucher.max_discount_amount != null) {
        discount = Math.min(discount, extendedVoucher.max_discount_amount);
      }
    }

    // 4. Không cho giảm quá tiền đơn hàng
    discount = Math.min(discount, originalTotal);

    return {
      finalTotal: originalTotal - discount,
      discount,
    };
  }

  // 1. INIT BUY NOW SESSION (Bắt buộc chạy trước khi tạo đơn Mua ngay)
  async createBuyNowSession(data: {
    productId: string;
    variantSku: string;
    quantity: number;
    userId?: string;
    guestSessionId?: string;
  }) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      // 1. XÁC ĐỊNH ĐỐI TƯỢNG (User hay Guest)
      const queryCriteria: FilterQuery<Order> = {
        status: 'TEMPORARY',
      };

      let hasIdentity = false;

      if (data.userId) {
        queryCriteria.user_id = new Types.ObjectId(data.userId);
        hasIdentity = true;
      } else if (data.guestSessionId) {
        queryCriteria.session_id = data.guestSessionId;
        hasIdentity = true;
      }
      //Xóa bỏ phiên "Mua ngay" cũ (Áp dụng cả User & Guest)
      if (hasIdentity) {
        const oldTempOrders = await this.orderModel
          .find(queryCriteria)
          .session(session);

        if (oldTempOrders.length > 0) {
          for (const oldOrder of oldTempOrders) {
            // A. Hoàn tồn kho
            for (const item of oldOrder.items) {
              await this.productModel
                .updateOne(
                  { _id: item.product_id, 'variants.sku': item.sku },
                  { $inc: { 'variants.$.stock': item.quantity } },
                )
                .session(session);
            }
            // B. Hủy đơn cũ
            oldOrder.status = 'CANCELLED';
            oldOrder.cancel_reason = 'Override by new Buy Now session';
            await oldOrder.save({ session });
          }
        }
      }
      // 2. TẠO PHIÊN MUA NGAY MỚI
      const product = await this.productModel
        .findById(data.productId)
        .session(session);

      if (!product || product.status !== ProductStatus.ACTIVE) {
        throw new BadRequestException('Sản phẩm không khả dụng');
      }

      //Check Min Purchase Qty (US.AC13)
      const minQty = product.min_purchase_qty || 1;
      if (data.quantity < minQty) {
        throw new BadRequestException(
          `Sản phẩm này bắt buộc mua tối thiểu ${minQty} cái.`,
        );
      }

      //Check Member Only
      if (product.is_member_only && !data.userId) {
        throw new BadRequestException('Sản phẩm này chỉ dành cho thành viên');
      }

      // [BỔ SUNG FIX 3]: Check Quà tặng độc quyền theo allowed_tiers
      if (product.allowed_tiers && product.allowed_tiers.length > 0) {
        if (!data.userId) {
          throw new BadRequestException(
            `Sản phẩm này là đặc quyền dành riêng cho hạng: ${product.allowed_tiers.join(', ')}`,
          );
        }

        // Lấy thông tin khách hàng để check tier
        const customerInfo = (await this.connection
          .collection('customers')
          .findOne({ _id: new Types.ObjectId(data.userId) })) as unknown as {
          loyalty?: { tier?: string };
        } | null;
        const userTierCode = customerInfo?.loyalty?.tier || 'SILVER';

        if (!product.allowed_tiers.includes(userTierCode)) {
          throw new BadRequestException(
            `Sản phẩm này là đặc quyền cho hạng ${product.allowed_tiers.join(', ')}. Bạn đang là hạng ${String(userTierCode)}.`,
          );
        }
      }

      //Check giới hạn mua
      if (product.max_purchase_qty && product.max_purchase_qty > 0) {
        if (data.quantity > product.max_purchase_qty) {
          throw new BadRequestException(
            `Sản phẩm này chỉ được mua tối đa ${product.max_purchase_qty} cái/lần.`,
          );
        }
      }

      const variant = product.variants.find((v) => v.sku === data.variantSku);
      if (!variant || !variant.active)
        throw new BadRequestException('Biến thể không hợp lệ');

      //Check tồn kho
      if (variant.stock < data.quantity) {
        throw new BadRequestException(`Hết hàng. Kho chỉ còn ${variant.stock}`);
      }

      let currentUnitPrice =
        variant.sale_price > 0 ? variant.sale_price : variant.price;

      // Kiểm tra Flash Sale đang Active
      const activeFlashSale = await this.flashSaleModel
        .findOne({
          status: FlashSaleStatus.ACTIVE,
          product_ids: product._id,
        })
        .session(session);

      if (activeFlashSale) {
        if (
          activeFlashSale.discount_type === FlashSaleDiscountType.PERCENTAGE
        ) {
          currentUnitPrice =
            currentUnitPrice -
            (currentUnitPrice * activeFlashSale.discount_value) / 100;
        } else {
          currentUnitPrice = activeFlashSale.discount_value;
        }
      }

      const rawItem = {
        productId: product._id.toString(),
        sku: variant.sku,
        quantity: data.quantity,
        unitPrice: currentUnitPrice > 0 ? currentUnitPrice : 0,
      };

      const { items: processedItems } = await this.promotionEngine.applyCombos([
        rawItem,
      ]);
      const finalItem = processedItems[0];
      const finalPrice = finalItem.discountedPrice || finalItem.unitPrice;

      //Trừ kho tạm thời (Hard Reserve)
      await this.stockService.holdStock(
        {
          product_id: product._id.toString(),
          sku: variant.sku,
          quantity: data.quantity,
        },
        session, // Truyền session vào để đảm bảo Transaction
      );

      //Tạo đơn tạm
      const holdExpiresAt = new Date(Date.now() + 15 * 60000);

      const randomSuffix = Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase();

      const tempOrder = new this.orderModel({
        order_code: `BUYNOW-${Date.now()}-${randomSuffix}`,
        user_id: data.userId ? new Types.ObjectId(data.userId) : null,
        session_id: data.userId ? undefined : data.guestSessionId,
        items: [
          {
            product_id: product._id,
            sku: variant.sku,
            product_name: product.name,
            price: finalPrice,
            quantity: data.quantity,
          },
        ],
        total_amount: finalPrice * data.quantity,
        discount_amount: (rawItem.unitPrice - finalPrice) * data.quantity,
        status: 'TEMPORARY',
        hold_expires_at: holdExpiresAt,
        payment: { method: 'UNKNOWN', status: 'PENDING' },
      });

      await tempOrder.save({ session });
      await session.commitTransaction();

      // Lưu Token vào Redis
      const token = `checkout_token_${tempOrder._id.toString()}_${randomUUID()}`;
      await this.redis.set(token, tempOrder._id.toString(), 'EX', 900);

      await this.auditLogsService.log({
        action: 'INIT_BUY_NOW_SESSION',
        collection_name: 'orders',
        department: Department.SALES,
        actor_id: data.userId || undefined,
        target_id: tempOrder._id,
        detail: {
          product_id: data.productId,
          quantity: data.quantity,
          session_id: data.guestSessionId,
          hold_expires_at: holdExpiresAt,
        },
      });

      //Lấy danh sách Upsell - AC15
      const upsellProducts = await this.productModel
        .find({
          categories: { $in: product.categories },
          _id: { $ne: product._id },
          status: ProductStatus.ACTIVE,
          stock: { $gt: 0 },
        })
        .sort({ price: 1 })
        .limit(2)
        .select('name thumbnail price sale_price slug')
        .lean();

      return { checkoutSessionToken: token, upsell_products: upsellProducts };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async initGuestCheckout(dto: InitGuestCheckoutDto) {
    // 1. VALIDATION CƠ BẢN
    if (!dto.shippingInfo.email) {
      throw new BadRequestException(
        'Vui lòng nhập Email để nhận mã xác thực (OTP).',
      );
    }

    // [AC11] Rate Limit - Chống Spam OTP
    const otpKey = `guest_otp:${dto.shippingInfo.email}`;
    const ttl = await this.redis.ttl(otpKey);
    if (ttl > 240) {
      throw new BadRequestException(
        'Vui lòng đợi 60 giây trước khi gửi lại mã mới.',
      );
    }

    // Lấy giỏ hàng
    const cart = await this.cartModel.findOne({
      session_id: dto.cartSessionId,
    });

    if (!cart || !cart.items.length) {
      throw new BadRequestException('Giỏ hàng trống hoặc hết hạn');
    }

    const productIds = cart.items.map((i) => i.product_id);
    const products = await this.productModel
      .find({ _id: { $in: productIds } })
      .select('name variants thumbnail price weight')
      .lean();

    // 2. LOGIC GIỮ HÀNG & TẠO ĐƠN TẠM (TRANSACTION)
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // A. Dọn dẹp đơn tạm cũ (Nếu khách F5 hoặc bấm lại)
      const oldOrder = await this.orderModel
        .findOne({
          session_id: dto.cartSessionId,
          status: 'TEMPORARY',
          isGuest: true,
        })
        .session(session);

      if (oldOrder) {
        // Hoàn kho cho đơn cũ
        for (const item of oldOrder.items) {
          await this.stockService.restock(
            {
              product_id: item.product_id.toString(),
              sku: item.sku,
              quantity: item.quantity,
            },
            session, // [FIX 1] Truyền session vào đây để đồng bộ Transaction
          );
        }
        await this.orderModel.deleteOne({ _id: oldOrder._id }).session(session);
      }

      // B. [AC8] Giữ hàng mới (Soft Allocation)
      for (const item of cart.items) {
        await this.stockService.holdStock(
          {
            product_id: item.product_id.toString(),
            sku: item.sku,
            quantity: item.quantity,
          },
          session, // Đã có session -> An toàn
        );
      }

      // C. TẠO ĐƠN HÀNG TẠM
      const orderItems = cart.items.map((cartItem) => {
        const product = products.find(
          (p) => p._id.toString() === cartItem.product_id.toString(),
        );

        // Fallback nếu không tìm thấy (dù khó xảy ra)
        if (!product) {
          throw new BadRequestException('Sản phẩm trong giỏ không hợp lệ');
        }

        // [BỔ SUNG FIX 3]: Chặn Guest mua quà độc quyền đang nằm trong giỏ
        if (product.allowed_tiers && product.allowed_tiers.length > 0) {
          throw new BadRequestException(
            `Sản phẩm "${product.name}" là quà tặng độc quyền, không hỗ trợ mua thanh toán cho khách vãng lai.`,
          );
        }

        // Tìm variant để lấy giá chính xác
        const variant = product.variants.find((v) => v.sku === cartItem.sku);
        const realPrice = variant ? variant.sale_price || variant.price : 0;
        const realImage = variant?.images?.[0] || product.thumbnail || '';

        return {
          product_id: cartItem.product_id,
          sku: cartItem.sku,
          quantity: cartItem.quantity,
          product_name: product.name || 'Sản phẩm không xác định',
          price: realPrice,
          image: realImage,
        };
      });

      const randomSuffix = Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase();

      const tempOrder = new this.orderModel({
        order_code: `GUEST-${Date.now()}-${randomSuffix}`,
        session_id: dto.cartSessionId,
        isGuest: true,
        status: 'TEMPORARY',
        hold_expires_at: new Date(Date.now() + 15 * 60000),
        items: orderItems,
        guest_info: {
          name: dto.shippingInfo.name,
          phone: dto.shippingInfo.phone,
          email: dto.shippingInfo.email,
        },
        shipping_info: dto.shippingInfo,
        total_amount: orderItems.reduce(
          (sum, i) => sum + i.price * i.quantity,
          0,
        ),
      });
      await tempOrder.save({ session });

      // Commit transaction
      await session.commitTransaction();
    } catch (error: unknown) {
      // Rollback tự động
      // Chỉ cần abort, MongoDB sẽ tự hoàn tác việc trừ kho ở bước B và bước A
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }

    // 3. XỬ LÝ OTP & PHẢN HỒI
    const existingUser = await this.connection
      .collection('users')
      .findOne({ email: dto.shippingInfo.email });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await this.redis.set(otpKey, otpCode, 'EX', 300);

    // Lưu info tạm (Optional)
    await this.redis.set(
      `guest_temp_info:${dto.cartSessionId}`,
      JSON.stringify(dto.shippingInfo),
      'EX',
      900,
    );

    // Gửi Email (Không await để tránh block response)
    this.emailService
      .sendOtp(dto.shippingInfo.email, otpCode)
      .catch((e) => console.error('Lỗi gửi mail OTP:', e));

    return {
      message: `Mã xác thực đã được gửi đến ${dto.shippingInfo.email}. Hàng được giữ trong 15 phút.`,
      user_exists: !!existingUser,
      otp_sent_to: dto.shippingInfo.email,
    };
  }

  async verifyGuestOtp(dto: VerifyGuestOtpDto) {
    const otpKey = `guest_otp:${dto.email}`;
    const storedOtp = await this.redis.get(otpKey);

    if (!storedOtp || storedOtp !== dto.otpCode) {
      throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn');
    }

    // Xác thực thành công -> Tạo token verified
    const verifiedKey = `guest_verified:${dto.cartSessionId}`;
    await this.redis.set(verifiedKey, 'TRUE', 'EX', 900);
    await this.redis.del(otpKey); // Xóa OTP cũ

    return {
      success: true,
      message: 'Xác thực thành công. Vui lòng tiến hành thanh toán.',
      verified_token: dto.cartSessionId,
    };
  }

  // 2. CREATE ORDER
  async createOrder(
    userId: string | null,
    dto: CreateOrderDto,
    ip: string,
    userAgent: string,
  ) {
    // 1. KHỞI TẠO TRANSACTION Ở NGAY ĐẦU HÀM CHO TẤT CẢ CÁC LUỒNG
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // A. LUỒNG MUA NGAY (BUY_NOW)
      if (dto.source === 'BUY_NOW') {
        if (!dto.checkoutSessionToken) {
          throw new BadRequestException('Thiếu Token phiên mua hàng');
        }

        const orderId = await this.redis.get(dto.checkoutSessionToken);
        if (!orderId) {
          throw new BadRequestException(
            'Phiên mua hàng đã hết hạn hoặc không tồn tại',
          );
        }

        const order = (await this.orderModel
          .findById(orderId)
          .session(session)) as unknown as MongooseOrderDoc;

        if (!order || order.status !== 'TEMPORARY') {
          throw new BadRequestException(
            'Đơn hàng không hợp lệ hoặc đã hết hạn giữ hàng',
          );
        }

        // 2. Tính phí vận chuyển
        const shippingFee = await this.shippingService.calculateShippingFee(
          dto.shippingInfo.city_code,
          dto.shippingInfo.district_code,
          order.items as unknown as (CartItem | OrderItem)[],
          dto.isInstant,
        );

        // 3. Kiểm tra trọng lượng
        const MAX_WEIGHT_KG = 50;
        let totalWeight = 0;
        for (const item of order.items) {
          const itemAny = item as unknown as { weight?: number };
          const w = itemAny.weight || 0.5;
          totalWeight += w * item.quantity;
        }

        if (totalWeight > MAX_WEIGHT_KG) {
          throw new BadRequestException(
            `Đơn hàng quá nặng (${totalWeight}kg). Vui lòng liên hệ hotline.`,
          );
        }

        // 4. Logic Voucher
        const { finalTotal: totalAfterVoucher, discount } =
          await this.applyVoucher(
            order.total_amount,
            dto.voucherCode,
            userId,
            order.items as unknown as OrderItem[],
          );

        let pointsDiscount = 0;
        if (dto.pointsToUse && dto.pointsToUse > 0) {
          pointsDiscount = dto.pointsToUse * 100; // Giả sử 1 điểm = 100đ
          if (pointsDiscount > totalAfterVoucher) {
            pointsDiscount = totalAfterVoucher; // Tránh âm tiền
          }
        }

        // 5. Tổng thanh toán
        const finalOrderTotal =
          totalAfterVoucher - pointsDiscount + shippingFee;

        // 6. Check COD Limit
        if (dto.paymentMethod === 'COD' && finalOrderTotal > 5000000) {
          throw new BadRequestException('Đơn hàng > 5 triệu không hỗ trợ COD.');
        }

        // 7. Cập nhật & Save
        order.shipping_info = {
          ...dto.shippingInfo,
          email: dto.shippingInfo.email || '',
          name: dto.shippingInfo.name || '',
          phone: dto.shippingInfo.phone || '',
          address: dto.shippingInfo.address || '',
          city_code: Number(dto.shippingInfo.city_code),
          district_code: Number(dto.shippingInfo.district_code),
          ward_code: dto.shippingInfo.ward_code || '',
        };

        if (!order.guest_info) {
          order.guest_info = {
            name: dto.shippingInfo.name || '',
            phone: dto.shippingInfo.phone || '',
            email: dto.shippingInfo.email || '',
          };
        } else {
          order.guest_info.email = dto.shippingInfo.email || '';
        }

        order.payment = {
          method: dto.paymentMethod,
          status: 'PENDING',
        };

        order.status = 'PENDING';
        order.hold_expires_at = undefined;
        order.total_amount = finalOrderTotal;
        order.shipping_fee = shippingFee;
        (
          order as unknown as MongooseOrderDoc & { points_used: number }
        ).points_used = dto.pointsToUse || 0;
        order.discount_amount = discount + pointsDiscount;
        order.voucher_code = dto.voucherCode || '';

        // 8. Xử lý Voucher (Sử dụng Transaction Session)
        if (dto.voucherCode) {
          const voucher = await this.connection
            .collection<Voucher>('coupons')
            .findOne({ code: dto.voucherCode }, { session });

          if (voucher) {
            if (voucher.usage_limit && voucher.usage_limit > 0) {
              const updateResult = await this.connection
                .collection('coupons')
                .updateOne(
                  {
                    code: dto.voucherCode,
                    usage_count: { $lt: voucher.usage_limit },
                  },
                  { $inc: { usage_count: 1 } },
                  { session },
                );

              if (updateResult.modifiedCount === 0) {
                throw new BadRequestException(
                  'Mã giảm giá đã hết lượt sử dụng ngay trong lúc bạn thanh toán.',
                );
              }

              if (voucher.usage_count + 1 >= voucher.usage_limit) {
                await this.connection
                  .collection('coupons')
                  .updateOne(
                    { code: dto.voucherCode },
                    { $set: { status: 'CANCELLED' } },
                    { session },
                  );
              }
            } else {
              await this.connection
                .collection('coupons')
                .updateOne(
                  { code: dto.voucherCode },
                  { $inc: { usage_count: 1 } },
                  { session },
                );
            }
          }
        }

        if (!order.timeline) {
          order.timeline = [];
        }

        order.timeline.push({
          status: 'PENDING',
          timestamp: new Date(),
          actor: userId ? 'Member' : 'Guest',
          note: `BuyNow Order Created. Ship: ${shippingFee}`,
        });

        await order.save({ session }); // BẮT BUỘC TRUYỀN SESSION

        // Tính số tiền dùng để cộng điểm (Tổng tiền đơn - Phí vận chuyển)
        const pointEarnAmount = order.total_amount - (order.shipping_fee || 0);

        // Nếu là khách hàng thành viên (không phải Guest) và tiền mua hàng > 0 thì ghi nhận điểm PENDING
        if (order.user_id && !order.isGuest && pointEarnAmount > 0) {
          await this.loyaltyService.addPendingPoints(
            String(order.user_id),
            String(order._id),
            pointEarnAmount,
          );
        }

        if (userId && dto.pointsToUse && dto.pointsToUse > 0) {
          await this.connection
            .collection('users')
            .updateOne(
              { _id: new Types.ObjectId(userId) },
              { $inc: { 'loyalty.point': -dto.pointsToUse } },
              { session },
            );
        }

        // CHỐT TRANSACTION THÀNH CÔNG CHO LUỒNG MUA NGAY
        await session.commitTransaction();

        await this.redis.del(dto.checkoutSessionToken);

        // Tự động lấy cấu hình tạo Link theo phương thức
        let paymentUrl: string | null = null;
        if (order.payment.method !== 'COD') {
          paymentUrl = await this.paymentService.createPaymentUrl(
            order.payment.method,
            {
              orderCode: order.order_code,
              amount: order.total_amount,
              description: `Thanh toan don hang ${order.order_code}`,
              ipAddr: ip,
            },
          );
        }

        const emailToSend =
          order.guest_info?.email || order.shipping_info?.email;
        if (emailToSend) {
          this.emailService
            .sendInvoice(emailToSend, order as unknown as InvoiceOrder)
            .catch((err: unknown) => {
              const msg = err instanceof Error ? err.message : String(err);
              this.logger.error(`Failed to send invoice email: ${msg}`);
            });
        }
        await this.logCreateOrder(userId, order, dto.source, ip, userAgent);

        this.eventEmitter.emit(NOTIFY_EVENTS.ORDER_CREATED, order);

        return {
          order: order,
          paymentUrl: paymentUrl,
          message: 'Tạo đơn hàng thành công',
        };
      }

      // B. LUỒNG MUA TỪ GIỎ HÀNG (CART)
      let savedOrder: MongooseOrderDoc;

      // CASE 1: KHÁCH VÃNG LAI (GUEST)
      if (!userId && dto.guestSessionId) {
        const isVerified = await this.redis.get(
          `guest_verified:${dto.guestSessionId}`,
        );
        if (!isVerified) {
          throw new BadRequestException(
            'Phiên giao dịch chưa được xác thực hoặc đã hết hạn.',
          );
        }

        // Lấy đơn hàng tạm đã được tạo ở bước initGuestCheckout (Đã Hold kho sẵn)
        const tempOrder = (await this.orderModel
          .findOne({
            session_id: dto.guestSessionId,
            status: 'TEMPORARY',
            isGuest: true,
          })
          .session(session)) as unknown as MongooseOrderDoc;

        if (!tempOrder) {
          throw new BadRequestException(
            'Không tìm thấy phiên đặt hàng (Hết hạn giữ hàng). Vui lòng thử lại.',
          );
        }

        const confirmedItems = tempOrder.items as unknown as OrderItem[];
        let reCalcTotal = 0;
        for (const item of confirmedItems) {
          reCalcTotal += item.price * item.quantity;
        }

        const shippingFeeGuest =
          await this.shippingService.calculateShippingFee(
            dto.shippingInfo?.city_code,
            dto.shippingInfo?.district_code,
            confirmedItems,
            dto.isInstant,
          );

        const {
          finalTotal: totalAfterVoucherGuest,
          discount: voucherDiscountGuest,
        } = await this.applyVoucher(
          reCalcTotal,
          dto.voucherCode,
          userId,
          confirmedItems,
        );

        const finalOrderTotalGuest = totalAfterVoucherGuest + shippingFeeGuest;

        if (dto.paymentMethod === 'COD' && finalOrderTotalGuest > 5000000) {
          throw new BadRequestException('Đơn hàng > 5 triệu không hỗ trợ COD.');
        }

        const randomSuffix = Math.random()
          .toString(36)
          .substring(2, 6)
          .toUpperCase();

        // Cập nhật lại thông tin từ đơn tạm thành đơn chính thức
        tempOrder.order_code = `ORD-${Date.now()}-${randomSuffix}`;
        tempOrder.shipping_info = {
          ...dto.shippingInfo,
          email: dto.shippingInfo.email || '',
          name: dto.shippingInfo.name || '',
          phone: dto.shippingInfo.phone || '',
          address: dto.shippingInfo.address || '',
          city_code: Number(dto.shippingInfo.city_code),
          district_code: Number(dto.shippingInfo.district_code),
          ward_code: dto.shippingInfo.ward_code || '',
        };
        tempOrder.guest_info = {
          name: dto.shippingInfo.name || '',
          phone: dto.shippingInfo.phone || '',
          email: dto.shippingInfo.email || '',
        };
        tempOrder.payment = {
          method: dto.paymentMethod,
          status: 'PENDING',
        };
        tempOrder.total_amount = finalOrderTotalGuest;
        tempOrder.discount_amount =
          (tempOrder.discount_amount || 0) + (voucherDiscountGuest || 0);
        tempOrder.shipping_fee = shippingFeeGuest;
        tempOrder.voucher_code = dto.voucherCode || '';
        tempOrder.status = 'PENDING';
        tempOrder.hold_expires_at = undefined; // BỔ SUNG DÒNG NÀY ĐỂ XÓA HẸN GIỜ HỦY ĐƠN

        if (!tempOrder.timeline) tempOrder.timeline = [];
        tempOrder.timeline.push({
          status: 'PENDING',
          timestamp: new Date(),
          actor: 'Guest',
          note: 'Guest confirmed order via Cart (OTP Verified)',
        });

        await tempOrder.save({ session });
        savedOrder = tempOrder as unknown as MongooseOrderDoc;

        await this.cartModel
          .deleteOne({ session_id: dto.guestSessionId })
          .session(session);
      }

      // CASE 2: KHÁCH THÀNH VIÊN (MEMBER)
      else if (userId) {
        const cart = await this.cartModel
          .findOne({ user_id: new Types.ObjectId(userId) })
          .session(session);
        if (!cart || !cart.items.length) {
          throw new BadRequestException('Giỏ hàng trống.');
        }

        const orderItems: OrderItem[] = [];
        let itemsTotalAmount = 0;
        let totalWeight = 0;

        for (const item of cart.items) {
          const product = await this.productModel
            .findById(item.product_id)
            .session(session);

          if (!product || product.status !== ProductStatus.ACTIVE) {
            throw new BadRequestException(
              `Sản phẩm ${item.sku} không khả dụng`,
            );
          }

          // CHỈ CÓ LUỒNG MEMBER MỚI GỌI HOLD KHO TẠI ĐÂY
          await this.stockService.holdStock(
            {
              product_id: item.product_id.toString(),
              sku: item.sku,
              quantity: item.quantity,
            },
            session,
          );

          if (
            product.max_purchase_qty &&
            item.quantity > product.max_purchase_qty
          ) {
            throw new BadRequestException(
              `Quá giới hạn mua ${product.max_purchase_qty}.`,
            );
          }

          let availableStock = 0;
          let currentPrice = 0;

          // Bổ sung logic rẽ nhánh cho Sản phẩm có biến thể và Sản phẩm đơn
          if (product.has_variants) {
            const variant = product.variants.find((v) => v.sku === item.sku);
            if (!variant)
              throw new BadRequestException(`Lỗi biến thể ${item.sku}`);

            availableStock = variant.stock;
            currentPrice =
              variant.sale_price > 0 ? variant.sale_price : variant.price;
          } else {
            if (product.sku !== item.sku)
              throw new BadRequestException(`Mã SKU không hợp lệ ${item.sku}`);

            availableStock = product.stock;
            currentPrice =
              product.sale_price > 0 ? product.sale_price : product.price;
          }

          if (availableStock < item.quantity) {
            throw new BadRequestException(`Sản phẩm ${product.name} hết hàng.`);
          }

          const productWithWeight = product as unknown as { weight?: number };
          const weight = productWithWeight.weight || 0.5;
          totalWeight += weight * item.quantity;

          // Xử lý giá Flash Sale
          const activeFlashSale = await this.flashSaleModel
            .findOne({
              status: FlashSaleStatus.ACTIVE,
              product_ids: product._id,
            })
            .session(session);

          if (activeFlashSale) {
            if (
              activeFlashSale.discount_type === FlashSaleDiscountType.PERCENTAGE
            ) {
              currentPrice =
                currentPrice -
                (currentPrice * activeFlashSale.discount_value) / 100;
            } else {
              currentPrice = activeFlashSale.discount_value;
            }
            currentPrice = currentPrice > 0 ? currentPrice : 0;
          }

          const mainImage = product.images?.[0] || '';

          orderItems.push({
            product_id: product._id,
            sku: item.sku,
            product_name: product.name,
            price: currentPrice,
            quantity: item.quantity,
            image: mainImage,
          });
        }

        if (totalWeight > 50) {
          throw new BadRequestException(
            `Đơn hàng quá nặng (${totalWeight}kg).`,
          );
        }

        // Xử lý Combo
        const itemsForPromo = orderItems.map((i) => ({
          productId: i.product_id.toString(),
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: i.price,
        }));

        const { items: discountedItems, totalDiscount: promoDiscount } =
          await this.promotionEngine.applyCombos(itemsForPromo);

        for (const item of orderItems) {
          const promoItem = discountedItems.find(
            (d) =>
              d.productId.toString() === item.product_id.toString() &&
              d.sku === item.sku,
          );

          if (promoItem) {
            item.price = promoItem.discountedPrice || promoItem.unitPrice;
          }
          itemsTotalAmount += item.price * item.quantity;
        }

        const shippingFee = await this.shippingService.calculateShippingFee(
          dto.shippingInfo?.city_code,
          dto.shippingInfo?.district_code,
          orderItems,
          dto.isInstant,
        );

        const { finalTotal: totalAfterVoucher, discount: voucherDiscount } =
          await this.applyVoucher(
            itemsTotalAmount,
            dto.voucherCode,
            userId,
            orderItems,
          );

        // TÍNH ĐIỂM SỬ DỤNG
        let pointsDiscount = 0;
        if (dto.pointsToUse && dto.pointsToUse > 0) {
          pointsDiscount = dto.pointsToUse * 100;
          if (pointsDiscount > totalAfterVoucher)
            pointsDiscount = totalAfterVoucher;
        }

        const finalOrderTotal =
          totalAfterVoucher - pointsDiscount + shippingFee;

        if (dto.paymentMethod === 'COD' && finalOrderTotal > 5000000) {
          throw new BadRequestException('Đơn hàng > 5 triệu không hỗ trợ COD.');
        }

        const randomSuffix = Math.random()
          .toString(36)
          .substring(2, 6)
          .toUpperCase();

        const newOrder = new this.orderModel({
          order_code: `ORD-${Date.now()}-${randomSuffix}`,
          user_id: new Types.ObjectId(userId),
          items: orderItems,
          shipping_info: {
            ...dto.shippingInfo,
            email: dto.shippingInfo.email || '',
            name: dto.shippingInfo.name || '',
            phone: dto.shippingInfo.phone || '',
            address: dto.shippingInfo.address || '',
          },
          payment: {
            method: dto.paymentMethod,
            status: 'PENDING',
          },
          total_amount: finalOrderTotal,
          discount_amount:
            promoDiscount + (voucherDiscount || 0) + pointsDiscount,
          shipping_fee: shippingFee,
          voucher_code: dto.voucherCode || '',
          points_used: dto.pointsToUse || 0,
          status: 'PENDING',
          isGuest: false,
          timeline: [
            {
              status: 'PENDING',
              timestamp: new Date(),
              actor: 'Member',
              note: 'Member created order',
            },
          ],
        }) as unknown as MongooseOrderDoc;

        await newOrder.save({ session });
        savedOrder = newOrder;

        // AC1: Điểm thưởng ghi nhận trên giá trị thực trả (Không bao gồm Ship)
        await this.loyaltyService.addPendingPoints(
          userId,
          String(newOrder._id),
          totalAfterVoucher - pointsDiscount,
        );

        // NẾU CÓ DÙNG ĐIỂM -> TRỪ ĐIỂM CỦA USER NGAY LẬP TỨC
        if (pointsDiscount > 0) {
          await this.connection
            .collection('users')
            .updateOne(
              { _id: new Types.ObjectId(userId) },
              { $inc: { 'loyalty.point': -(dto.pointsToUse || 0) } },
              { session },
            );
        }

        await this.cartModel.deleteOne({ _id: cart._id }).session(session);
      } else {
        throw new BadRequestException('Không xác định được danh tính.');
      }

      // C. TRỪ LƯỢT SỬ DỤNG VOUCHER (Chung cho Cart Guest & Member)
      if (dto.voucherCode) {
        const voucher = await this.connection
          .collection<Voucher>('coupons')
          .findOne({ code: dto.voucherCode }, { session });

        if (voucher) {
          if (voucher.usage_limit && voucher.usage_limit > 0) {
            const updateResult = await this.connection
              .collection('coupons')
              .updateOne(
                {
                  code: dto.voucherCode,
                  usage_count: { $lt: voucher.usage_limit },
                },
                { $inc: { usage_count: 1 } },
                { session },
              );

            if (updateResult.modifiedCount === 0) {
              throw new BadRequestException(
                'Mã giảm giá đã hết lượt sử dụng ngay trong lúc bạn thanh toán.',
              );
            }

            if (voucher.usage_count + 1 >= voucher.usage_limit) {
              await this.connection
                .collection('coupons')
                .updateOne(
                  { code: dto.voucherCode },
                  { $set: { status: 'CANCELLED' } },
                  { session },
                );
            }
          } else {
            await this.connection
              .collection('coupons')
              .updateOne(
                { code: dto.voucherCode },
                { $inc: { usage_count: 1 } },
                { session },
              );
          }
        }
      }

      // CHỐT TRANSACTION THÀNH CÔNG CHO LUỒNG GIỎ HÀNG
      await session.commitTransaction();

      // D. CÁC TÁC VỤ SAU KHI TẠO ĐƠN THÀNH CÔNG
      if (!userId && dto.guestSessionId) {
        await this.redis.del(`guest_verified:${dto.guestSessionId}`);
        await this.redis.del(`guest_temp_info:${dto.guestSessionId}`);
      }

      let paymentUrl: string | null = null;
      if (savedOrder.payment.method !== 'COD') {
        paymentUrl = await this.paymentService.createPaymentUrl(
          savedOrder.payment.method,
          {
            orderCode: savedOrder.order_code,
            amount: savedOrder.total_amount,
            description: `Thanh toan don hang ${savedOrder.order_code}`,
            ipAddr: ip,
          },
        );
      }

      const recipientEmail = dto.shippingInfo.email;
      if (recipientEmail) {
        this.emailService
          .sendInvoice(recipientEmail, savedOrder as unknown as InvoiceOrder)
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to send invoice email: ${msg}`);
          });
      }

      await this.logCreateOrder(userId, savedOrder, dto.source, ip, userAgent);

      this.eventEmitter.emit(NOTIFY_EVENTS.ORDER_CREATED, savedOrder);

      return {
        order: savedOrder,
        paymentUrl: paymentUrl,
        message: 'Tạo đơn hàng thành công',
      };
    } catch (error: unknown) {
      // NẾU CÓ LỖI, TOÀN BỘ LOGIC KHO, VOUCHER, ĐƠN HÀNG SẼ BỊ HOÀN TÁC
      await session.abortTransaction();

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await this.auditLogsService.log({
        action: 'CREATE_ORDER_FAILED',
        collection_name: 'orders',
        actor_id: userId || undefined,
        department: Department.SALES,
        detail: { error: errorMessage },
        is_success: false,
        ip: ip,
        user_agent: userAgent,
      });

      throw error;
    } finally {
      // ĐÓNG KẾT NỐI TRANSACTION
      await session.endSession();
    }
  }

  // US.123: CẬP NHẬT TRẠNG THÁI (STATE MACHINE) ĐÃ FIX BUG LINT
  async updateStatusAdvanced(
    id: string,
    dto: UpdateOrderStatusDto,
    actorId: string,
    actorName: string,
    ip: string,
    userAgent: string,
  ): Promise<OrderData> {
    const session = await this.connection.startSession();
    session.startTransaction();

    let orderDoc: OrderData;
    let oldStatus: OrderStatus;
    const nextStatus = dto.status as OrderStatus;

    try {
      const order = await this.orderModel.findById(id).session(session);
      if (!order) throw new NotFoundException('Đơn hàng không tìm thấy');

      oldStatus = order.status as OrderStatus;
      let finalStatusToSave = nextStatus;

      // 1. VALIDATE TRẠNG THÁI
      await this.stateMachine.validateTransition(
        order as unknown as MongooseOrderDoc,
        nextStatus,
        dto.is_override ?? false,
        dto.reason,
      );

      if (
        nextStatus === OrderStatus.PROCESSING &&
        oldStatus !== OrderStatus.PROCESSING
      ) {
        for (const item of order.items) {
          await this.stockService.finalizeDeduction(
            {
              product_id: item.product_id.toString(),
              sku: item.sku,
              quantity: item.quantity,
            },
            session,
          );
        }
      }

      // 2. LOGIC HỦY ĐƠN & HOÀN TỒN KHO
      if (
        nextStatus === OrderStatus.CANCELLED &&
        oldStatus !== OrderStatus.CANCELLED
      ) {
        // Danh sách trạng thái "Hàng chưa ra khỏi cửa kho"
        const canAutoRestock = [
          OrderStatus.TEMPORARY,
          OrderStatus.PENDING,
          OrderStatus.CONFIRMED,
          OrderStatus.READY_TO_SHIP,
          OrderStatus.PRIORITY,
          OrderStatus.TRADE_IN_REVIEW,
        ].includes(oldStatus);

        if (canAutoRestock) {
          // Dùng StockService để giải phóng cả stock_on_hold
          for (const item of order.items) {
            await this.stockService.restock(
              {
                product_id: item.product_id.toString(),
                sku: item.sku,
                quantity: item.quantity,
              },
              session,
            );
          }
        } else {
          order.internal_note = `[CẢNH BÁO]: Đơn hủy khi đang giao. Cần kiểm tra hàng thực tế trước khi hoàn kho.`;
        }

        // Bẻ lái sang REFUND_PENDING nếu đã thanh toán Online
        if (order.payment.status === 'PAID' && order.payment.method !== 'COD') {
          finalStatusToSave = OrderStatus.REFUND_PENDING;
        }
        order.cancel_reason = dto.reason || 'Hủy bởi Admin';

        // [BỔ SUNG FIX 2]: HOÀN TRẢ LẠI ĐIỂM KHÁCH ĐÃ TIÊU
        const orderWithPoints = order as unknown as MongooseOrderDoc & {
          points_used?: number;
        };
        if (
          orderWithPoints.user_id &&
          !orderWithPoints.isGuest &&
          orderWithPoints.points_used &&
          orderWithPoints.points_used > 0
        ) {
          await this.connection.collection('users').updateOne(
            { _id: new Types.ObjectId(String(orderWithPoints.user_id)) },
            {
              $inc: { 'loyalty.point': Number(orderWithPoints.points_used) },
            },
            { session },
          );

          await this.loyaltyHistoryModel.create({
            user_id: orderWithPoints.user_id,
            order_id: order._id,
            points: Number(orderWithPoints.points_used),
            action: 'REVOKE',
            reason: 'Hủy đơn hàng',
          });
        }

        if (order.user_id && !order.isGuest) {
          await this.loyaltyService.cancelPendingPoints(
            String(order.user_id),
            String(order._id),
          );
        }
      }

      // 2.5 LOGIC TRẢ HÀNG TỪNG PHẦN (AC15)
      if (
        nextStatus === OrderStatus.RETURNED &&
        oldStatus !== OrderStatus.RETURNED
      ) {
        finalStatusToSave = OrderStatus.RETURNED;
        order.internal_note = dto.note || 'Khách hàng trả lại sản phẩm.';

        if (order.user_id && !order.isGuest) {
          // Ép kiểu an toàn (Safe Type Casting) để bypass lỗi ESLint no-unsafe-assignment
          const safeDto = dto as unknown as { refund_amount?: number };

          // Tính toán số tiền hoàn dựa trên Dto truyền lên (Nếu ko truyền thì tính cả đơn)
          const refundValue = safeDto.refund_amount || order.total_amount;

          await this.loyaltyService.revokePointsForRefund(
            String(order.user_id),
            String(order._id),
            Number(refundValue), // Ép kiểu dứt khoát về Number để tránh lỗi no-unsafe-argument
          );
        }
      }

      // 3. LOGIC ADMIN OVERRIDE (KHÔI PHỤC ĐƠN HỦY)
      const isReversingCancel =
        (oldStatus === OrderStatus.CANCELLED ||
          oldStatus === OrderStatus.REFUND_PENDING) &&
        nextStatus === OrderStatus.PENDING;

      if (isReversingCancel && dto.is_override) {
        // Khi Admin khôi phục, phải trừ lại kho (Hold hàng lại)
        for (const item of order.items) {
          await this.stockService.holdStock(
            {
              product_id: item.product_id.toString(),
              sku: item.sku,
              quantity: item.quantity,
            },
            session,
          );
        }
        order.cancel_reason = undefined;
        order.waybill_code = '';
        order.actual_shipping_fee = 0;
        order.internal_note = `[OVERRIDE]: Admin khôi phục đơn hàng.`;

        // Khôi phục lại trạng thái PENDING cho bản ghi điểm thưởng bị hủy trước đó
        if (order.user_id && !order.isGuest) {
          await this.loyaltyHistoryModel.updateMany(
            {
              customer_id: order.user_id,
              order_id: order._id,
              status: PointStatus.CANCELED,
            },
            {
              $set: {
                status: PointStatus.PENDING,
                description: `Khôi phục điểm chờ duyệt do Admin khôi phục đơn ${order.order_code}`,
              },
            },
            { session },
          );
        }
      }

      // 4. XỬ LÝ SHIPPING THỦ CÔNG
      if (nextStatus === OrderStatus.SHIPPING && !order.waybill_code) {
        if (!dto.shipping_provider || !dto.tracking_code) {
          throw new BadRequestException(
            'Bắt buộc có ĐVVC và Mã vận đơn để chuyển sang SHIPPING',
          );
        }
        order.shipping_info.provider = dto.shipping_provider;
        order.shipping_info.tracking_code = dto.tracking_code;
        order.waybill_code = dto.tracking_code;
      }

      // 5. CẬP NHẬT TRẠNG THÁI & LƯU DB
      order.status = finalStatusToSave;
      if (dto.note) order.internal_note = dto.note;

      if (
        (finalStatusToSave === OrderStatus.DELIVERED ||
          finalStatusToSave === OrderStatus.COMPLETED) &&
        order.payment.status === 'PENDING'
      ) {
        order.payment.status = 'PAID';
        if (!order.timeline) order.timeline = [];
        order.timeline.push({
          status: finalStatusToSave,
          timestamp: new Date(),
          actor: 'SYSTEM_FIREFIGHTING',
          note: `Tự động ghi nhận thanh toán thành công (PAID) khi đơn hàng chuyển sang ${finalStatusToSave}.`,
        });
      }

      this.stateMachine.addTimeline(
        order as unknown as MongooseOrderDoc,
        finalStatusToSave,
        actorName,
        dto.reason || dto.note,
      );

      // [TỐI ƯU BE]: Dùng updateOne thay vì order.save() để tránh VersionError của Mongoose
      const updatePayload = {
        $set: {
          status: finalStatusToSave,
          'payment.status': order.payment.status,
          timeline: order.timeline,
          cancel_reason: order.cancel_reason,
          internal_note: order.internal_note,
          waybill_code: order.waybill_code,
          actual_shipping_fee: order.actual_shipping_fee,
        } as Record<string, unknown>,
      };

      // Xóa các key undefined để updateOne không bị lỗi null exception
      Object.keys(updatePayload.$set).forEach((key) => {
        if (updatePayload.$set[key] === undefined) {
          delete updatePayload.$set[key];
        }
      });

      await this.orderModel.updateOne({ _id: order._id }, updatePayload, {
        session,
      });
      await session.commitTransaction();

      orderDoc = order.toObject() as unknown as OrderData;
      const validActorId = Types.ObjectId.isValid(actorId) ? actorId : null;

      // 6. AUDIT LOG & EVENTS (Bắn sau khi commit thành công)
      await this.auditLogsService.log({
        action: dto.is_override ? 'OVERRIDE_STATUS' : 'UPDATE_STATUS',
        collection_name: 'orders',
        actor_id: validActorId,
        target_id: String(order._id),
        department: Department.SALES,
        detail: { old: oldStatus, new: finalStatusToSave },
        ip,
        user_agent: userAgent,
        is_success: true,
      });

      this.handleOrderEvents(finalStatusToSave, orderDoc);

      return orderDoc;
    } catch (error: unknown) {
      // 1. Luôn abort transaction trước
      await session.abortTransaction();

      // 2. Kiểm tra kiểu dữ liệu của error để lấy message an toàn
      const finalErrorMsg =
        error instanceof Error ? error.message : 'Lỗi hệ thống không xác định';

      // 3. Throw exception với message đã được xử lý
      throw new BadRequestException(finalErrorMsg);
    } finally {
      await session.endSession();
    }
  }

  // HELPER: Tách riêng logic bắn event để code chính sạch hơn
  private handleOrderEvents(status: OrderStatus, orderDoc: OrderData) {
    // Tự động đẩy đơn sang GHN/GHTK
    if (status === OrderStatus.READY_TO_SHIP && !orderDoc.waybill_code) {
      this.eventEmitter.emit('order.ready_to_ship', orderDoc);
    }

    // Hủy vận đơn trên hệ thống ĐVVC
    if (status === OrderStatus.CANCELLED && orderDoc.waybill_code) {
      this.eventEmitter.emit('order.cancelled_shipping', orderDoc);
    }

    if (status === OrderStatus.RETURNED) {
      this.eventEmitter.emit('order.refund_shipping_needed', orderDoc);
    }

    // Đổi điều kiện kích hoạt cộng điểm thành DELIVERED
    if (
      status === OrderStatus.DELIVERED &&
      orderDoc.user_id &&
      !orderDoc.isGuest
    ) {
      this.eventEmitter.emit('order.completed', {
        // Bạn có thể cân nhắc đổi tên event này sau nếu muốn
        orderId: String(orderDoc._id),
        userId: String(orderDoc.user_id),
        totalAmount: orderDoc.total_amount,
      });

      // [TÍCH HỢP LOYALTY]: Xác nhận chuyển điểm từ PENDING sang AVAILABLE
      this.loyaltyService
        .confirmPendingPoints(String(orderDoc.user_id), String(orderDoc._id))
        .catch((e) => this.logger.error('Lỗi duyệt điểm Loyalty:', e));
    }

    // 1. Luồng hoàn tiền
    if (status === OrderStatus.REFUND_PENDING) {
      // Bắn event để các module khác (Loyalty, Inventory) biết
      this.eventEmitter.emit('order.refund_requested', orderDoc);

      // Gửi mail trực tiếp cho Kế toán
      const accountingEmail =
        process.env.ACCOUNTING_EMAIL || 'ke-toan@hnodyssey.com';

      this.emailService
        .sendRefundAlert(accountingEmail, {
          order_code: orderDoc.order_code,
          amount: orderDoc.total_amount,
          method: orderDoc.payment.method,
          reason: orderDoc.cancel_reason ?? 'Không có lý do cụ thể',
        })
        .catch((err) =>
          this.logger.error('Lỗi gửi mail hoàn tiền cho kế toán:', err),
        );
    }

    // [BỔ SUNG]: Event Trade-In (Thông báo cho bộ phận kiểm định)
    if (status === OrderStatus.TRADE_IN_REVIEW) {
      this.eventEmitter.emit('order.trade_in_alert', orderDoc);
    }
  }

  //US.124: IN HÓA ĐƠN / PHIẾU GIAO HÀNG
  async generatePrintData(id: string, type: 'INVOICE' | 'PACKING_SLIP') {
    const order = await this.findOne(id);

    // AC5: Ràng buộc trạng thái
    if (
      type === 'INVOICE' &&
      ['PENDING', 'CANCELLED', 'TEMPORARY'].includes(order.status)
    ) {
      throw new BadRequestException('Đơn hàng chưa đủ điều kiện xuất hóa đơn');
    }

    // AC8: Tăng biến đếm số lần in
    // Chỉ tăng khi in Hóa đơn (Invoice), phiếu giao hàng có thể in lại thoải mái tùy nghiệp vụ
    if (type === 'INVOICE') {
      order.print_count = (order.print_count || 0) + 1;
      await order.save();
    }
    const orderDoc = order as unknown as MongooseOrderDoc;

    // Trả về data cấu trúc để Frontend render PDF hoặc dùng thư viện tạo PDF tại đây
    return {
      type,
      print_date: new Date(),
      is_copy: order.print_count > 1, // Nếu in > 1 lần là bản sao
      order_info: {
        code: order.order_code,
        created_at: new Date(orderDoc.createdAt || Date.now()),
        customer: order.shipping_info,
      },
      items: order.items.map((i) => ({
        name: i.product_name,
        qty: i.quantity,
        // Nếu là Packing Slip thì ẩn giá (AC2)
        price: type === 'INVOICE' ? i.price : undefined,
        total: type === 'INVOICE' ? i.price * i.quantity : undefined,
      })),
      financials:
        type === 'INVOICE'
          ? {
              subtotal: order.total_amount + order.discount_amount,
              discount: order.discount_amount,
              total: order.total_amount,
            }
          : undefined,
    };
  }

  // 2. Thêm hàm gửi Email (AC3)
  async sendInvoiceEmail(id: string) {
    const order = (await this.orderModel
      .findById(id)
      .populate('user_id')) as unknown as MongooseOrderDoc;

    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

    const populatedUser = order.user_id as unknown as { email: string };

    const recipientEmail =
      order.shipping_info?.email ||
      order.guest_info?.email ||
      populatedUser?.email;

    if (!recipientEmail) {
      throw new BadRequestException(
        'Đơn hàng này không có địa chỉ email liên kết',
      );
    }

    try {
      // 1. Tạo file PDF từ PdfService
      const orderPlain = order.toObject ? order.toObject() : order;
      const pdfBuffer = await this.pdfService.generateInvoice(
        orderPlain as unknown as OrderData,
      );

      // 2. Gửi mail kèm Buffer
      await this.emailService.sendInvoice(
        recipientEmail,
        order.toObject() as unknown as InvoiceOrder,
        pdfBuffer,
      );

      // 3. Log lại
      await this.auditLogsService.log({
        action: 'SEND_INVOICE_EMAIL',
        collection_name: 'orders',
        target_id: order._id as string,
        department: Department.SALES,
        detail: { email: recipientEmail, has_attachment: true },
        is_success: true,
      });

      return {
        success: true,
        message: `Đã gửi hóa đơn (kèm PDF) đến ${recipientEmail}`,
      };
    } catch (error: unknown) {
      // Xử lý biến error an toàn (không gọi .message trực tiếp trên unknown)
      console.error('Lỗi gửi mail/tạo PDF:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      throw new BadRequestException('Gửi email thất bại: ' + errorMessage);
    }
  }

  // 3. Thêm hàm lấy dữ liệu in hàng loạt (AC4)
  async generateBulkPrintData(
    ids: string[],
    type: 'INVOICE' | 'PACKING_SLIP',
  ): Promise<PrintTemplateData[]> {
    const results: PrintTemplateData[] = [];

    for (const id of ids) {
      try {
        const data = (await this.generatePrintData(
          id,
          type,
        )) as unknown as PrintTemplateData;
        results.push(data);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        console.error(`Lỗi in đơn ${id}:`, errorMessage);
      }
    }
    return results;
  }

  // Helper: Hàm log tạo đơn hàng (Dùng chung cho cả 2 luồng Cart & BuyNow)
  private async logCreateOrder(
    userId: string | null | undefined,
    order: MongooseOrderDoc,
    source: string,
    ip: string,
    userAgent: string,
  ) {
    await this.auditLogsService.log({
      action: 'CREATE_ORDER',
      collection_name: 'orders',
      actor_id: userId || undefined,
      target_id: String(order._id),
      department: Department.SALES,
      detail: {
        order_code: order.order_code,
        total: order.total_amount,
        item_count: order.items.length,
        source: source,
        payment_method: order.payment?.method || 'UNKNOWN',
      },
      is_success: true,
      ip: ip,
      user_agent: userAgent,
    });
  }

  // Hàm tính toán xem trước (Không lưu DB)
  async previewOrder(dto: CreateOrderDto) {
    let items: (CartItem | OrderItem)[] = [];
    if (dto.source === 'CART' && dto.guestSessionId) {
      const cartQuery: FilterQuery<Cart> = {};
      if (dto.guestSessionId) cartQuery.session_id = dto.guestSessionId;
      const cart = await this.cartModel.findOne(cartQuery);
      if (!cart) throw new BadRequestException('Giỏ hàng không tồn tại');
      items = cart.items as unknown as CartItem[];
    } else if (dto.source === 'BUY_NOW' && dto.checkoutSessionToken) {
      // LUỒNG BUY_NOW
      const orderId = await this.redis.get(dto.checkoutSessionToken);
      if (!orderId) {
        throw new BadRequestException('Phiên mua hàng hết hạn');
      }

      const tempOrder = await this.orderModel.findById(orderId);
      if (!tempOrder || tempOrder.status !== 'TEMPORARY') {
        throw new BadRequestException('Đơn hàng tạm không hợp lệ');
      }

      // Ép kiểu sang OrderItem[]
      items = tempOrder.items as unknown as OrderItem[];
    }

    if (!items.length) {
      // Trả về mặc định nếu không có item nào (tránh crash reduce)
      return {
        subtotal: 0,
        shipping_fee: 0,
        discount_amount: 0,
        total_amount: 0,
        can_cod: true,
      };
    }

    // 2. Tính toán (Type-Safe)
    const itemsTotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // 3. Tính phí Ship
    const shippingFee = await this.shippingService.calculateShippingFee(
      dto.shippingInfo?.city_code,
      dto.shippingInfo?.district_code,
      items,
      dto.isInstant,
    );

    // 4. Tính Voucher
    const { discount, finalTotal: totalAfterVoucher } = await this.applyVoucher(
      itemsTotal,
      dto.voucherCode,
      null,
    );

    // 4.1. Tính giá trị quy đổi từ Điểm thưởng (AC9) (Giả sử 1 điểm = 100đ)
    let pointsDiscount = 0;
    if (dto.pointsToUse && dto.pointsToUse > 0) {
      pointsDiscount = dto.pointsToUse * 100;
      if (pointsDiscount > totalAfterVoucher)
        pointsDiscount = totalAfterVoucher; // Tránh âm tiền
    }

    // 5. Kết quả cuối
    const totalAmount = totalAfterVoucher - pointsDiscount + shippingFee;
    return {
      subtotal: itemsTotal,
      shipping_fee: shippingFee,
      voucher_code: dto.voucherCode || null,
      discount_amount: discount + pointsDiscount,
      shipping_method: dto.isInstant ? 'Hỏa tốc' : 'Tiêu chuẩn',
      can_cod: totalAmount <= 5000000,
    };
  }

  // US.123: Cập nhật qua Webhook (Đã fix lỗi so sánh Enum)
  async updateStatusByWaybill(
    waybillCode: string,
    status: OrderStatus,
  ): Promise<OrderData | void> {
    const order = await this.orderModel.findOne({
      $or: [{ waybill_code: waybillCode }, { order_code: waybillCode }],
    });
    if (!order) {
      this.logger.warn(
        `Webhook: Không tìm thấy đơn hàng với mã vận đơn ${waybillCode}`,
      );
      return;
    }

    if (
      order.payment?.method === 'TRADE-IN' ||
      order.status === 'TRADE_IN_REVIEW' ||
      order.status === 'RETURNED'
    ) {
      this.logger.log(
        `Webhook: Bỏ qua tự động cập nhật GHN cho đơn thu hồi/trade-in ${waybillCode}`,
      );
      return;
    }

    // Fix lỗi no-unsafe-enum-comparison bằng cách ép về string khi so sánh
    if (String(order.status) === String(status)) return;

    // Gọi lại updateStatusAdvanced (Return Promise<OrderData>)
    return this.updateStatusAdvanced(
      String(order._id),
      {
        status: status,
        note: `Cập nhật tự động từ Đơn vị vận chuyển (Mã vận đơn: ${waybillCode})`,
      },
      'SYSTEM_ID',
      'SYSTEM_WEBHOOK',
      '127.0.0.1',
      'Webhook-Handler',
    );
  }

  async getShippingLabel(orderId: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order || !order.waybill_code) {
      throw new BadRequestException(
        'Đơn hàng chưa được đẩy sang ĐVVC hoặc không tồn tại mã vận đơn',
      );
    }

    // Lấy link in mã vận đơn trực tiếp từ ghn
    const url = await this.ghnService.getPrintLabel(order.waybill_code);

    this.logger.log(
      `Admin lấy link in cho đơn hàng: ${order.order_code} qua GHN`,
    );

    return { url };
  }

  // HÀM DÀNH RIÊNG CHO CHATBOT TRA CỨU
  async findForChatbot(orderCode?: string, phone?: string) {
    const query: FilterQuery<OrderDocument> = {
      status: { $ne: 'TEMPORARY' },
      'payment.method': { $ne: 'TRADE-IN' },
    };

    if (orderCode) {
      // Tìm bằng Regex cực kỳ chính xác và không quan tâm hoa thường
      query.order_code = { $regex: new RegExp(`^${orderCode}$`, 'i') };
    } else if (phone) {
      query.$or = [
        { 'shipping_info.phone': phone },
        { 'guest_info.phone': phone },
      ];
    }

    return this.orderModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(3)
      .lean()
      .exec();
  }

  async findOneByCodeAndPhone(order_code: string, phone: string) {
    return this.orderModel
      .findOne({ order_code, 'shipping_info.phone': phone })
      .exec();
  }

  // THÊM HÀM NÀY VÀO ORDERS.SERVICE.TS
  async downloadBulkPdf(
    ids: string[],
    type: 'INVOICE' | 'PACKING_SLIP',
    res: Response,
  ) {
    // 1. Tìm tất cả đơn hàng theo danh sách ID
    const orders = await this.orderModel
      .find({ _id: { $in: ids } })
      .lean()
      .exec();

    if (!orders || orders.length === 0) {
      throw new NotFoundException('Không tìm thấy đơn hàng nào để in');
    }

    // 2. Nếu là Hóa Đơn (INVOICE), tăng biến đếm print_count theo Acceptance Criteria
    if (type === 'INVOICE') {
      await this.orderModel.updateMany(
        { _id: { $in: ids } },
        { $inc: { print_count: 1 } },
      );
    }

    // 3. Gọi PdfService để vẽ file PDF tổng hợp (Nhiều trang)
    const pdfBuffer = await this.pdfService.generateBulkDocument(
      orders as unknown as OrderData[],
      type,
    );

    // 4. Thiết lập Header để báo cho trình duyệt đây là file đính kèm
    const fileName = `${type}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    // 5. Trả file về cho FE
    res.send(pdfBuffer);
  }

  @OnEvent('warehouse.refund_approved', { async: true })
  handleWarehouseRefundApproved(orderDoc: OrderData) {
    // Gọi lại hàm xử lý Event nội bộ
    this.handleOrderEvents(OrderStatus.REFUND_PENDING, orderDoc);
  }
}
