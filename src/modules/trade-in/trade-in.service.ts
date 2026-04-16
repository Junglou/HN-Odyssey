import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  TradeInRequest,
  TradeInRequestDocument,
} from './schemas/trade-in-request.schema';

import { CategoryDocument } from '../products/categories/schemas/category.schema';
import { NOTIFY_EVENTS } from 'src/common/constants/notification-events.constant';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import { PayoutMethod, TradeInStatus } from 'src/common/enums/trade-in.enum';
import {
  AcceptValuationDto,
  CreateTradeInRequestDto,
  InspectItemDto,
} from './dto/create-trade-in-request.dto';
import { OrderDocument } from '../sales/orders/schemas/order.schema';
import { ProductDocument } from '../products/catalog/schemas/product.schema';
import {
  TradeInPriceList,
  TradeInPriceListDocument,
} from './schemas/trade-in-price-list.schema';

interface ValuationResult {
  estimated_value: number;
  status: TradeInStatus;
}

// FIX: Thêm Interface rõ ràng cho Query của Admin, bỏ "any"
export class QueryAdminTradeInDto {
  page?: number | string;
  limit?: number | string;
  status?: TradeInStatus;
}

@Injectable()
export class TradeInService {
  constructor(
    @InjectModel(TradeInRequest.name)
    private tradeInModel: Model<TradeInRequestDocument>,
    @InjectModel('Category') private categoryModel: Model<CategoryDocument>,
    private eventEmitter: EventEmitter2,
    @InjectModel('Product') private productModel: Model<ProductDocument>,
    @InjectModel('Order') private orderModel: Model<OrderDocument>,
    @InjectModel(TradeInPriceList.name)
    private priceListModel: Model<TradeInPriceListDocument>,
  ) {}

  //  AC2 & AC3: ĐỊNH GIÁ BẰNG DATA THẬT
  private async calculateInitialValuation(
    categoryId: string,
    productId: string,
    conditionScore: number,
  ): Promise<ValuationResult> {
    // AC3: Kiểm tra Danh mục có được hỗ trợ thu mua không?
    const category = await this.categoryModel.findById(categoryId).lean();
    if (!category || !category.is_active) {
      throw new BadRequestException(
        'Hệ thống không hỗ trợ thu mua sản phẩm thuộc danh mục này.',
      );
    }

    // AC2: TÌM TRONG BẢNG GIÁ THU MUA CỐ ĐỊNH DO ADMIN CẤU HÌNH
    const priceConfig = await this.priceListModel
      .findOne({
        product_id: new Types.ObjectId(productId),
        condition_score: conditionScore,
        is_active: true,
      })
      .lean();

    // Nếu CÓ cấu hình giá cứng trong DB -> Chốt giá
    if (priceConfig && priceConfig.fixed_price > 0) {
      return {
        estimated_value: priceConfig.fixed_price,
        status: TradeInStatus.PENDING_VALUATION, // Đủ điều kiện hiển thị giá ước tính
      };
    }

    // AC2 Fallback: Nếu KHÔNG CÓ trong Bảng giá (hoặc sản phẩm lạ), bắt buộc thẩm định thủ công
    return {
      estimated_value: 0,
      status: TradeInStatus.MANUAL_REVIEW,
    };
  }

  //  AC1: TẠO YÊU CẦU
  async createRequest(
    customerId: string,
    dto: CreateTradeInRequestDto & { product_id: string }, // Bổ sung product_id
  ): Promise<BaseResponse<TradeInRequest>> {
    if (!dto.media_urls || dto.media_urls.length === 0) {
      throw new BadRequestException(
        'Bắt buộc phải cung cấp ít nhất 01 ảnh/video thực tế.',
      );
    }

    const valuation = await this.calculateInitialValuation(
      dto.category_id,
      dto.product_id, // Truyền vào logic thật
      dto.condition_score,
    );

    const requestCode = `TRD${Date.now()}`;

    const newRequest = await this.tradeInModel.create({
      ...dto,
      request_code: requestCode,
      customer_id: new Types.ObjectId(customerId),
      estimated_value: valuation.estimated_value,
      status: valuation.status,
      timeline: [
        {
          status: valuation.status,
          note: 'Khách hàng gửi yêu cầu thành công',
          timestamp: new Date(),
        },
      ],
    });

    // AC8 & AC9: Kích hoạt thông báo và Audit Log
    this.eventEmitter.emit('audit.log', {
      action: 'CREATE_TRADE_IN',
      collection: 'trade_in',
      actor_id: customerId,
      target_id: newRequest._id,
    });
    this.eventEmitter.emit(NOTIFY_EVENTS.SYSTEM_ERROR, {
      message: `Yêu cầu thu cũ ${requestCode} vừa được tạo. Cần xử lý!`,
    });

    // BỔ SUNG AC8: Báo cho khách hàng biết yêu cầu đã gửi thành công
    this.eventEmitter.emit('notify.trade_in.created', {
      request_id: newRequest._id,
      customer_id: customerId,
      product_name: dto.product_name,
      estimated_value: valuation.estimated_value,
    });

    return new BaseResponse(true, 'Gửi yêu cầu thành công', newRequest);
  }

