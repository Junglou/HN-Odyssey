import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import {
  Order,
  OrderDocument,
} from 'src/modules/sales/orders/schemas/order.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserStatus } from 'src/common/enums/user-status.enum';
import {
  RequestChangeContactDto,
  VerifyContactChangeDto,
  ContactType,
} from './dto/change-contact.dto';
import { GetMyOrdersDto, OrderStatus } from './dto/get-my-orders.dto';
import { FilterQuery, isValidObjectId } from 'mongoose';
import { EmailService } from 'src/modules/notifications/channels/email.service';
import { SmsService } from 'src/modules/notifications/channels/sms.service';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async convertGuestToMember(orderId: string, password: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (!order.guest_info || !order.guest_info.email) {
      throw new BadRequestException(
        'Đơn hàng không có thông tin khách vãng lai hợp lệ.',
      );
    }

    const existingUser = await this.userModel.findOne({
      email: order.guest_info.email,
    });
    if (existingUser) {
      throw new BadRequestException(
        'Email này đã có tài khoản. Vui lòng đăng nhập.',
      );
    }

    const hashedPassword = await this.hashPassword(password);

    const nameParts = order.guest_info.name.trim().split(' ');
    const firstName =
      nameParts.length > 1 ? nameParts[0] : order.guest_info.name;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    const newUser = await this.userModel.create({
      email: order.guest_info.email,
      password: hashedPassword,
      first_Name: firstName,
      last_Name: lastName,
      phone: order.guest_info.phone,
      roles: ['CUSTOMER'],
      status: UserStatus.ACTIVE,
      type: 'Customer',
    });

    order.user_id = newUser._id;
    order.isGuest = false;
    await order.save();

    return {
      success: true,
      message: 'Tạo tài khoản thành công',
      userId: newUser._id,
    };
  }

  // US.04: QUẢN LÝ TÀI KHOẢN

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }

  async updateProfile(userId: string, updateDto: UpdateProfileDto) {
    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: updateDto },
      { new: true, runValidators: true },
    );
    if (!updatedUser) throw new NotFoundException('Không tìm thấy người dùng');
    return { success: true, data: updatedUser };
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    await this.userModel.findByIdAndUpdate(userId, { avatar: avatarUrl });
    return { success: true, avatar: avatarUrl };
  }

  //  US.04: BẢO MẬT & ĐỔI MẬT KHẨU

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel
      .findById(userId)
      .select('+password')
      .exec();
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    const isMatch = await bcrypt.compare(
      dto.currentPassword,
      user.password || '',
    );
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác');
    }

    const isSameAsOld = await bcrypt.compare(
      dto.newPassword,
      user.password || '',
    );
    if (isSameAsOld) {
      throw new BadRequestException(
        'Mật khẩu mới không được trùng với mật khẩu hiện tại',
      );
    }

    user.password = await this.hashPassword(dto.newPassword);
    user.token_version += 1;

    await user.save();

    await this.emailService.sendRaw(
      user.email,
      '[H&N Odyssey] Thông báo bảo mật: Mật khẩu đã thay đổi',
      `<p>Xin chào,</p>
       <p>Mật khẩu tài khoản của bạn vừa được thay đổi thành công.</p>
       <p>Nếu bạn không thực hiện yêu cầu này, vui lòng liên hệ ngay với bộ phận CSKH để được hỗ trợ khóa tài khoản khẩn cấp.</p>`,
    );

    await this.auditLogsService.log({
      action: 'CHANGE_PASSWORD',
      collection_name: 'User',
      actor_id: userId,
      target_id: userId,
      department: 'SUPPORT',
      detail: {
        description: 'Người dùng đã thay đổi mật khẩu tài khoản',
      },
    });

    return {
      success: true,
      message:
        'Đổi mật khẩu thành công. Các phiên đăng nhập khác đã bị đăng xuất.',
    };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  // US.04: THAY ĐỔI EMAIL / SĐT BẰNG OTP/LINK

  async requestChangeContact(userId: string, dto: RequestChangeContactDto) {
    const user = await this.userModel
      .findById(userId)
      .select('+password +otp_locked_until +last_code_sent_at')
      .exec();

    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    if (user.otp_locked_until && user.otp_locked_until > new Date()) {
      throw new ForbiddenException(
        `Tính năng đang bị tạm khóa. Vui lòng thử lại sau ${user.otp_locked_until.toLocaleTimeString()}`,
      );
    }

    const isMatch = await bcrypt.compare(
      dto.currentPassword,
      user.password || '',
    );
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác');
    }

    const existingContact = await this.userModel.findOne({
      $or: [{ email: dto.newValue }, { phone: dto.newValue }],
    });
    if (existingContact) {
      throw new BadRequestException(
        // Sửa lỗi so sánh Enum
        `${dto.type === ContactType.EMAIL ? 'Email' : 'Số điện thoại'} này đã được sử dụng trong hệ thống`,
      );
    }

    const now = new Date();
    if (
      user.last_code_sent_at &&
      now.getTime() - user.last_code_sent_at.getTime() < 60000
    ) {
      throw new BadRequestException(
        'Vui lòng đợi 60 giây trước khi yêu cầu mã mới',
      );
    }

    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const expiresAt = new Date(now.getTime() + 5 * 60000);

    await this.userModel.findByIdAndUpdate(userId, {
      // Sửa lỗi so sánh Enum
      ...(dto.type === ContactType.EMAIL
        ? { pending_email: dto.newValue }
        : { pending_phone: dto.newValue }),
      verification_code: await this.hashPassword(verificationCode),
      verification_code_expires_at: expiresAt,
      last_code_sent_at: now,
      failed_otp_attempts: 0,
    });

    if (dto.type === ContactType.EMAIL) {
      await this.emailService.sendOtp(dto.newValue, verificationCode);
    } else if (dto.type === ContactType.PHONE) {
      await this.smsService.sendOtp(dto.newValue, verificationCode);
    }

    return {
      success: true,
      message: `Mã xác thực đã được gửi đến ${dto.newValue}. Có hiệu lực trong 5 phút.`,
    };
  }

  async verifyChangeContact(userId: string, dto: VerifyContactChangeDto) {
    const user = await this.userModel
      .findById(userId)
      .select(
        '+verification_code +verification_code_expires_at +failed_otp_attempts +otp_locked_until +pending_email +pending_phone',
      )
      .exec();

    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    if (user.otp_locked_until && user.otp_locked_until > new Date()) {
      throw new ForbiddenException(
        'Tính năng đang bị tạm khóa do nhập sai quá nhiều lần.',
      );
    }

    if (
      !user.verification_code ||
      (!user.pending_email && !user.pending_phone)
    ) {
      throw new BadRequestException(
        'Không tìm thấy yêu cầu thay đổi thông tin nào',
      );
    }

    if (
      user.verification_code_expires_at &&
      user.verification_code_expires_at < new Date()
    ) {
      throw new BadRequestException('Mã xác thực đã hết hạn');
    }

    const isCodeValid = await bcrypt.compare(dto.code, user.verification_code);

    if (!isCodeValid) {
      // Update trực tiếp DB để đếm chính xác, chặn Race Condition
      const updatedUser = await this.userModel.findByIdAndUpdate(
        userId,
        { $inc: { failed_otp_attempts: 1 } },
        { new: true },
      );

      if (!updatedUser) {
        throw new NotFoundException('Không tìm thấy người dùng để cập nhật');
      }

      if (updatedUser.failed_otp_attempts >= 5) {
        updatedUser.otp_locked_until = new Date(Date.now() + 15 * 60000);
        await updatedUser.save();
        throw new ForbiddenException(
          'Bạn đã nhập sai mã quá 5 lần. Tính năng bị khóa trong 15 phút.',
        );
      }
      throw new BadRequestException(
        `Mã xác thực không chính xác. Bạn còn ${5 - updatedUser.failed_otp_attempts} lần thử.`,
      );
    }

    if (user.pending_email) {
      user.email = user.pending_email;
    }
    if (user.pending_phone) {
      user.phone = user.pending_phone;
    }

    const targetEmail = user.pending_email ? user.pending_email : user.email;

    // Sửa lỗi Type 'undefined' is not assignable to type 'string' / 'Date'
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          ...(user.pending_email ? { email: user.pending_email } : {}),
          ...(user.pending_phone ? { phone: user.pending_phone } : {}),
          failed_otp_attempts: 0,
        },
        $unset: {
          pending_email: 1,
          pending_phone: 1,
          verification_code: 1,
          verification_code_expires_at: 1,
        },
      },
    );

    await this.emailService.sendRaw(
      targetEmail,
      '[H&N Odyssey] Thông báo cập nhật thông tin',
      `<p>Xin chào,</p>
       <p>Thông tin liên hệ (Email/Số điện thoại) của bạn đã được cập nhật thành công trên hệ thống H&N Odyssey.</p>`,
    );

    await this.auditLogsService.log({
      action: 'CHANGE_CONTACT_INFO',
      collection_name: 'User',
      actor_id: userId,
      target_id: userId,
      department: 'SUPPORT',
      detail: {
        description: `Người dùng đã cập nhật ${user.pending_email ? 'Email' : 'Số điện thoại'}`,
      },
    });

    return {
      success: true,
      message: 'Cập nhật thông tin liên lạc thành công!',
    };
  }

  // US.121: LỊCH SỬ ĐƠN HÀNG

  async getMyOrders(userId: string, dto: GetMyOrdersDto) {
    const { status, keyword, page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;

    // AC10: Ép cứng điều kiện user_id để không ai xem được đơn người khác
    const query: FilterQuery<OrderDocument> = {
      user_id: new Types.ObjectId(userId),
    };

    // AC5: Lọc theo trạng thái
    if (status && status !== OrderStatus.ALL) {
      query.status = status;
    }

    // AC8: Tìm kiếm theo mã đơn hàng hoặc tên sản phẩm
    if (keyword) {
      const searchConditions: any[] = [
        { order_code: { $regex: keyword, $options: 'i' } },
        { 'items.product_name': { $regex: keyword, $options: 'i' } },
      ];
      if (isValidObjectId(keyword)) {
        searchConditions.push({ _id: keyword });
      }
      query.$or = searchConditions;
    }

    // Định nghĩa Interface: Sửa _id thành type an toàn thay vì 'any' để diệt lỗi ESLint
    interface LeanOrder {
      _id: import('mongoose').Types.ObjectId | string;
      order_code: string;
      createdAt: Date;
      total_amount: number;
      status: string;
      items?: Array<{
        image: string;
        product_name: string;
      }>;
    }

    // AC4, AC9: Sắp xếp giảm dần theo thời gian (Mới nhất) và Phân trang (Pagination)
    const [orders, total] = await Promise.all([
      this.orderModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec() as unknown as Promise<LeanOrder[]>,
      this.orderModel.countDocuments(query),
    ]);

    // AC3: Format dữ liệu trả về (Gom nhóm danh sách sản phẩm tóm tắt)
    const formattedOrders = orders.map((order: LeanOrder) => {
      const firstItem =
        order.items && order.items.length > 0 ? order.items[0] : null;
      const remainingCount = order.items ? order.items.length - 1 : 0;

      return {
        _id: order._id,
        order_code: order.order_code,
        createdAt: order.createdAt,
        total_amount: order.total_amount,
        status: order.status,
        summary: firstItem
          ? {
              image: firstItem.image,
              name: firstItem.product_name,
              remaining_count: remainingCount > 0 ? remainingCount : 0,
            }
          : null,
      };
    });

    return {
      data: formattedOrders,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // US.122: THEO DÕI ĐƠN HÀNG (CHI TIẾT & TIMELINE)

  async getMyOrderDetail(userId: string, orderId: string) {
    if (!isValidObjectId(orderId)) {
      throw new BadRequestException('Mã đơn hàng không hợp lệ');
    }

    const order = await this.orderModel.findById(orderId).lean().exec();

    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    // AC1 (US.122) & AC10 (US.121): Kiểm tra chặt chẽ quyền sở hữu (Chống IDOR)
    // Fix lỗi 'possibly undefined' bằng Optional Chaining và cast to String
    if (order?.user_id?.toString() !== userId.toString()) {
      throw new ForbiddenException('Bạn không có quyền truy cập đơn hàng này');
    }

    /* AC2: Timeline, AC5: Vận đơn (Tracking), AC6: Lý do hủy 
      Sẽ được thiết kế sẵn trong Schema Order (ví dụ: order.timeline, order.tracking_info, order.cancel_reason).
      Vì lean() trả về toàn bộ Document gốc, nên Front-end sẽ tự động nhận được các trường read-only này (AC8).
    */

    return {
      success: true,
      data: order,
    };
  }
}
