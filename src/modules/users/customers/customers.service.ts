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
import { UserStatus } from 'src/common/enums/user-status.enum';
import {
  RequestChangeContactDto,
  VerifyContactChangeDto,
  ContactType,
} from './dto/change-contact.dto';
import { GetMyOrdersDto, OrderStatus } from './dto/get-my-orders.dto';
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

  // CHUYỂN KHÁCH VÃNG LAI THÀNH THÀNH VIÊN
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
    const guestUsername =
      order.guest_info.email.split('@')[0] +
      '_' +
      Date.now().toString().slice(-4);

    const newUser = await this.userModel.create({
      username: guestUsername,
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

    // Gửi email thông báo tài khoản kèm mật khẩu cho khách hàng
    await this.emailService.sendRaw(
      order.guest_info.email,
      '[H&N Odyssey] Chào mừng bạn trở thành thành viên!',
      `<p>Xin chào ${order.guest_info.name},</p>
       <p>Hệ thống đã tự động tạo tài khoản thành viên cho bạn dựa trên thông tin đơn hàng <b>${order.order_code}</b>.</p>
       <p><b>Thông tin đăng nhập của bạn:</b></p>
       <ul>
         <li>Tên đăng nhập / Email: <b>${order.guest_info.email}</b></li>
         <li>Mật khẩu: <b>${password}</b></li>
       </ul>
       <p>Vui lòng đăng nhập và tiến hành đổi mật khẩu để bảo mật tài khoản.</p>`,
    );

    return {
      success: true,
      message: 'Tạo tài khoản thành công. Đã gửi email thông báo.',
      userId: newUser._id,
    };
  }

  // US.04: QUẢN LÝ TÀI KHOẢN VÀ BẢO MẬT
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
      query.status = status;
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
}