  //  AC4: LOGISTICS NGƯỢC
  async acceptValuation(
    customerId: string,
    requestId: string,
    dto: AcceptValuationDto,
  ): Promise<BaseResponse<TradeInRequest>> {
    const request = await this.tradeInModel.findOne({
      _id: requestId,
      customer_id: customerId,
    });
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu');

    if (
      request.status !== TradeInStatus.PENDING_VALUATION &&
      request.status !== TradeInStatus.RENEGOTIATING
    ) {
      throw new BadRequestException('Trạng thái hiện tại không thể chấp thuận');
    }

    // TẠO ĐƠN HÀNG RMA THẬT SỰ TRONG COLLECTION ORDERS
    const rmaOrder = await this.orderModel.create({
      order_code: `RMA-${request.request_code}`,
      user_id: customerId,
      isGuest: false,
      items: [
        {
          product_name: `[THU CŨ] ${request.product_name}`,
          quantity: 1,
          price: request.estimated_value,
        },
      ],
      status: 'TRADE_IN_REVIEW', // Dựa vào Enum OrderSchema của bạn
      total_amount: 0, // Free-ship cho khách chiều ngược
      payment: { method: 'COD', status: 'PENDING' },
      shipping_info: {
        name: 'Thu mua ngược',
        phone: 'Hệ thống',
        address: 'Kho công ty',
        district_code: '0',
        ward_code: '0',
        city_code: '0',
      },
    });

    request.status = TradeInStatus.SHIPPING_TO_WAREHOUSE;
    request.payout_method = dto.payout_method;
    request.payout_details = dto.payout_details;
    request.rma_order_code = rmaOrder.order_code; // Map mã đơn thật vào Trade-in

    request.timeline.push({
      status: TradeInStatus.VALUATION_APPROVED,
      note: `Khách chấp thuận. Khởi tạo vận đơn ngược: ${rmaOrder.order_code}`,
      timestamp: new Date(),
    });
    request.timeline.push({
      status: TradeInStatus.SHIPPING_TO_WAREHOUSE,
      note: `Đang chờ đơn vị vận chuyển đến lấy hàng`,
      timestamp: new Date(),
    });

    await request.save();

    // BỔ SUNG AC8: Bắn Event thông báo cho khách hàng
    this.eventEmitter.emit('notify.trade_in.accepted', {
      request_id: request._id,
      customer_id: request.customer_id,
      product_name: request.product_name,
      final_value: request.final_value || request.estimated_value,
      rma_order_code: rmaOrder.order_code,
    });

    return new BaseResponse(
      true,
      'Đã chấp thuận, đơn vận chuyển ngược đã được tạo',
      request,
    );
  }

  //  AC5: KIỂM ĐỊNH KHO
  async inspectItem(
    adminId: string,
    requestId: string,
    dto: InspectItemDto,
  ): Promise<BaseResponse<TradeInRequest>> {
    const request = await this.tradeInModel.findById(requestId);
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu');

    const isMismatch = dto.actual_condition_score < request.condition_score;
    request.final_value = dto.proposed_final_value;
    request.status = isMismatch
      ? TradeInStatus.RENEGOTIATING
      : TradeInStatus.INSPECTION;

    const note = isMismatch
      ? `Sai lệch tình trạng. Hệ thống đề xuất giá thu mua mới: ${dto.proposed_final_value}đ`
      : 'Kiểm định thành công, sản phẩm đúng tình trạng mô tả.';

    request.timeline.push({
      status: request.status,
      actor_id: adminId,
      note,
      timestamp: new Date(),
    });
    await request.save();

    if (isMismatch) {
      // Bắn event thương lượng giá mới cho khách
      this.eventEmitter.emit('notify.trade_in.renegotiate', {
        request_id: request._id,
        customer_id: request.customer_id,
        proposed_price: dto.proposed_final_value, // Truyền thêm giá mới để báo khách
      });
    } else {
      // BỔ SUNG AC8: Bắn event báo kiểm định thành công khớp mô tả
      this.eventEmitter.emit('notify.trade_in.inspected', {
        request_id: request._id,
        customer_id: request.customer_id,
        final_value: request.final_value,
      });
    }

    this.eventEmitter.emit('audit.log', {
      action: 'INSPECT_TRADE_IN',
      collection: 'trade_in',
      actor_id: adminId,
      target_id: request._id,
      detail: dto,
    });

    return new BaseResponse(
      true,
      'Đã cập nhật kết quả kiểm định tại kho',
      request,
    );
  }

