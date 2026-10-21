import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery, isValidObjectId } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import {
  Order,
  OrderDocument,
} from 'src/modules/sales/orders/schemas/order.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import {
  RequestChangeContactDto,
  VerifyContactChangeDto,
  ContactType,
} from './dto/change-contact.dto';
import { GetMyOrdersDto, OrderStatus } from './dto/get-my-orders.dto';
import { EmailService } from 'src/modules/notifications/channels/email.service';
import { SmsService } from 'src/modules/notifications/channels/sms.service';
import { AuditLogsService } from 'src/modules/system/audit-logs/audit-logs.service';

// Chỉ trả về cho khách những field trang cá nhân cần (whitelist).
// Không trả: password, refresh_token, token_version, login_attempts, lock_until,
// internal_note, status_reason, assigned_warehouse, is_deleted...
const PUBLIC_PROFILE_FIELDS = [
  '_id',
  'type', // khóa discriminator, cần để Mongoose dựng đúng document Customer
  'avatar',
  'username',
  'email',
  'phone',
  'first_Name',
  'last_Name',
  'gender',
  'dateOfBirth',
  'social_auth',
  'roles',
  'status',
  'last_login_at',
  'createdAt',
  'updatedAt',
  'loyalty',
  'addresses',
  'wishlist',
  'is_subscribed',
  'review_access',
  'search_preferences',
  'followed_brands',
].join(' ');

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // US.04: QUẢN LÝ TÀI KHOẢN VÀ BẢO MẬT
  async getProfile(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select(PUBLIC_PROFILE_FIELDS)
      .exec();
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return this.toProfileResponse(user);
  }

  async updateProfile(userId: string, updateDto: UpdateProfileDto) {
    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: updateDto },
      { new: true, runValidators: true, projection: PUBLIC_PROFILE_FIELDS },
    );
    if (!updatedUser) throw new NotFoundException('Không tìm thấy người dùng');
    return { success: true, data: await this.toProfileResponse(updatedUser) };
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    await this.userModel.findByIdAndUpdate(userId, { avatar: avatarUrl });
    return { success: true, avatar: avatarUrl };
  }

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

  // Trả profile kèm has_password (KHÔNG trả hash, chỉ trả true/false)
  private async toProfileResponse(user: UserDocument) {
    const hasPassword = await this.userModel.exists({
      _id: user._id,
      password: { $type: 'string', $ne: '' },
    });
    return {
      ...(user.toJSON() as Record<string, unknown>),
      has_password: !!hasPassword,
    };
  }

  // Đặt mật khẩu lần đầu cho tài khoản tạo bằng Google/Facebook (chưa có mật khẩu)
  async setPassword(userId: string, dto: SetPasswordDto) {
    const user = await this.userModel
      .findById(userId)
      .select('+password')
      .exec();
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');

    if (user.password) {
      throw new BadRequestException(
        'Tài khoản đã có mật khẩu. Vui lòng dùng chức năng đổi mật khẩu.',
      );
    }

    user.password = await this.hashPassword(dto.newPassword);
    await user.save();

    await this.emailService.sendRaw(
      user.email,
      '[H&N Odyssey] Thông báo bảo mật: Đã đặt mật khẩu cho tài khoản',
      `<p>Xin chào,</p>
       <p>Tài khoản của bạn vừa được đặt mật khẩu. Từ giờ bạn có thể đăng nhập bằng email và mật khẩu, bên cạnh Google/Facebook.</p>
       <p>Nếu bạn không thực hiện yêu cầu này, vui lòng liên hệ ngay với bộ phận CSKH.</p>`,
    );

    await this.auditLogsService.log({
      action: 'SET_PASSWORD',
      collection_name: 'User',
      actor_id: userId,
      target_id: userId,
      department: 'SUPPORT',
      detail: {
        description: 'Tài khoản đăng nhập mạng xã hội đã đặt mật khẩu lần đầu',
      },
    });

    return {
      success: true,
      message:
        'Đặt mật khẩu thành công. Từ giờ bạn có thể đăng nhập bằng email và mật khẩu.',
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

    const isEmail = dto.type === ContactType.EMAIL;
    // Nếu là Phone thì Twilio tự sinh mã, ta chỉ gán giá trị giữ chỗ vào DB
    const verificationCode = isEmail
      ? Math.floor(100000 + Math.random() * 900000).toString()
      : 'TWILIO_VERIFY_CODE';
    const expiresAt = new Date(now.getTime() + 5 * 60000);

    await this.userModel.findByIdAndUpdate(userId, {
      ...(isEmail
        ? { pending_email: dto.newValue }
        : { pending_phone: dto.newValue }),
      verification_code: await this.hashPassword(verificationCode),
      verification_code_expires_at: expiresAt,
      last_code_sent_at: now,
      failed_otp_attempts: 0,
    });

    if (isEmail) {
      await this.emailService.sendOtp(dto.newValue, verificationCode);
    } else if (dto.type === ContactType.PHONE) {
      await this.smsService.sendOtp(dto.newValue); // Đã fix lỗi 2 tham số
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

    let isCodeValid = false;

    // Phân luồng kiểm tra OTP
    if (user.pending_phone) {
      // 1. Nếu là đổi SĐT -> Gọi sang Twilio Verify
      isCodeValid = await this.smsService.verifyOtp(
        user.pending_phone,
        dto.code,
      );
    } else if (user.pending_email) {
      // 2. Nếu là đổi Email -> Check DB nội bộ
      if (
        user.verification_code_expires_at &&
        user.verification_code_expires_at < new Date()
      ) {
        throw new BadRequestException('Mã xác thực đã hết hạn');
      }
      isCodeValid = await bcrypt.compare(dto.code, user.verification_code);
    }

    // Logic xử lý khi sai OTP (Giữ nguyên của bạn)
    if (!isCodeValid) {
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

    // Logic khi thành công
    if (user.pending_email) {
      user.email = user.pending_email;
    }
    if (user.pending_phone) {
      user.phone = user.pending_phone;
    }

    const targetEmail = user.pending_email ? user.pending_email : user.email;

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

    const query: FilterQuery<OrderDocument> = {
      user_id: new Types.ObjectId(userId),
    };

    if (status && status !== OrderStatus.ALL) {
      if (String(status) === 'COMPLETED' || String(status) === 'DELIVERED') {
        query.status = { $in: ['COMPLETED', 'DELIVERED'] };
      } else {
        query.status = status;
      }
    }

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

    interface LeanOrder {
      _id: import('mongoose').Types.ObjectId | string;
      order_code: string;
      createdAt: Date;
      total_amount: number;
      status: string;
      items?: Array<{
        image: string;
        product_name: string;
        price: number;
        quantity: number;
      }>;
    }

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
              price: firstItem.price,
              quantity: firstItem.quantity,
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

    if (order?.user_id?.toString() !== userId.toString()) {
      throw new ForbiddenException('Bạn không có quyền truy cập đơn hàng này');
    }

    return {
      success: true,
      data: order,
    };
  }

  // THÊM MỚI: Lưu cấu hình tìm kiếm/lọc của user (US.5 TB - AC15)
  async saveSearchPreferences(
    userId: string,
    filters?: Record<string, any>,
    sort?: string,
  ) {
    // FIX ESLINT: Khai báo Record cụ thể thay vì dùng kiểu 'any' lỏng lẻo
    const updateData: Record<string, unknown> = {};

    if (filters !== undefined) {
      updateData['search_preferences.last_filters'] = filters;
    }

    if (sort !== undefined) {
      updateData['search_preferences.last_sort'] = sort;
    }

    await this.userModel.findByIdAndUpdate(
      userId,
      { $set: updateData }, // Bây giờ $set đã nhận được 1 Object an toàn, hết báo lỗi unsafe-assignment
      { new: true },
    );

    return { success: true, message: 'Đã lưu trạng thái tìm kiếm/lọc' };
  }
}
