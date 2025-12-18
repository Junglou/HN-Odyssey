import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/schemas/user.schema';
import { Customer } from '../users/customers/schemas/customer.schema';
import { Verification } from '../auth/schema/verification.schema';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from '../auth/dto/verify.dto';
import { ResendOtpDto } from './dto/resend-otp.dto.ts';
import { CreateRecoveryDto } from './dto/create-recovery.dto';
import { ProcessRecoveryDto } from './dto/process-recovery.dto';
import { RecoveryRequest } from './schema/recovery-request.schema';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/user.Service';
import { AuditLog } from '../system/audit-logs/schemas/audit-log.schema';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from '../notifications/channels/email.service';
import { SmsService } from '../notifications/channels/sms.service';
import { RecoverAccountDto } from './dto/recover-account.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
    @InjectModel(Verification.name)
    private readonly verificationModel: Model<Verification>,
    @InjectConnection() private readonly connection: Connection,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    @InjectModel(RecoveryRequest.name)
    private recoveryModel: Model<RecoveryRequest>,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLog>,
  ) {}

  //1. ĐĂNG KÝ TÀI KHOẢN (US.01)
  async register(dto: RegisterDto) {
    // Kiểm tra xem số này có vừa yêu cầu đăng ký trong 60s qua không
    const existingOtp = await this.verificationModel.findOne({
      account: dto.email || dto.phoneNumber,
      type: 'REGISTER',
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) }, // Trong 60s
    });

    if (existingOtp) {
      throw new BadRequestException(
        'Bạn thao tác quá nhanh. Vui lòng đợi 60 giây trước khi đăng ký lại.',
      );
    }
    // AC3: Kiểm tra Email hoặc Phone đã tồn tại chưa
    const existUser = await this.userModel.findOne({
      $or: [{ email: dto.email }, { phone: dto.phoneNumber }],
    });
    if (existUser) {
      throw new ConflictException(
        'Email hoặc Số điện thoại đã được sử dụng (AC3)',
      );
    }

    // AC8: Hash mật khẩu (Sử dụng bcryptjs)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp');
    }

    // BẮT ĐẦU TRANSACTION (Để đảm bảo tạo User và OTP cùng thành công)
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // AC7: Tạo Customer mới (Status mặc định false do schema set)
      const newCustomer = new this.customerModel({
        first_Name: dto.firstName,
        last_Name: dto.lastName,
        email: dto.email,
        phone: dto.phoneNumber,
        password: hashedPassword,
        roles: ['CUSTOMER'],
        is_active: false,
      });
      await newCustomer.save({ session });

      // AC10: Tạo mã OTP
      const otpCode = this.generateOtpCode();
      const expiredAt = new Date(Date.now() + 5 * 60 * 1000); // Hết hạn sau 5p

      const accountTarget = dto.email || dto.phoneNumber;

      // Lưu OTP vào DB
      const verification = new this.verificationModel({
        account: dto.email || dto.phoneNumber,
        code: otpCode,
        type: 'REGISTER',
        expired_at: expiredAt,
      });
      await verification.save({ session });

      // GỬI OTP THẬT (AC9)
      if (dto.email) {
        await this.emailService
          .sendOtp(dto.email, otpCode)
          .catch((e) => this.logger.error('Lỗi gửi mail:', e));
      } else if (dto.phoneNumber) {
        await this.smsService
          .sendOtp(dto.phoneNumber, otpCode)
          .catch((e) => this.logger.error('Lỗi gửi SMS:', e));
      }

      await session.commitTransaction();
      return {
        message: `Đăng ký thành công. Vui lòng kiểm tra ${
          dto.email ? 'Email' : 'Tin nhắn'
        } để nhập OTP.`,
        account: accountTarget,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  //2. XÁC THỰC OTP (AC13)
  async verifyOtp(dto: VerifyOtpDto, ip: string, userAgent: string) {
    // Tìm bản ghi OTP
    const record = await this.verificationModel.findOne({
      account: dto.account,
      type: dto.type,
    });

    // AC5: Báo lỗi nếu không tìm thấy
    if (!record) {
      throw new BadRequestException(
        'Mã xác thực không tồn tại hoặc đã hết hạn.',
      );
    }

    if (record.failed_attempts >= 5) {
      // Nếu đang trong thời gian khóa
      if (record.lock_until && record.lock_until > new Date()) {
        throw new BadRequestException(
          'Bạn nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.',
        );
      }
      // Nếu đã HẾT thời gian khóa -> Reset lại để cho phép thử
      else {
        record.failed_attempts = 0;
        record.lock_until = null;
        await record.save();
      }
    }

    // AC10: Check hết hạn OTP (Dù DB có TTL nhưng code vẫn nên check kỹ)
    if (new Date() > record.expired_at) {
      throw new BadRequestException('Mã xác thực đã hết hạn.');
    }

    if (record.code !== dto.code) {
      // Tăng biến đếm sai
      record.failed_attempts = (record.failed_attempts || 0) + 1;

      // Nếu sai đủ 5 lần -> Set thời gian khóa
      if (record.failed_attempts >= 5) {
        record.lock_until = new Date(Date.now() + 15 * 60 * 1000); // Khóa 15p
      }

      await record.save();

      throw new BadRequestException(
        `Mã không đúng. Bạn còn ${5 - record.failed_attempts} lần thử.`,
      );
    }

    // NẾU CODE ĐÚNG -> XỬ LÝ TIẾP
    if (dto.type === 'REGISTER') {
      const user = await this.userModel.findOneAndUpdate(
        {
          $or: [{ email: dto.account }, { phone: dto.account }],
        },
        { is_active: true }, // Kích hoạt tài khoản
        { new: true },
      );

      if (!user)
        throw new NotFoundException('Không tìm thấy tài khoản tương ứng.');

      // Xóa OTP sau khi dùng xong (Quan trọng để không dùng lại được - AC4)
      await record.deleteOne();

      // AC14: Tự động đăng nhập
      const accessToken = await this.generateAccessToken(user);
      const refreshToken = await this.generateRefreshToken(user, false);

      // Lưu Refresh Token vào User (Logic Login) - QUAN TRỌNG
      const hashedRt = await bcrypt.hash(refreshToken, 10);
      await this.userModel.updateOne(
        { _id: user._id },
        { refresh_token: hashedRt },
      );

      // Ghi Audit Log Verify Thành công
      await this.auditLogModel.create({
        actor_id: user._id,
        action: 'VERIFY_OTP_SUCCESS',
        collection_name: 'users',
        detail: { account: dto.account },
        ip: ip,
        user_agent: userAgent,
      });

      return {
        message: 'Xác thực thành công. Tài khoản đã được kích hoạt.',
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          _id: user._id,
          email: user.email,
          full_name: user.last_Name + ' ' + user.first_Name, // Lưu ý check null nếu user chỉ có full_name
          roles: user.roles,
        },
      };
    }
  }

  //3. GỬI LẠI OTP (AC12)
  async resendOtp(dto: ResendOtpDto) {
    const user = await this.userModel.findOne({ email: dto.account });
    if (!user) throw new NotFoundException('Tài khoản không tồn tại.');

    // Kiểm tra xem có OTP nào vừa gửi trong 1 phút qua không (Rate Limit)
    const lastOtp = await this.verificationModel.findOne({
      account: dto.account,
      type: dto.type,
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) }, // Mới tạo trong 60s
    });

    if (lastOtp) {
      throw new BadRequestException(
        'Vui lòng đợi 60 giây trước khi gửi lại mã mới (AC12).',
      );
    }

    // Xóa mã cũ (nếu có)
    await this.verificationModel.deleteMany({
      account: dto.account,
      type: dto.type,
    });

    // Tạo mã mới
    const otpCode = this.generateOtpCode();
    const expiredAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.verificationModel.create({
      account: dto.account,
      code: otpCode,
      type: dto.type,
      expired_at: expiredAt,
    });

    // TODO: Gửi mail lại
    // GỬI LẠI MÃ THẬT
    const isEmail = dto.account.includes('@');
    if (isEmail) {
      this.emailService
        .sendOtp(dto.account, otpCode)
        .catch((e) => this.logger.error(e));
    } else {
      this.smsService
        .sendOtp(dto.account, otpCode)
        .catch((e) => this.logger.error(e));
    }

    return { message: 'Mã xác thực mới đã được gửi.' };
  }

  //PRIVATE HELPERS
  private generateOtpCode(): string {
    // Tạo 6 số ngẫu nhiên
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  //4. VALIDATE USER (Dùng cho LocalStrategy)
  //Xử lý AC3, AC4, AC5 (Brute-force)
  async validateUser(account: string, password: string) {
    const isEmail = account.includes('@');
    // Validate email/phone
    if (isEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(account)) {
        throw new BadRequestException('Email không hợp lệ');
      }
    } else {
      const phoneRegex = /^(03|05|07|08|09)[0-9]{8}$/;
      if (!phoneRegex.test(account)) {
        throw new BadRequestException('Số điện thoại không hợp lệ');
      }
    }

    const user = await this.usersService.findByEmailOrPhone(account);
    if (!user) {
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không chính xác',
      );
    }

    // CHƯA KÍCH HOẠT
    if (!user.is_active) {
      throw new UnauthorizedException('Tài khoản đang chờ xác thực');
    }

    // ĐANG BỊ KHÓA
    if (user.lock_until && user.lock_until > new Date()) {
      throw new UnauthorizedException('Tài khoản đang bị khóa tạm thời');
    }

    // BRUTE FORCE
    if (user.login_attempts >= 5) {
      throw new UnauthorizedException(
        'Bạn đã nhập sai quá nhiều lần, vui lòng thử lại sau',
      );
    }

    // Không có password (Google/Facebook user)
    if (!user.password) {
      throw new UnauthorizedException(
        'Tài khoản của bạn không dùng mật khẩu để đăng nhập',
      );
    }

    // So sánh mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      await this.handleLoginFail(user);
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không chính xác',
      );
    }

    await this.usersService.resetFailedAttempt(user.id);

    return user;
  }

  //5. LOGIN (Tạo Token)
  //Xử lý AC6, AC12, AC13, AC14
  private async generateAccessToken(user: any) {
    const payload = {
      sub: user._id,
      email: user.email,
      roles: user.roles,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') ||
        '1h') as any,
    });
  }

  private async generateRefreshToken(
    user: any,
    isRemember: boolean,
  ): Promise<string> {
    const payload = {
      sub: user._id,
      email: user.email,
      roles: user.roles,
    };

    const expiresIn = isRemember ? '30d' : '1d';

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: expiresIn as any,
    });
  }

  // [FIX] Cập nhật tham số để nhận ip, userAgent
  async login(
    user: any,
    isRemember: boolean = false,
    ip: string,
    userAgent: string,
  ) {
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user, isRemember);

    // Hash refresh token
    const hashed = await bcrypt.hash(refreshToken, 10);

    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { refresh_token: hashed } },
    );

    await this.auditLogModel.create({
      actor_id: user._id,
      action: 'LOGIN_SUCCESS',
      collection_name: 'users',
      detail: {
        roles: user.roles,
        method: user.social_auth ? 'OAUTH' : 'LOCAL',
        remember_me: isRemember,
      },
      ip: ip,
      user_agent: userAgent,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        _id: user._id,
        email: user.email,
        full_name: user.full_name,
        roles: user.roles,
        avatar: user.avatar,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Thiếu refresh token');
    }

    // decode & verify refresh token
    let decoded;
    try {
      decoded = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (e) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc hết hạn',
      );
    }

    const user = await this.userModel.findById(decoded.sub);
    if (!user) throw new NotFoundException('User không tồn tại');

    if (!user.refresh_token) {
      throw new UnauthorizedException('Refresh token đã bị thu hồi');
    }

    // Kiểm tra refresh token có khớp hash
    const isValid = await bcrypt.compare(refreshToken, user.refresh_token);
    if (!isValid) {
      throw new UnauthorizedException('Refresh token không khớp');
    }

    // Rotation tạo token mới
    const newAccessToken = await this.generateAccessToken(user);
    const newRefreshToken = await this.generateRefreshToken(user, false);
    const newHash = await bcrypt.hash(newRefreshToken, 10);

    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { refresh_token: newHash } },
    );

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    };
  }

  async logout(userId: string) {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { refresh_token: null } },
    );
    return { message: 'Đăng xuất thành công' };
  }

  //PRIVATE HELPER: Xử lý Brute-force
  private async handleLoginFail(user: any) {
    const MAX_ATTEMPTS = 5;
    const LOCK_TIME_MINUTES = 30;

    user.login_attempts += 1;

    if (user.login_attempts >= MAX_ATTEMPTS) {
      user.lock_until = new Date(Date.now() + LOCK_TIME_MINUTES * 60 * 1000);
      await user.save();
      // AC5: Thông báo
      throw new BadRequestException(
        `Bạn đã nhập sai quá ${MAX_ATTEMPTS} lần. Tài khoản bị khóa ${LOCK_TIME_MINUTES} phút.`,
      );
    } else {
      await user.save();
    }
  }

  // 6. XỬ LÝ LOGIN OAUTH (Google/Facebook)
  // [FIX] Cập nhật tham số để nhận ip, userAgent
  async validateOAuthLogin(
    profile: any,
    provider: 'google' | 'facebook',
    ip: string,
    userAgent: string,
  ) {
    const { email, id, displayName, firstName, lastName, name, picture } =
      profile;

    if (!id) {
      throw new BadRequestException(
        `Lỗi bảo mật: Không tìm thấy ID từ ${provider}. Vui lòng thử lại.`,
      );
    }

    // AC9: Từ chối nếu không có Email
    if (!email) {
      throw new BadRequestException(
        'Không thể đăng nhập vì tài khoản mạng xã hội không cung cấp Email (AC9).',
      );
    }

    // --- XỬ LÝ TÊN HIỂN THỊ ---
    let finalName = displayName;
    if (!finalName || finalName === 'undefined undefined') {
      finalName = name;
    }
    if (
      !finalName ||
      finalName.trim() === '' ||
      finalName === 'undefined undefined'
    ) {
      const f = firstName || '';
      const l = lastName || '';
      if (f || l) {
        finalName = `${f} ${l}`.trim();
      }
    }
    if (
      !finalName ||
      finalName.trim() === '' ||
      finalName === 'undefined undefined'
    ) {
      finalName = email.split('@')[0];
    }

    // AC8: Check xem tài khoản MXH này đã liên kết với User nào khác chưa?
    const querySocial = {};
    querySocial[`social_auth.${provider}_id`] = id;
    const existingSocialUser = await this.userModel.findOne(querySocial);

    if (existingSocialUser) {
      // AC4: Check xem có bị khóa không
      this.checkUserBanStatus(existingSocialUser);
      // Nếu đã tồn tại liên kết -> Đăng nhập luôn
      // [FIX] Truyền IP/UA
      return this.login(existingSocialUser, false, ip, userAgent);
    }

    // AC2: Nếu chưa có liên kết -> Tìm theo Email
    const existingEmailUser = await this.userModel.findOne({ email });

    if (existingEmailUser) {
      // AC4: Check ban
      this.checkUserBanStatus(existingEmailUser);

      // AC10: Auto Merge (Giản lược cho MVP)
      const updateData = {};
      updateData[`social_auth.${provider}_id`] = id;

      await this.userModel.updateOne(
        { _id: existingEmailUser._id },
        { $set: updateData },
      );

      // Fetch lại user mới nhất
      const updatedUser = await this.userModel.findById(existingEmailUser._id);
      // [FIX] Truyền IP/UA
      return this.login(updatedUser, false, ip, userAgent);
    }

    const socialPhone = profile.phone || profile.phoneNumber;

    if (socialPhone) {
      const existingPhoneUser = await this.userModel.findOne({
        phone: socialPhone,
      });

      if (existingPhoneUser) {
        // AC10: Hệ thống không được tự động gộp -> Báo lỗi Conflict (409)
        throw new ConflictException({
          statusCode: 409,
          message:
            'Số điện thoại liên kết với MXH này đã tồn tại trên một tài khoản khác.',
          error_code: 'OAUTH_PHONE_CONFLICT',
          details: {
            social_email: email,
            conflict_phone: socialPhone,
          },
        });
      }
    }

    // AC2 (Vế 2): Email chưa tồn tại -> Tạo tài khoản mới
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      let saveFirstName = firstName;
      let saveLastName = lastName;

      // Nếu profile không có sẵn firstName/lastName, tự tách từ finalName
      if (!saveFirstName || !saveLastName) {
        const nameParts = finalName.trim().split(' ');
        if (nameParts.length === 1) {
          // Nếu tên chỉ có 1 chữ -> Set giống nhau để tránh lỗi required
          saveFirstName = nameParts[0];
          saveLastName = nameParts[0];
        } else {
          // Logic: Chữ cuối là Tên, phần trước là Họ đệm
          saveFirstName = nameParts.pop();
          saveLastName = nameParts.join(' ');
        }
      }

      const newUser = new this.customerModel({
        email: email,
        full_name: finalName,
        first_Name: saveFirstName,
        last_Name: saveLastName,
        phone: null,
        is_active: true,
        roles: ['CUSTOMER'],
        type: 'Customer',
        social_auth: {
          [provider + '_id']: id,
        },
        password: null, // AC3
      });

      // Fix lỗi null phone unique index
      if (!newUser.phone) {
        newUser.set('phone', undefined);
      }

      await newUser.save({ session });

      // [FIX] Ghi Audit Log ĐÚNG VỊ TRÍ
      await this.auditLogModel.create({
        actor_id: newUser._id,
        action: 'REGISTER_OAUTH_SUCCESS', // Ghi nhận đây là lần đăng ký mới
        collection_name: 'users',
        detail: { provider: provider, email: email },
        ip: ip,
        user_agent: userAgent,
      });

      await session.commitTransaction();

      // Đăng nhập luôn
      // [FIX] Truyền IP/UA
      return this.login(newUser, false, ip, userAgent);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Helper check ban (Tách ra từ hàm validateUser cũ để tái sử dụng)
  private checkUserBanStatus(user: any) {
    if (user.lock_until && user.lock_until > new Date()) {
      throw new BadRequestException('Tài khoản đang bị tạm khóa (AC4).');
    }
    if (!user.is_active) {
      // Với OAuth, thường là active luôn, nhưng nếu bị Admin ban thủ công:
      // throw new BadRequestException('Tài khoản đã bị vô hiệu hóa.');
    }
  }

  //7. GỬI YÊU CẦU KHÔI PHỤC (User - AC1, AC2)
  async requestRecovery(dto: CreateRecoveryDto, filePaths: string[]) {
    // Lưu thông tin vào DB
    const request = new this.recoveryModel({
      ...dto,
      images: filePaths, // AC2: Đường dẫn ảnh đã upload
      status: 'PENDING',
    });
    await request.save();
    return {
      message:
        'Yêu cầu đã được gửi. Chúng tôi sẽ phản hồi qua Email liên hệ trong 24h.',
    };
  }

  //8. LẤY DANH SÁCH YÊU CẦU (Admin - AC3)
  async getPendingRecoveries() {
    return this.recoveryModel
      .find({ status: 'PENDING' })
      .sort({ createdAt: 1 });
  }

  // 9. XỬ LÝ YÊU CẦU (Admin - AC4, AC5, AC6, AC7)
  // [FIX] Thêm tham số ip, userAgent
  async processRecovery(
    requestId: string,
    dto: ProcessRecoveryDto,
    adminId: string,
    // Nên truyền thêm IP và UserAgent từ Controller xuống để log chính xác
    ip: string = 'Unknown',
    userAgent: string = 'Unknown',
  ) {
    const request = await this.recoveryModel.findById(requestId);
    if (!request) throw new NotFoundException('Yêu cầu không tồn tại');
    if (request.status !== 'PENDING')
      throw new BadRequestException('Yêu cầu này đã được xử lý trước đó.');

    // Khởi tạo biến để lưu kết quả trả về
    let responseMessage = '';
    let actionType = '';

    // CASE 1: TỪ CHỐI (REJECTED)
    if (dto.status === 'REJECTED') {
      if (!dto.rejection_reason)
        throw new BadRequestException('Vui lòng nhập lý do từ chối.');

      request.status = 'REJECTED';
      request.rejection_reason = dto.rejection_reason;
      request.processed_by = adminId as any;
      request.processed_at = new Date();
      await request.save();

      // Gửi email báo từ chối
      await this.emailService.sendRaw(
        request.contact_email,
        '[H&N Odyssey] Phản hồi yêu cầu khôi phục',
        `<p>Yêu cầu của bạn đã bị từ chối.</p><p>Lý do: <b>${dto.rejection_reason}</b></p>`,
      );

      responseMessage = 'Đã từ chối yêu cầu.';
      actionType = 'REJECT_RECOVERY_REQUEST';
    }

    // CASE 2: CHẤP THUẬN (APPROVED)
    else if (dto.status === 'APPROVED') {
      // 1. Tìm User gốc
      const user = await this.userModel.findOne({
        $or: [
          { email: request.target_account },
          { phone: request.target_account },
        ],
      });

      if (!user) {
        throw new BadRequestException(
          'Không tìm thấy tài khoản gốc trong hệ thống (dựa trên target_account).',
        );
      }

      // 2. Tạo Token Reset Mật khẩu (Admin Reset)
      const resetToken = this.generateRandomString(32);
      const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      await this.verificationModel.create({
        account: request.contact_email,
        code: resetToken,
        type: 'ADMIN_RESET_PASSWORD',
        expired_at: expiredAt,
        linked_user_id: { userId: user._id },
      });

      // 3. Cập nhật trạng thái Request
      request.status = 'APPROVED';
      request.processed_by = adminId as any;
      request.processed_at = new Date();
      await request.save();

      // 4. Gửi Email
      const link = `https://hn-odyssey.com/recovery-reset?token=${resetToken}&email=${request.contact_email}`;
      await this.emailService.sendResetPasswordLink(
        request.contact_email,
        link,
      );

      responseMessage =
        'Đã duyệt yêu cầu và gửi link khôi phục đến email liên hệ.';
      actionType = 'APPROVE_RECOVERY_REQUEST';
    }

    // GHI AUDIT LOG (AC7) - CHẠY CHO CẢ 2 TRƯỜNG HỢP
    if (actionType) {
      await this.auditLogModel.create({
        actor_id: adminId,
        action: actionType,
        collection_name: 'recovery_requests',
        detail: {
          request_id: requestId,
          target_account: request.target_account,
          reason: dto.rejection_reason || 'Approved', // Ghi lý do nếu từ chối
        },
        ip: ip,
        user_agent: userAgent,
      });
    }

    return { message: responseMessage };
  }

  // Helper
  private generateRandomString(length: number) {
    // Logic tạo chuỗi ngẫu nhiên (hoặc dùng thư viện uuid/crypto)
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  //10. QUÊN MẬT KHẨU (US.03 - AC1, AC2, AC3, AC6)
  async forgotPassword(account: string, ip: string, userAgent: string) {
    // AC6: Ghi Log ngay lập tức (kể cả user có tồn tại hay không)
    await this.auditLogModel.create({
      action: 'FORGOT_PASSWORD_REQUEST',
      collection_name: 'users',
      detail: { account: account },
      ip: ip,
      user_agent: userAgent,
    });

    // 1. Tìm user (Email hoặc Phone)
    const user = await this.userModel.findOne({
      $or: [{ email: account }, { phone: account }],
    });

    // AC2: QUAN TRỌNG - Nếu không thấy user, vẫn return Success giả
    // Tuyệt đối không throw NotFoundException để tránh Hacker dò user
    if (!user) {
      // Giả lập độ trễ để hacker không đoán được qua thời gian phản hồi
      await new Promise((r) => setTimeout(r, 1000));
      return {
        message: 'Nếu tài khoản tồn tại, chúng tôi đã gửi hướng dẫn khôi phục.',
      };
    }

    // AC4: Thời gian hiệu lực 10 phút
    const expiredAt = new Date(Date.now() + 10 * 60 * 1000);

    // Xóa mã cũ nếu có
    await this.verificationModel.deleteMany({
      account: account,
      type: 'RESET_PASSWORD',
    });

    // AC3: Phân loại Email vs Phone
    const isEmail = account.includes('@');
    let code = '';

    if (isEmail) {
      // Email -> Token (Link) - Dùng chuỗi dài
      code =
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);

      const link = `https://hn-odyssey.com/reset-password?token=${code}&email=${account}`;

      // Gửi Email
      this.emailService
        .sendResetPasswordLink(account, link)
        .catch((e) => this.logger.error(e));
    } else {
      // Phone -> OTP (SMS) - Dùng 6 số
      code = Math.floor(100000 + Math.random() * 900000).toString();

      // Gửi SMS
      this.smsService.sendOtp(account, code).catch((e) => this.logger.error(e));
    }

    // Lưu vào DB
    await this.verificationModel.create({
      account: account,
      code: code,
      type: 'RESET_PASSWORD', // Type riêng
      expired_at: expiredAt,
    });

    return {
      message: 'Nếu tài khoản tồn tại, chúng tôi đã gửi hướng dẫn khôi phục.',
    };
  }

  // 11. ĐẶT LẠI MẬT KHẨU (Quên mật khẩu thường)
  async resetPassword(dto: ResetPasswordDto, ip: string) {
    if (dto.newPassword !== dto.confirmNewPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp.');
    }

    // Chỉ tìm loại RESET_PASSWORD thường
    const verifyRecord = await this.verificationModel.findOne({
      account: dto.account,
      code: dto.code,
      type: 'RESET_PASSWORD',
    });

    if (!verifyRecord || verifyRecord.expired_at < new Date()) {
      throw new BadRequestException(
        'Mã xác thực hoặc Link không hợp lệ/hết hạn.',
      );
    }

    const user = await this.userModel.findOne({
      $or: [{ email: dto.account }, { phone: dto.account }],
    });

    if (!user) throw new NotFoundException('User không tồn tại.');

    // CHỈ ĐỔI PASS, KHÔNG CÓ LOGIC ĐỔI EMAIL Ở ĐÂY -> AN TOÀN TUYỆT ĐỐI
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(dto.newPassword, salt);
    user.is_active = true;

    await user.save();
    await verifyRecord.deleteOne();

    //Ghi Log
    return { message: 'Đặt lại mật khẩu thành công.' };
  }

  //12. KHÔI PHỤC TÀI KHOẢN (Theo link từ Admin)
  async recoverAccount(dto: RecoverAccountDto, ip: string) {
    if (dto.newPassword !== dto.confirmNewPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp.');
    }

    // 1. Chỉ tìm Token loại ADMIN_RESET_PASSWORD
    const verifyRecord = await this.verificationModel.findOne({
      account: dto.account,
      code: dto.code,
      type: 'ADMIN_RESET_PASSWORD', // Fix cứng loại này
    });

    if (!verifyRecord) {
      throw new BadRequestException('Liên kết khôi phục không hợp lệ.');
    }

    if (verifyRecord.expired_at < new Date()) {
      throw new BadRequestException('Liên kết đã hết hạn.');
    }

    // 2. Tìm User gốc từ metadata
    const userId = verifyRecord.linked_user_id?.['userId'];
    const user = await this.userModel.findById(userId);

    if (!user) throw new NotFoundException('Tài khoản gốc không tồn tại.');

    // 3. Xử lý đổi Email (Bắt buộc check trùng)
    if (dto.newEmail !== user.email) {
      const duplicate = await this.userModel.findOne({ email: dto.newEmail });
      if (duplicate) {
        throw new ConflictException(`Email ${dto.newEmail} đã được sử dụng.`);
      }
      user.email = dto.newEmail; // Cập nhật email mới
    }

    // 4. Đổi mật khẩu & Active
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(dto.newPassword, salt);

    user.lock_until = null;
    user.login_attempts = 0;
    user.is_active = true;

    await user.save();
    await verifyRecord.deleteOne();

    // 5. Audit Log riêng
    await this.auditLogModel.create({
      actor_id: user._id,
      action: 'ACCOUNT_RECOVERY_SUCCESS', // Action name rõ ràng hơn
      collection_name: 'users',
      ip: ip,
      detail: {
        old_email: verifyRecord.account,
        new_email: dto.newEmail,
      },
    });

    return { message: 'Khôi phục tài khoản thành công.' };
  }
}
