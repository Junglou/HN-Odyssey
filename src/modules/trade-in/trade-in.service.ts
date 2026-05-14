import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseResponse } from 'src/common/dtos/base-response.dto';
import { OrderDocument } from '../sales/orders/schemas/order.schema';
import { ProductDocument } from '../products/catalog/schemas/product.schema';
import { CategoryDocument } from '../products/categories/schemas/category.schema';
import { PayoutMethod, TradeInStatus } from 'src/common/enums/trade-in.enum';
import {
  TradeInRequestDocument,
  TradeInRequest,
} from './schemas/trade-in-request.schema';
import {
  CancelTradeInDto,
  CreateTradeInRequestDto,
} from './dto/create-trade-in-request.dto';
import { FinalizeTradeInDto, RejectTradeInDto } from './dto/trade-in.dto.ts';

export class QueryAdminTradeInDto {
  page?: number | string;
  limit?: number | string;
  status?: TradeInStatus;
  search?: string;
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
  ) {}

  async createRequest(
    customerId: string,
    dto: CreateTradeInRequestDto,
  ): Promise<BaseResponse<TradeInRequest>> {
    const requestCode = `TRD${Date.now()}`;

    const newRequest = await this.tradeInModel.create({
      ...dto,
      request_code: requestCode,
      customer_id: new Types.ObjectId(customerId),
      estimated_value: 0,
      status: TradeInStatus.PENDING, // Khớp FE: Vừa gửi là Pending
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

  // Action: Approve
  async approveTradeIn(
    adminId: string,
    requestId: string,
  ): Promise<BaseResponse<any>> {
    const request = await this.tradeInModel.findById(requestId);
    if (!request || request.status !== TradeInStatus.PENDING) {
      throw new BadRequestException('Đơn không hợp lệ để Approve');
    }

    request.status = TradeInStatus.APPROVED;
    request.timeline.push({
      status: TradeInStatus.APPROVED,
      actor_id: adminId,
      note: 'Staff approved preliminary condition.',
      timestamp: new Date(),
    });
    await request.save();

    return new BaseResponse(true, 'Đã Approve', request);
  }

  // Action: Reject
  async rejectTradeIn(
    adminId: string,
    requestId: string,
    dto: RejectTradeInDto,
  ): Promise<BaseResponse<any>> {
    const request = await this.tradeInModel.findById(requestId);
    if (!request) throw new NotFoundException('Không tìm thấy đơn');

    request.status = TradeInStatus.REJECTED;
    request.timeline.push({
      status: TradeInStatus.REJECTED,
      actor_id: adminId,
      note: `Rejected. Reason: ${dto.reason}`,
      timestamp: new Date(),
    });
    await request.save();

    return new BaseResponse(true, 'Đã Reject đơn', request);
  }

  // Action: Create Order
  async createOrder(
    adminId: string,
    requestId: string,
  ): Promise<BaseResponse<any>> {
    const request = await this.tradeInModel.findById(requestId);
    if (!request || request.status !== TradeInStatus.APPROVED) {
      throw new BadRequestException('Đơn chưa Approve, không thể Create Order');
    }

    // Giả lập sinh mã vận đơn
    request.status = TradeInStatus.SHIPPING;
    request.timeline.push({
      status: TradeInStatus.SHIPPING,
      actor_id: adminId,
      note: 'Pickup order has been created. Waiting for logistics.',
      timestamp: new Date(),
    });
    await request.save();

    return new BaseResponse(true, 'Đã chuyển trạng thái Shipping', request);
  }

  // Action: Mock Scan Receive
  async receiveItem(
    adminId: string,
    requestId: string,
  ): Promise<BaseResponse<any>> {
    const request = await this.tradeInModel.findById(requestId);
    if (!request || request.status !== TradeInStatus.SHIPPING) {
      throw new BadRequestException(
        'Đơn phải đang Shipping mới có thể nhận hàng',
      );
    }

    request.status = TradeInStatus.RECEIVED;
    request.timeline.push({
      status: TradeInStatus.RECEIVED,
      actor_id: adminId,
      note: 'Warehouse scanned and received the item.',
      timestamp: new Date(),
    });
    await request.save();

    return new BaseResponse(true, 'Đã nhận hàng vào kho', request);
  }

  // Action: Finalize Value
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

    // Lưu thẳng theo FE gõ
    request.status = TradeInStatus.COMPLETED;
    request.final_value = dto.finalValue;
    request.payout_method = dto.method;

    // Tự sinh payout_details dựa theo phương thức thanh toán
    if (dto.method === PayoutMethod.REWARD_POINTS) {
      request.payout_details = {
        points_earned: dto.finalValue,
      };
    } else {
      request.payout_details = {
        voucher_code: `ODYSSEY-TRD-${Date.now()}`,
        expiry_date: new Date(
          Date.now() + 90 * 24 * 60 * 60 * 1000,
        ).toISOString(), // Voucher hạn 90 ngày
      };
    }

    request.timeline.push({
      status: TradeInStatus.COMPLETED,
      actor_id: adminId,
      note: `Finalized: $${dto.finalValue} via ${dto.method}. Note: ${dto.note}`,
      timestamp: new Date(),
    });

    await request.save();

    return new BaseResponse(true, 'Đã hoàn tất Trade-in', request);
  }

  // --- Các hàm List & Detail cũ giữ nguyên ---
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

  async cancelRequest(
    actorId: string,
    requestId: string,
    dto: CancelTradeInDto,
    isAdmin: boolean = false,
  ): Promise<BaseResponse<TradeInRequest>> {
    const query: FilterQuery<TradeInRequestDocument> = { _id: requestId };
    if (!isAdmin) query.customer_id = new Types.ObjectId(actorId);

    const request = await this.tradeInModel.findOne(query);
    if (
      !request ||
      request.status === TradeInStatus.COMPLETED ||
      request.status === TradeInStatus.CANCELLED
    ) {
      throw new BadRequestException(`Không thể hủy đơn này`);
    }

    request.status = TradeInStatus.CANCELLED;
    request.timeline.push({
      status: TradeInStatus.CANCELLED,
      actor_id: actorId,
      note: `Đã hủy. Lý do: ${dto.cancel_note || ''}`,
      timestamp: new Date(),
    });
    await request.save();
    return new BaseResponse(true, 'Đã hủy', request as any);
  }

  async getAdminRequests(
    query: QueryAdminTradeInDto,
  ): Promise<BaseResponse<TradeInRequest[]>> {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;

    const filter: FilterQuery<TradeInRequestDocument> = {};
    if (query.status && query.status !== ('all' as any)) {
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

    return new BaseResponse(true, 'Lấy danh sách thành công', data as any, {
      totalItems: total,
      itemCount: data.length,
      itemsPerPage: limit,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  }
}
