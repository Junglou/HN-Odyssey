import {
  Injectable,
  BadRequestException,
  NotFoundException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import { OrderDocument } from '../sales/orders/schemas/order.schema';
import { ProductDocument } from '../products/catalog/schemas/product.schema';
import { CategoryDocument } from '../products/categories/schemas/category.schema';
import {
  EvaluationMethod,
  PayoutMethod,
  TradeInStatus,
} from 'src/common/enums/trade-in.enum';
import {
  TradeInRequestDocument,
  TradeInRequest,
} from './schemas/trade-in-request.schema';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';
import { PdfService } from '../sales/orders/pdf.service';
import { OrderData, OrderItem } from 'src/common/interfaces/order.interface';
import { GhnService } from '../shipping/providers/ghn.service';
import {
  Coupon,
  CouponStatus,
  DiscountType,
} from '../marketing/promotions/schemas/coupon.schema';
import { TRADE_IN_CONFIG } from 'src/common/constants/trade-in.constant';
import {
  ApproveTradeInDto,
  CancelTradeInDto,
  CreateTradeInRequestDto,
  FinalizeTradeInDto,
  GhnWebhookPayloadDto,
  RejectTradeInDto,
} from './dto/trade-in.dto.ts';

export interface PopulatedCustomer {
  _id: Types.ObjectId;
  fullName?: string;
  email: string;
  phone: string;
}

// Định nghĩa cấu trúc dữ liệu trả về từ dịch vụ giao hàng để loại bỏ kiểu any
export interface GhnShippingResponse {
  waybillCode: string;
  actualFee: number;
}

// Định nghĩa cấu trúc lỗi để an toàn khi truy cập các thuộc tính response và message
export interface GhnError {
  response?: {
    data?: {
      message?: string;
      [key: string]: unknown;
    };
  };
  message?: string;
}

export interface PopulatedCategory {
  _id: Types.ObjectId;
  name: string;
}

export type TradeInDoc = TradeInRequest & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type PopulatedTradeInDoc = Omit<
  TradeInRequest,
  'customer_id' | 'category_id'
> & {
  _id: Types.ObjectId;
  customer_id: PopulatedCustomer;
  category_id: PopulatedCategory;
  createdAt: Date;
  updatedAt: Date;
};

export class QueryAdminTradeInDto {
  page?: number | string;
  limit?: number | string;
  status?: TradeInStatus;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export interface TradeInStatusPayload {
  requestCode: string;
  status: TradeInStatus;
}

@Injectable()
export class TradeInService {
  private readonly logger = new Logger(TradeInService.name);
  constructor(
    @InjectModel(TradeInRequest.name)
    private tradeInModel: Model<TradeInRequestDocument>,
    @InjectModel('Category') private categoryModel: Model<CategoryDocument>,
    private eventEmitter: EventEmitter2,
    @InjectModel('Product') private productModel: Model<ProductDocument>,
    @InjectModel('Order') private orderModel: Model<OrderDocument>,
    private readonly pdfService: PdfService,
    private readonly ghnService: GhnService,
    @InjectModel('Customer') private customerModel: Model<any>,
    @InjectModel('User') private userModel: Model<any>,
    @InjectModel(Coupon.name) private couponModel: Model<Coupon>,
  ) {}

  // Hàm hỗ trợ gửi sự kiện cập nhật trạng thái
  private notifyStatusUpdate(requestCode: string, status: TradeInStatus): void {
    const payload: TradeInStatusPayload = {
      requestCode,
      status,
    };
    this.eventEmitter.emit('trade_in.status_updated', payload);
  }

  async createRequest(
    customerId: string,
    dto: CreateTradeInRequestDto,
  ): Promise<BaseResponse<TradeInRequest>> {
    // Ràng buộc: 1 tài khoản chỉ được 1 đơn Trade-in đang xử lý
    const existingActive = await this.tradeInModel.findOne({
      customer_id: new Types.ObjectId(customerId),
      status: {
        $nin: [
          TradeInStatus.COMPLETED,
          TradeInStatus.REJECTED,
          TradeInStatus.CANCELLED,
        ],
      },
    });

    if (existingActive) {
      throw new BadRequestException(
        'Tài khoản của bạn đang có một yêu cầu Trade-in đang xử lý. Vui lòng hoàn tất yêu cầu hiện tại trước khi tạo mới.',
      );
    }

    const requestCode = `TRD${Date.now()}`;

    const newRequest = await this.tradeInModel.create({
      ...dto,
      request_code: requestCode,
      customer_id: new Types.ObjectId(customerId),
      estimated_value: 0,
      status: TradeInStatus.PENDING,
      timeline: [
        {
          status: TradeInStatus.PENDING,
          note: 'Customer submitted trade-in request.',
          timestamp: new Date(),
        },
      ],
    });

    return new BaseResponse(true, 'Gửi yêu cầu thành công', newRequest);
  }

  // Xử lý duyệt yêu cầu ban đầu
  async approveTradeIn(
    adminId: string,
    requestId: string,
    dto: ApproveTradeInDto,
  ): Promise<BaseResponse<any>> {
    const request = await this.tradeInModel.findById(requestId);
    if (!request || request.status !== TradeInStatus.PENDING) {
      throw new BadRequestException('Đơn không hợp lệ để Approve');
    }

    request.estimated_value = dto.estimateValue;
    request.status = TradeInStatus.APPROVED;
    request.timeline.push({
      status: TradeInStatus.APPROVED,
      actor_id: adminId,
      note: 'Staff approved preliminary condition.',
      timestamp: new Date(),
    });

    await request.save();
    this.notifyStatusUpdate(request.request_code, request.status);

    return new BaseResponse(true, 'Đã Approve', request);
  }

  // Xử lý từ chối yêu cầu
  async rejectTradeIn(
    adminId: string,
    requestId: string,
    dto: RejectTradeInDto,
  ): Promise<BaseResponse<any>> {
    const request = await this.tradeInModel.findById(requestId);
    if (!request) {
      throw new NotFoundException('Không tìm thấy đơn');
    }

    // chặn từ chối nếu đơn hàng đã vượt qua bước chờ xử lý hoặc đã duyệt
    if (
      ![TradeInStatus.PENDING, TradeInStatus.APPROVED].includes(request.status)
    ) {
      throw new BadRequestException(
        'Chỉ có thể từ chối đơn ở trạng thái chờ xử lý hoặc đã duyệt ban đầu',
      );
    }

    request.status = TradeInStatus.REJECTED;
    request.timeline.push({
      status: TradeInStatus.REJECTED,
      actor_id: adminId,
      note: `Rejected. Reason: ${dto.reason}`,
      timestamp: new Date(),
    });

    await request.save();

    this.notifyStatusUpdate(request.request_code, request.status);

    this.eventEmitter.emit('trade_in.rejected', {
      email: request.email,
      fullName: request.full_name,
      requestCode: request.request_code,
      reason: dto.reason,
    });

    return new BaseResponse(true, 'Đã Reject đơn', request);
  }

  // Hàm khởi tạo đơn vận chuyển qua đối tác
  async createOrder(
    adminId: string,
    requestId: string,
  ): Promise<BaseResponse<any>> {
    const request = await this.tradeInModel.findById(requestId);

    if (!request || request.status !== TradeInStatus.APPROVED) {
      throw new BadRequestException(
        'Đơn chưa được duyệt, không thể tạo vận đơn GHN',
      );
    }

    if (
      request.evaluation_method !== EvaluationMethod.SHIPPING ||
      !request.shipping_address
    ) {
      throw new BadRequestException(
        'Đơn này không sử dụng phương thức vận chuyển',
      );
    }

    const declaredPrice = Math.max(
      request.estimated_value,
      TRADE_IN_CONFIG.GHN_MIN_INSURANCE_VALUE,
    );

    const orderData = {
      note: `Thu hồi thiết bị Trade-in mã ${request.request_code}`,
      customerName: request.full_name,
      phone: request.phone_number,
      address: `${request.shipping_address.apt_suite ? request.shipping_address.apt_suite + ', ' : ''}${request.shipping_address.street_address}`,
      weight: TRADE_IN_CONFIG.GHN_DEFAULT_WEIGHT_GRAMS,
      codAmount: 0,
      wardCode: request.shipping_address.ward_code,
      districtId: request.shipping_address.district_id,
      isReverse: true,
      items: [
        {
          name: request.product_name || 'Thiết bị Trade-in',
          code: request.category_id.toString(),
          quantity: 1,
          price: declaredPrice,
          weight: TRADE_IN_CONFIG.GHN_DEFAULT_WEIGHT_GRAMS,
        },
      ],
    };

    let ghnResult: GhnShippingResponse;

    try {
      ghnResult = (await this.ghnService.createShippingOrder(
        orderData,
      )) as GhnShippingResponse;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw new BadRequestException(`Tạo vận đơn thất bại. ${error.message}`);
      }
      this.logger.error(
        'Lỗi khi gọi GHN API:',
        error instanceof Error ? error.stack : error,
      );
      throw new BadRequestException(
        'Tạo vận đơn thất bại. Lỗi không xác định từ hệ thống.',
      );
    }

    request.rma_order_code = ghnResult.waybillCode;
    request.status = TradeInStatus.SHIPPING;
    request.timeline.push({
      status: TradeInStatus.SHIPPING,
      actor_id: adminId,
      note: `Đã tạo vận đơn thu hồi GHN. Mã vận đơn: ${ghnResult.waybillCode}. Phí dự kiến: ${ghnResult.actualFee}đ`,
      timestamp: new Date(),
    });

    await request.save();

    // Đồng bộ dữ liệu sang kho (Tạo đơn ảo đẩy về Request Queue để nhân viên kho thao tác duyệt)
    await this.orderModel.create({
      order_code: request.request_code,
      user_id: null,
      status: 'TRADE_IN_REVIEW',
      total_amount: 0,
      payment: { method: 'TRADE-IN', status: 'PENDING' },
      shipping_info: {
        name: request.full_name,
        phone: request.phone_number,
        address: request.shipping_address
          ? request.shipping_address.street_address
          : 'Khách vãng lai',
        district_code: request.shipping_address
          ? request.shipping_address.district_id.toString()
          : '0',
        ward_code: request.shipping_address
          ? request.shipping_address.ward_code
          : '0',
        city_code: '0',
      },
      items: [
        {
          product_id: null,
          sku: 'TRADE-IN',
          product_name: request.product_name || 'Thiết bị Trade-in thu hồi',
          price: request.estimated_value,
          quantity: 1,
        },
      ],
    });

    this.notifyStatusUpdate(request.request_code, request.status);

    return new BaseResponse(
      true,
      'Đã chuyển trạng thái Shipping và tạo vận đơn GHN thành công',
      request,
    );
  }

  // Lắng nghe và xử lý dữ liệu webhook từ đơn vị vận chuyển
  async handleGhnWebhook(payload: GhnWebhookPayloadDto): Promise<void> {
    const request = await this.tradeInModel.findOne({
      rma_order_code: payload.OrderCode,
    });

    if (!request || request.status !== TradeInStatus.SHIPPING) {
      return;
    }

    const currentStatus = payload.Status.toLowerCase();

    if (currentStatus === 'delivered') {
      request.status = TradeInStatus.RECEIVED;
      request.timeline.push({
        status: TradeInStatus.RECEIVED,
        note: 'Hệ thống tự động ghi nhận: Đơn vị vận chuyển đã giao thiết bị thành công đến kho.',
        timestamp: new Date(),
      });
    }
    // cập nhật luồng ngoại lệ khi quá trình vận chuyển gặp sự cố không thể giao hàng
    else if (['returned', 'damage', 'lost'].includes(currentStatus)) {
      request.status = TradeInStatus.CANCELLED;
      request.timeline.push({
        status: TradeInStatus.CANCELLED,
        note: `Hệ thống tự động ghi nhận ngoại lệ vận chuyển. Trạng thái từ đối tác: ${payload.Status}. Đơn hàng bị hủy do không thể tiếp nhận thiết bị.`,
        timestamp: new Date(),
      });
    } else {
      // bỏ qua các trạng thái trung gian khác như đang giao hoặc lấy hàng
      return;
    }

    await request.save();
    this.notifyStatusUpdate(request.request_code, request.status);
  }

  // Chốt giá trị cuối cùng và cấp phát phần thưởng
  async finalizeValue(
    adminId: string,
    requestId: string,
    dto: FinalizeTradeInDto,
  ): Promise<BaseResponse<any>> {
    const request = await this.tradeInModel.findById(requestId);
    if (!request || request.status !== TradeInStatus.RECEIVED) {
      throw new BadRequestException(
        'Đơn phải ở trạng thái Received mới được Finalize',
      );
    }

    if (
      dto.method === PayoutMethod.PERCENTAGE_VOUCHER &&
      dto.finalValue > 100
    ) {
      throw new BadRequestException(
        'Mức phần trăm quy đổi ưu đãi không được vượt quá 100%',
      );
    }

    request.status = TradeInStatus.COMPLETED;
    request.final_value = dto.finalValue;
    request.payout_method = dto.method;

    const now = new Date();

    // 1. Luồng cấp phát điểm thưởng
    if (dto.method === PayoutMethod.REWARD_POINTS) {
      request.payout_details = { points_earned: dto.finalValue };
      await this.customerModel.updateOne(
        { _id: request.customer_id },
        { $inc: { 'loyalty.point': dto.finalValue } },
      );
    }
    // 2. Luồng cấp phát Voucher Fix Amount
    else if (dto.method === PayoutMethod.FIXED_AMOUNT) {
      const voucherCode = `${TRADE_IN_CONFIG.VOUCHER_PREFIX}${Date.now()}`;
      const expiryDate = new Date(
        now.getTime() +
          TRADE_IN_CONFIG.VOUCHER_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      );

      await this.couponModel.create({
        code: voucherCode,
        description: `Voucher Fixed Amount từ đơn Trade-in ${request.request_code}`,
        discount_type: DiscountType.FIXED_AMOUNT,
        discount_value: dto.finalValue,
        min_order_value: 0,
        start_date: now,
        end_date: expiryDate,
        usage_limit: 1,
        usage_count: 0,
        user_usage_limit: 1,
        status: CouponStatus.ACTIVE,
        is_stackable: true,
        owner_id: request.customer_id,
        applicable_scope: {
          isAllProducts: true,
          categories: [],
          tags: [],
          products: [],
        },
      });

      request.payout_details = {
        voucher_code: voucherCode,
        expiry_date: expiryDate.toISOString(),
      };
    }
    // 3. Luồng cấp phát Percentage Voucher
    else if (dto.method === PayoutMethod.PERCENTAGE_VOUCHER) {
      if (dto.finalValue > 100 || dto.finalValue < 1) {
        throw new BadRequestException(
          'Giá trị Percentage Voucher chỉ được phép nằm trong khoảng từ 1% đến 100%',
        );
      }

      const promotionCode = `${TRADE_IN_CONFIG.PROMOTION_PREFIX}${Date.now()}`;
      const expiryDate = new Date(
        now.getTime() +
          TRADE_IN_CONFIG.PROMOTION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      );

      await this.couponModel.create({
        code: promotionCode,
        description: `Percentage Voucher từ đơn Trade-in ${request.request_code}`,
        discount_type: 'PERCENTAGE', // Tương đương DiscountType.PERCENTAGE
        discount_value: dto.finalValue,
        max_discount_amount: null,
        min_order_value: 0,
        start_date: now,
        end_date: expiryDate,
        usage_limit: 1,
        usage_count: 0,
        user_usage_limit: 1,
        status: 'ACTIVE', // Tương đương CouponStatus.ACTIVE
        is_stackable: false,
        owner_id: request.customer_id,
        applicable_scope: {
          isAllProducts: true, // Áp dụng toàn sàn, không còn gò bó vào danh mục bảo dưỡng
          categories: [],
          tags: [],
          products: [],
        },
      });

      request.payout_details = {
        voucher_code: promotionCode,
        expiry_date: expiryDate.toISOString(),
      };
    }

    request.timeline.push({
      status: TradeInStatus.COMPLETED,
      actor_id: adminId,
      note: `Finalized: $${dto.finalValue} via ${dto.method}. Note: ${dto.note}`,
      timestamp: new Date(),
    });

    await request.save();
    this.notifyStatusUpdate(request.request_code, request.status);

    this.eventEmitter.emit('trade_in.completed', {
      email: request.email,
      fullName: request.full_name,
      requestCode: request.request_code,
      finalValue: dto.finalValue,
      payoutMethod: dto.method,
      payoutDetails: request.payout_details,
    });

    return new BaseResponse(true, 'Đã hoàn tất Trade-in', request);
  }

  // Lấy danh sách lịch sử yêu cầu của khách hàng
  async getCustomerHistory(
    customerId: string,
  ): Promise<BaseResponse<TradeInRequest[]>> {
    const requests = await this.tradeInModel
      .find({ customer_id: new Types.ObjectId(customerId) })
      .select('-__v')
      .sort({ createdAt: -1 })
      .lean();
    return new BaseResponse(true, 'Lấy lịch sử thành công', requests as any);
  }

  // Xem chi tiết yêu cầu của khách hàng
  async getCustomerRequestDetail(
    customerId: string,
    requestId: string,
  ): Promise<BaseResponse<TradeInRequest>> {
    const request = await this.tradeInModel
      .findOne({ _id: requestId, customer_id: new Types.ObjectId(customerId) })
      .populate('category_id', 'name slug')
      .lean();
    if (!request) throw new NotFoundException('Không tìm thấy');
    return new BaseResponse(true, 'Chi tiết đơn', request as any);
  }

  // Xử lý hủy yêu cầu
  async cancelRequest(
    actorId: string,
    requestId: string,
    dto: CancelTradeInDto,
    isAdmin: boolean = false,
  ): Promise<BaseResponse<TradeInRequest>> {
    const query: FilterQuery<TradeInRequestDocument> = { _id: requestId };
    if (!isAdmin) query.customer_id = new Types.ObjectId(actorId);

    const request = await this.tradeInModel.findOne(query);
    if (!request) {
      throw new NotFoundException('Không tìm thấy đơn yêu cầu');
    }

    // khách hàng và admin chỉ được phép hủy các đơn chưa tiến hành giao nhận vật lý
    if (
      ![TradeInStatus.PENDING, TradeInStatus.APPROVED].includes(request.status)
    ) {
      throw new BadRequestException(
        'Không thể hủy đơn khi thiết bị đã được giao cho đơn vị vận chuyển hoặc hệ thống đã tiếp nhận',
      );
    }

    request.status = TradeInStatus.CANCELLED;
    request.timeline.push({
      status: TradeInStatus.CANCELLED,
      actor_id: actorId,
      note: `Đã hủy. Lý do: ${dto.cancel_note || ''}`,
      timestamp: new Date(),
    });
    await request.save();
    this.notifyStatusUpdate(request.request_code, request.status);
    return new BaseResponse(true, 'Đã hủy', request as any);
  }

  // Truy vấn danh sách yêu cầu dành cho quản trị viên
  async getAdminRequests(
    query: QueryAdminTradeInDto,
  ): Promise<BaseResponse<PopulatedTradeInDoc[]>> {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || TRADE_IN_CONFIG.DEFAULT_PAGE_LIMIT);
    const skip = (page - 1) * limit;

    const filter: FilterQuery<TradeInRequestDocument> = {};

    if (query.status && query.status !== ('all' as any)) {
      filter.status = query.status;
    }

    if (query.search) {
      filter.$or = [
        { request_code: { $regex: query.search, $options: 'i' } },
        { full_name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { phone_number: { $regex: query.search, $options: 'i' } },
      ];
    }

    if (query.fromDate || query.toDate) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};

      if (query.fromDate && typeof query.fromDate === 'string') {
        const fromDate = new Date(query.fromDate);
        fromDate.setHours(0, 0, 0, 0);
        dateFilter.$gte = fromDate;
      }

      if (query.toDate && typeof query.toDate === 'string') {
        const toDate = new Date(query.toDate);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = toDate;
      }

      if (Object.keys(dateFilter).length > 0) {
        filter.createdAt = dateFilter;
      }
    }

    const [total, data] = await Promise.all([
      this.tradeInModel.countDocuments(filter),
      this.tradeInModel
        .find(filter)
        .populate('customer_id', 'fullName email phone')
        .populate('category_id', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const safeData = data as unknown as PopulatedTradeInDoc[];

    return new BaseResponse(true, 'Lấy danh sách thành công', safeData, {
      totalItems: total,
      itemCount: data.length,
      itemsPerPage: limit,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  }

  // Xem chi tiết yêu cầu từ góc độ quản trị viên
  async getAdminRequestDetail(
    requestId: string,
  ): Promise<BaseResponse<PopulatedTradeInDoc>> {
    const request = await this.tradeInModel
      .findById(requestId)
      .populate('customer_id', 'fullName email phone')
      .populate('category_id', 'name slug')
      .lean();

    if (!request)
      throw new NotFoundException('Không tìm thấy yêu cầu Trade-in');

    return new BaseResponse(
      true,
      'Chi tiết đơn Trade-in',
      request as unknown as PopulatedTradeInDoc,
    );
  }

  // Kết xuất dữ liệu ra file Excel chuẩn nghiệp vụ Trade-in (Đã bổ sung Tiêu đề & Cấu trúc Header chuyên nghiệp)
  async exportExcel(
    adminId: string,
    query: QueryAdminTradeInDto,
    res: Response,
  ): Promise<void> {
    // Ép kiểu dữ liệu trả về để khắc phục lỗi Eslint và TypeScript
    const exporter = (await this.userModel
      .findById(adminId)
      .select('email first_Name last_Name')
      .lean()
      .exec()) as {
      email?: string;
      first_Name?: string;
      last_Name?: string;
    } | null;

    const exporterEmail = exporter?.email || 'N/A';

    // Xử lý ghép tên thủ công do hàm .lean() loại bỏ thuộc tính ảo fullName của Mongoose
    let exporterName = 'N/A';
    if (exporter) {
      if (exporter.first_Name && exporter.last_Name) {
        exporterName = `${exporter.first_Name} ${exporter.last_Name}`;
      } else if (exporter.email) {
        exporterName = exporter.email.split('@')[0];
      }
    }

    const filter: FilterQuery<TradeInRequestDocument> = {};
    if (query.status && query.status !== ('all' as TradeInStatus)) {
      filter.status = query.status;
    }

    if (query.search) {
      filter.$or = [
        { request_code: { $regex: query.search, $options: 'i' } },
        { full_name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { phone_number: { $regex: query.search, $options: 'i' } },
      ];
    }

    if (query.fromDate || query.toDate) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};

      if (query.fromDate && typeof query.fromDate === 'string') {
        const fromDate = new Date(query.fromDate);
        fromDate.setHours(0, 0, 0, 0);
        dateFilter.$gte = fromDate;
      }

      if (query.toDate && typeof query.toDate === 'string') {
        const toDate = new Date(query.toDate);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.$lte = toDate;
      }

      if (Object.keys(dateFilter).length > 0) {
        filter.createdAt = dateFilter;
      }
    }

    const data = await this.tradeInModel
      .find(filter)
      .populate('customer_id', 'fullName email phone')
      .populate('category_id', 'name')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const safeData = data as unknown as PopulatedTradeInDoc[];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Danh Sach Trade-In');

    // 1. THIẾT LẬP ĐỘ RỘNG CỘT TRƯỚC
    sheet.getColumn(1).width = 25; // Mã Yêu Cầu
    sheet.getColumn(2).width = 20; // Ngày Tạo
    sheet.getColumn(3).width = 20; // Ngày Hoàn Tất
    sheet.getColumn(4).width = 30; // Khách Hàng
    sheet.getColumn(5).width = 20; // SĐT
    sheet.getColumn(6).width = 40; // Tên Sản Phẩm
    sheet.getColumn(7).width = 25; // Hình Thức Quy Đổi
    sheet.getColumn(8).width = 25; // Trị Giá Thu Đổi
    sheet.getColumn(9).width = 20; // Trạng Thái

    // 2. TẠO TIÊU ĐỀ LỚN CHO BÁO CÁO (Tương tự Warehouse)
    sheet.mergeCells('A1:I1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'BÁO CÁO TỔNG HỢP YÊU CẦU THU CŨ ĐỔI MỚI (TRADE-IN)';
    titleCell.font = {
      name: 'Arial',
      size: 14,
      bold: true,
      color: { argb: 'FF1976D2' }, // Xanh dương đậm
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    // 3. TẠO THÔNG TIN BỘ LỌC VÀ NGÀY XUẤT
    sheet.mergeCells('A2:I2');
    const infoCell = sheet.getCell('A2');

    const startDateStr = query.fromDate
      ? new Date(query.fromDate).toLocaleDateString('vi-VN')
      : 'Từ trước tới nay';
    const endDateStr = query.toDate
      ? new Date(query.toDate).toLocaleDateString('vi-VN')
      : 'Hiện tại';
    const nowStr = new Date().toLocaleString('vi-VN');

    // Bổ sung thông tin Tên và Email của người xuất vào dòng thông tin chung
    infoCell.value = `Kỳ báo cáo: ${startDateStr} - ${endDateStr}  |  Ngày xuất: ${nowStr}  |  Người xuất: ${exporterName} (${exporterEmail})`;
    infoCell.font = { name: 'Arial', size: 10, italic: true };
    infoCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(2).height = 20;

    // Dòng trống để cách điệu
    sheet.addRow([]);

    // 4. TẠO DÒNG HEADER TIÊU ĐỀ CỘT DỮ LIỆU
    const headerRow = sheet.addRow([
      'Mã Yêu Cầu',
      'Ngày Tạo',
      'Ngày Hoàn Tất',
      'Khách Hàng',
      'Số Điện Thoại',
      'Thiết Bị Trade-in',
      'Hình Thức Quy Đổi',
      'Giá Trị Chi Trả Thực Tế',
      'Trạng Thái',
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

    // 5. ĐỔ DỮ LIỆU TỪ DATABASE VÀO
    safeData.forEach((item) => {
      const completedStep = item.timeline?.find(
        (t) => t.status.toLowerCase() === 'completed',
      );

      const completedDateDisplay = completedStep
        ? new Date(completedStep.timestamp).toLocaleDateString('vi-VN')
        : '---';

      let finalValueDisplay = '';
      if (item.status === TradeInStatus.COMPLETED) {
        if (item.payout_method === PayoutMethod.REWARD_POINTS) {
          finalValueDisplay = `${item.final_value || 0} Điểm`;
        } else if (item.payout_method === PayoutMethod.PERCENTAGE_VOUCHER) {
          // Đã sửa tại đây
          finalValueDisplay = `Giảm ${item.final_value || 0}%`;
        } else if (item.payout_method === PayoutMethod.FIXED_AMOUNT) {
          // Đã sửa tại đây
          finalValueDisplay = `$${(item.final_value || 0).toFixed(2)}`;
        } else {
          finalValueDisplay = `${item.final_value || 0}`;
        }
      } else {
        finalValueDisplay = 'Chưa hoàn tất thẩm định';
      }

      // Đẩy dữ liệu vào mảng tương ứng với 9 cột
      const row = sheet.addRow([
        item.request_code,
        new Date(item.createdAt).toLocaleDateString('vi-VN'),
        completedDateDisplay,
        item.customer_id?.fullName || item.full_name,
        item.customer_id?.phone || item.phone_number,
        item.product_name || item.category_id?.name || 'N/A',
        item.payout_method || 'Đang chờ xử lý',
        finalValueDisplay,
        item.status,
      ]);

      // Kẻ viền (border) và căn chỉnh cho từng ô dữ liệu
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        // Căn giữa cho các cột Mã, Ngày, Trạng thái. Căn trái cho tên, SĐT...
        cell.alignment = {
          vertical: 'middle',
          horizontal: [1, 2, 3, 5, 9].includes(colNumber) ? 'center' : 'left',
          wrapText: true, // Cho phép xuống dòng nếu tên sản phẩm quá dài
        };
      });
    });

    // 6. TRẢ FILE VỀ CHO FRONTEND
    const exportDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `TradeIn_Report_${exportDate}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    await workbook.xlsx.write(res);
  }

  // Khởi tạo quy trình tải file PDF hàng loạt
  async downloadBulkPdf(
    ids: string[],
    type: 'INVOICE' | 'PACKING_SLIP',
    res: Response,
  ): Promise<void> {
    const requests = (await this.tradeInModel
      .find({ _id: { $in: ids } })
      .lean()
      .exec()) as unknown as TradeInDoc[];

    if (!requests || requests.length === 0) {
      throw new NotFoundException('Không tìm thấy dữ liệu để in');
    }

    // Xử lý dữ liệu định dạng đơn hàng để xuất PDF
    const mappedToOrderData: OrderData[] = requests.map((req) => {
      const mappedOrder = {
        _id: req._id,
        order_code: req.request_code,
        createdAt: req.createdAt,
        total_amount: req.final_value || req.estimated_value || 0,
        discount_amount: 0,
        shipping_info: {
          name: req.full_name,
          phone: req.phone_number,
          address: req.shipping_address
            ? `${req.shipping_address.street_address}, ${req.shipping_address.city}`
            : 'Trade-in tại quầy',
        },
        payment: {
          method: `TRADE-IN|${req.payout_method || 'PENDING'}`,
          status: 'COMPLETED',
        },
        items: [
          {
            product_id: req.category_id as unknown as Types.ObjectId,
            sku: 'TRADE-IN',
            product_name: req.product_name || 'Thiết bị Trade-in',
            price: req.final_value || req.estimated_value || 0,
            quantity: 1,
            image: req.media_urls?.[0] || '',
          } as unknown as OrderItem,
        ],
      };

      return mappedOrder as unknown as OrderData;
    });

    const pdfBuffer = await this.pdfService.generateBulkDocument(
      mappedToOrderData,
      type,
    );

    const fileName = `TradeIn_${type}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    res.send(pdfBuffer);
  }

  // Xác nhận nhận thiết bị tại cửa hàng
  async receiveItem(
    adminId: string,
    requestId: string,
  ): Promise<BaseResponse<any>> {
    const request = await this.tradeInModel.findById(requestId);

    if (!request) {
      throw new NotFoundException('Không tìm thấy đơn yêu cầu Trade-in');
    }

    if (request.evaluation_method !== EvaluationMethod.VISIT_STORE) {
      throw new BadRequestException(
        'Thao tác bị từ chối. Đơn hàng vận chuyển sẽ được GHN cập nhật trạng thái tự động.',
      );
    }

    if (request.status !== TradeInStatus.APPROVED) {
      throw new BadRequestException(
        'Đơn hàng phải ở trạng thái Approved mới có thể xác nhận nhận hàng tại quầy.',
      );
    }

    request.status = TradeInStatus.RECEIVED;
    request.timeline.push({
      status: TradeInStatus.RECEIVED,
      actor_id: adminId,
      note: 'Nhân viên đã nhận thiết bị trực tiếp từ khách hàng tại quầy.',
      timestamp: new Date(),
    });

    await request.save();
    this.notifyStatusUpdate(request.request_code, request.status);

    return new BaseResponse(
      true,
      'Xác nhận nhận thiết bị tại quầy thành công',
      request,
    );
  }

  async sandboxReceiveItem(
    adminId: string,
    requestId: string,
  ): Promise<BaseResponse<any>> {
    const request = await this.tradeInModel.findById(requestId);

    if (!request || request.status !== TradeInStatus.SHIPPING) {
      throw new BadRequestException(
        'Chỉ có thể cập nhật đơn đang ở trạng thái Shipping',
      );
    }

    // Ép trạng thái về Received
    request.status = TradeInStatus.RECEIVED;
    request.timeline.push({
      status: TradeInStatus.RECEIVED,
      actor_id: adminId,
      note: '[SANDBOX] Quản trị viên cập nhật trạng thái nhận hàng thủ công do môi trường giả lập.',
      timestamp: new Date(),
    });

    await request.save();
    this.notifyStatusUpdate(request.request_code, request.status);

    return new BaseResponse(
      true,
      'Cập nhật nhận hàng thành công (Sandbox)',
      request,
    );
  }

  // Khối lắng nghe phản hồi ngược lại từ Module Kho
  @OnEvent('trade_in.warehouse_received', { async: true })
  async handleWarehouseReceived(requestCode: string) {
    const request = await this.tradeInModel.findOne({
      request_code: requestCode,
    });
    if (request && request.status === TradeInStatus.SHIPPING) {
      request.status = TradeInStatus.RECEIVED;
      request.timeline.push({
        status: TradeInStatus.RECEIVED,
        note: 'Hệ thống ghi nhận: Kho đã duyệt (Approve) nhận thiết bị Trade-in.',
        timestamp: new Date(),
      });
      await request.save();
      this.notifyStatusUpdate(request.request_code, request.status);
    }
  }

  @OnEvent('trade_in.warehouse_rejected', { async: true })
  async handleWarehouseRejected(payload: {
    requestCode: string;
    reason: string;
  }) {
    const request = await this.tradeInModel.findOne({
      request_code: payload.requestCode,
    });
    if (request && request.status === TradeInStatus.SHIPPING) {
      request.status = TradeInStatus.REJECTED;
      request.timeline.push({
        status: TradeInStatus.REJECTED,
        note: `Hệ thống ghi nhận: Kho từ chối (Reject) thiết bị. Lý do: ${payload.reason}`,
        timestamp: new Date(),
      });
      await request.save();
      this.notifyStatusUpdate(request.request_code, request.status);
    }
  }
}