  //  AC6: XỬ LÝ THANH TOÁN (VOUCHER/CK)
  async processPayout(
    adminId: string,
    requestId: string,
  ): Promise<BaseResponse<TradeInRequest>> {
    // Bước 1: Lấy thông tin hiện tại (Chỉ đọc) để tính toán Voucher
    const requestInfo = await this.tradeInModel.findById(requestId).lean();

    if (!requestInfo || requestInfo.status !== TradeInStatus.INSPECTION) {
      throw new BadRequestException(
        'Yêu cầu chưa đủ điều kiện (Hoặc không tồn tại, hoặc chưa kiểm định xong)',
      );
    }

    let finalValue = requestInfo.final_value;
    let payoutDetails = requestInfo.payout_details || {};

    if (requestInfo.payout_method === PayoutMethod.VOUCHER) {
      // AC6: Tăng giá trị (VD: cộng thêm 10% nếu lấy Voucher)
      const bonusRate = 1.1;
      finalValue = Math.round(requestInfo.final_value * bonusRate);
      payoutDetails = {
        ...payoutDetails,
        voucher_code: `VOUCHER-${requestInfo.request_code}`,
      };
    }

    // TỐI ƯU 2: Sử dụng findOneAndUpdate với điều kiện status nghiêm ngặt để chống Race Condition
    const updatedRequest = await this.tradeInModel.findOneAndUpdate(
      {
        _id: requestId,
        status: TradeInStatus.INSPECTION, // CHỐT CHẶN: Nếu Admin B bấm sau Admin A, status lúc này đã là COMPLETED -> Trả về null
      },
      {
        $set: {
          status: TradeInStatus.COMPLETED,
          final_value: finalValue,
          payout_details: payoutDetails,
        },
        $push: {
          timeline: {
            status: TradeInStatus.COMPLETED,
            actor_id: adminId,
            note: `Đã hoàn tất thanh toán định mức qua phương thức ${requestInfo.payout_method}`,
            timestamp: new Date(),
          },
        },
      },
      { new: true }, // Trả về document sau khi update
    );

    if (!updatedRequest) {
      throw new BadRequestException(
        'Thanh toán thất bại: Yêu cầu này đang được xử lý bởi nhân viên khác hoặc đã hoàn tất trước đó.',
      );
    }

    // Ghi Log & Event bằng data mới nhất (updatedRequest)
    this.eventEmitter.emit('audit.log', {
      action: 'PAYOUT_TRADE_IN',
      collection: 'trade_in',
      actor_id: adminId,
      target_id: updatedRequest._id,
    });

    this.eventEmitter.emit('notify.trade_in.completed', {
      request_id: updatedRequest._id,
      customer_id: updatedRequest.customer_id,
      payout_method: updatedRequest.payout_method,
      final_value: updatedRequest.final_value,
      voucher_code: updatedRequest.payout_details?.voucher_code,
    });

    return new BaseResponse(
      true,
      'Thanh toán thành công, hoàn tất luồng Thu cũ',
      updatedRequest as unknown as TradeInRequest,
    );
  }

  //  BỔ SUNG CHO AC7
  async getCustomerHistory(
    customerId: string,
  ): Promise<BaseResponse<TradeInRequest[]>> {
    const requests = await this.tradeInModel
      .find({ customer_id: new Types.ObjectId(customerId) })
      .select('-__v')
      .sort({ createdAt: -1 })
      .lean();

    return new BaseResponse(
      true,
      'Lấy lịch sử thu mua thành công',
      requests as unknown as TradeInRequest[],
    );
  }

  async getCustomerRequestDetail(
    customerId: string,
    requestId: string,
  ): Promise<BaseResponse<TradeInRequest>> {
    const request = await this.tradeInModel
      .findOne({ _id: requestId, customer_id: new Types.ObjectId(customerId) })
      .populate('category_id', 'name slug')
      .lean();

    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu thu mua');
    }

    return new BaseResponse(
      true,
      'Lấy chi tiết yêu cầu thành công',
      request as unknown as TradeInRequest,
    );
  }

  //  BỔ SUNG CHO AC9
  async getAdminRequests(
    query: QueryAdminTradeInDto,
  ): Promise<BaseResponse<TradeInRequest[]>> {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;

    const filter: FilterQuery<TradeInRequestDocument> = {};
    if (query.status) {
      filter.status = query.status;
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

    return new BaseResponse(
      true,
      'Lấy danh sách yêu cầu cho Admin thành công',
      data as unknown as TradeInRequest[],
      {
        totalItems: total,
        itemCount: data.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    );
  }
}
