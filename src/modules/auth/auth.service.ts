import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Logger,
  ForbiddenException,
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
import { CreateRecoveryDto } from './dto/create-recovery.dto';
import { ProcessRecoveryDto } from './dto/process-recovery.dto';
import { RecoveryRequest } from './schema/recovery-request.schema';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/user.Service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { EmailService } from '../notifications/channels/email.service';
import { SmsService } from '../notifications/channels/sms.service';
import { RecoverAccountDto } from './dto/recover-account.dto';
import { AuditLogsService } from '../system/audit-logs/audit-logs.service';
import { UserStatus } from 'src/common/enums/user-status.enum';
import { ResendOtpDto } from './dto/resend-otp.dto.ts';
import { randomBytes } from 'crypto';

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
    private readonly auditLogsService: AuditLogsService,
  ) {}

  //1. ĐĂNG KÝ TÀI KHOẢN (US.01)
  async register(dto: RegisterDto, ip: string, userAgent: string) {
    if (dto.phoneNumber) {
      dto.phoneNumber = this.normalizePhoneNumber(dto.phoneNumber);
    }
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

    // BẮT ĐẦU TRANSACTION
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // AC7: Tạo Customer mới
      const newCustomer = new this.customerModel({
        first_Name: dto.firstName,
        last_Name: dto.lastName,
        email: dto.email,
        phone: dto.phoneNumber,
        password: hashedPassword,
        roles: ['CUSTOMER'],
        is_active: false,
        status: UserStatus.INACTIVE, // Set status rõ ràng
      });
      await newCustomer.save({ session });

      // AC10: Tạo mã OTP
      const otpCode = this.generateOtpCode();
      const expiredAt = new Date(Date.now() + 5 * 60 * 1000); // Hết hạn sau 5p

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

      // [FIX] Ghi Log Đăng ký
      await this.auditLogsService.log({
        action: 'REGISTER_LOCAL',
        collection_name: 'users',
        actor_id: newCustomer._id, // User chưa active nhưng vẫn ghi nhận ID
        target_id: newCustomer._id,
        detail: {
          email: dto.email,
          phone: dto.phoneNumber,
          status: 'PENDING_OTP',
        },
        ip: ip,
        user_agent: userAgent,
      });

      return {
        message: `Đăng ký thành công. Vui lòng kiểm tra ${
          dto.email ? 'Email' : 'Tin nhắn'
        } để nhập OTP.`,
        account: dto.email || dto.phoneNumber,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  // PRIVATE HELPER: Chuẩn hóa số điện thoại VN
  private normalizePhoneNumber(phone: string): string {
    if (!phone) return phone;

    // 1. Loại bỏ tất cả ký tự không phải số (khoảng trắng, dấu chấm, gạch ngang, ngoặc đơn)
    // Ví dụ: "+84 987-654-321" -> "84987654321"
    let cleaned = phone.replace(/\D/g, '');

    // 2. Chuyển đổi đầu số quốc tế (84) về đầu số 0
    // Ví dụ: "84987..." -> "0987..."
    if (cleaned.startsWith('84')) {
      cleaned = '0' + cleaned.slice(2);
    }

    // Lưu ý: Nếu user nhập +84... thì bước 1 đã xóa dấu + thành 84...,
    // bước 2 sẽ xử lý tiếp thành 0... -> Logic vẫn đúng.

    return cleaned;
  }

  //2. XÁC THỰC OTP (AC13)
  async verifyOtp(dto: VerifyOtpDto, ip: string, userAgent: string) {
    if (!dto.account.includes('@')) {
      dto.account = this.normalizePhoneNumber(dto.account);
    }
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
        {
          is_active: true,
          status: UserStatus.ACTIVE,
        },
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
      this.auditLogsService.log({
        action: 'VERIFY_OTP_SUCCESS',
        collection_name: 'users',
        actor_id: user._id,
        actor_email: user.email,
        target_id: user._id,
        detail: { account: dto.account, type: dto.type },
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
          full_name: user.last_Name + ' ' + user.first_Name,
          roles: user.roles,
        },
      };
    }
  }

  //3. GỬI LẠI OTP (AC12)
  async resendOtp(dto: ResendOtpDto) {
    if (!dto.account.includes('@')) {
      dto.account = this.normalizePhoneNumber(dto.account);
    }
    const user = await this.userModel.findOne({ email: dto.account });
    if (!user) throw new NotFoundException('Tài khoản không tồn tại.');

    // Rate Limit
    const lastOtp = await this.verificationModel.findOne({
      account: dto.account,
      type: dto.type,
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
    });

    if (lastOtp) {
      throw new BadRequestException(
        'Vui lòng đợi 60 giây trước khi gửi lại mã mới (AC12).',
      );
    }

    // Xóa mã cũ
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
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  //4. VALIDATE USER (LocalStrategy)
  async validateUser(
    account: string,
    password: string,
    ip: string,
    userAgent: string,
  ) {
    const isEmail = account.includes('@');

    if (!isEmail) {
      // 1. Chuẩn hóa trước
      account = this.normalizePhoneNumber(account);

      // 2. Sau đó mới check Regex Phone
      const phoneRegex = /^(03|05|07|08|09)[0-9]{8}$/;
      if (!phoneRegex.test(account))
        throw new BadRequestException('Số điện thoại không hợp lệ');
    } else {
      // Check Regex Email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(account))
        throw new BadRequestException('Email không hợp lệ');
    }

    const user = await this.usersService.findByEmailOrPhone(account);
    if (!user) {
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không chính xác',
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa.');
    }

    if (user.lock_until && user.lock_until > new Date()) {
      throw new UnauthorizedException('Tài khoản đang bị khóa tạm thời');
    }

    if (user.login_attempts >= 5) {
      throw new UnauthorizedException(
        'Bạn đã nhập sai quá nhiều lần, vui lòng thử lại sau',
      );
    }

    if (!user.password) {
      throw new UnauthorizedException(
        'Tài khoản của bạn không dùng mật khẩu để đăng nhập',
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      await this.handleLoginFail(user, ip, userAgent);
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không chính xác',
      );
    }

    await this.usersService.resetFailedAttempt(user.id);
    return user;
  }

  //5. LOGIN
  private async generateAccessToken(user: any) {
    const payload = {
      sub: user._id,
      email: user.email,
      roles: user.roles,
      token_version: user.token_version || 0,
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
      token_version: user.token_version || 0,
    };
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Tài khoản của bạn đã bị khóa.');
    }
    const expiresIn = isRemember ? '30d' : '1d';
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: expiresIn as any,
    });
  }

  async login(
    user: any,
    isRemember: boolean = false,
    ip: string,
    userAgent: string,
  ) {
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user, isRemember);

    const hashed = await bcrypt.hash(refreshToken, 10);

    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { refresh_token: hashed } },
    );

    this.auditLogsService.log({
      action: 'LOGIN',
      collection_name: 'users',
      actor_id: user._id,
      actor_email: user.email,
      actor_employee_code: user.employee_code || undefined,
      target_id: user._id,
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
    if (!refreshToken) throw new BadRequestException('Thiếu refresh token');

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

    const isValid = await bcrypt.compare(refreshToken, user.refresh_token);
    if (!isValid) throw new UnauthorizedException('Refresh token không khớp');

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

  async logout(userId: string, ip: string, userAgent: string) {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { refresh_token: null } },
    );

    // [FIX] Ghi Log Logout
    await this.auditLogsService.log({
      action: 'LOGOUT',
      collection_name: 'users',
      actor_id: userId,
      target_id: userId,
      detail: { message: 'User logged out' },
      ip: ip,
      user_agent: userAgent,
    });

    return { message: 'Đăng xuất thành công' };
  }

  //PRIVATE HELPER: Xử lý Brute-force
  private async handleLoginFail(user: any, ip: string, userAgent: string) {
    const MAX_ATTEMPTS = 5;
    const LOCK_TIME_MINUTES = 30;

    user.login_attempts += 1;

    //Ghi log mỗi lần đăng nhập sai
    await this.auditLogsService.log({
      action: 'LOGIN_FAILED',
      collection_name: 'users',
      actor_id: user._id,
      actor_email: user.email,
      actor_employee_code: user.employee_code,
      target_id: user._id,
      detail: {
        reason: 'Wrong Password',
        current_attempt: user.login_attempts,
      },
      ip: ip,
      user_agent: userAgent,
      is_success: false,
    });

    if (user.login_attempts >= MAX_ATTEMPTS) {
      user.lock_until = new Date(Date.now() + LOCK_TIME_MINUTES * 60 * 1000);
      await user.save();

      // Log Account Locked
      await this.auditLogsService.log({
        action: 'ACCOUNT_LOCKED',
        collection_name: 'users',
        actor_id: user._id,
        target_id: user._id,
        detail: {
          reason: 'Brute-force attempts',
          failed_attempts: user.login_attempts,
        },
        ip: ip,
        user_agent: userAgent,
      });

      throw new BadRequestException(
        `Bạn đã nhập sai quá ${MAX_ATTEMPTS} lần. Tài khoản bị khóa ${LOCK_TIME_MINUTES} phút.`,
      );
    } else {
      await user.save();
    }
  }
  // 6. XỬ LÝ LOGIN OAUTH
  async validateOAuthLogin(
    profile: any,
    provider: 'google' | 'facebook',
    ip: string,
    userAgent: string,
  ) {
    const { email, id, displayName, firstName, lastName, name } = profile;

    if (!id)
      throw new BadRequestException(
        `Lỗi bảo mật: Không tìm thấy ID từ ${provider}.`,
      );
    if (!email)
      throw new BadRequestException(
        'Không thể đăng nhập vì tài khoản mạng xã hội không cung cấp Email.',
      );

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
      if (f || l) finalName = `${f} ${l}`.trim();
    }
    if (
      !finalName ||
      finalName.trim() === '' ||
      finalName === 'undefined undefined'
    ) {
      finalName = email.split('@')[0];
    }

    const querySocial = {};
    querySocial[`social_auth.${provider}_id`] = id;
    const existingSocialUser = await this.userModel.findOne(querySocial);

    if (existingSocialUser) {
      this.checkUserBanStatus(existingSocialUser);
      return this.login(existingSocialUser, false, ip, userAgent);
    }

    const existingEmailUser = await this.userModel.findOne({ email });

    if (existingEmailUser) {
      this.checkUserBanStatus(existingEmailUser);
      const updateData = {};
      updateData[`social_auth.${provider}_id`] = id;

      await this.userModel.updateOne(
        { _id: existingEmailUser._id },
        { $set: updateData },
      );

      const updatedUser = await this.userModel.findById(existingEmailUser._id);
      return this.login(updatedUser, false, ip, userAgent);
    }

    const socialPhone = profile.phone || profile.phoneNumber;
    if (socialPhone) {
      const existingPhoneUser = await this.userModel.findOne({
        phone: socialPhone,
      });
      if (existingPhoneUser) {
        throw new ConflictException({
          statusCode: 409,
          message:
            'Số điện thoại liên kết với MXH này đã tồn tại trên một tài khoản khác.',
          error_code: 'OAUTH_PHONE_CONFLICT',
          details: { social_email: email, conflict_phone: socialPhone },
        });
      }
    }

    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      let saveFirstName = firstName;
      let saveLastName = lastName;

      if (!saveFirstName || !saveLastName) {
        const nameParts = finalName.trim().split(' ');
        if (nameParts.length === 1) {
          saveFirstName = nameParts[0];
          saveLastName = nameParts[0];
        } else {
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
        status: UserStatus.ACTIVE, // [FIX] Set Active
        roles: ['CUSTOMER'],
        type: 'Customer',
        social_auth: { [provider + '_id']: id },
        password: null,
      });

      if (!newUser.phone) newUser.set('phone', undefined);

      await newUser.save({ session });

      this.auditLogsService.log({
        action: 'REGISTER_OAUTH',
        collection_name: 'users',
        actor_id: newUser._id,
        actor_email: newUser.email,
        target_id: newUser._id,
        detail: { provider: provider, email: email },
        ip: ip,
        user_agent: userAgent,
      });

      await session.commitTransaction();
      return this.login(newUser, false, ip, userAgent);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  private checkUserBanStatus(user: any) {
    if (user.lock_until && user.lock_until > new Date()) {
      throw new BadRequestException('Tài khoản đang bị tạm khóa (AC4).');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hóa.');
    }
  }

  //7. GỬI YÊU CẦU KHÔI PHỤC (User)
  async requestRecovery(dto: CreateRecoveryDto, filePaths: string[]) {
    const request = new this.recoveryModel({
      ...dto,
      images: filePaths,
      status: 'PENDING',
    });
    await request.save();
    return {
      message:
        'Yêu cầu đã được gửi. Chúng tôi sẽ phản hồi qua Email liên hệ trong 24h.',
    };
  }

  //8. LẤY DANH SÁCH YÊU CẦU (Admin)
  async getPendingRecoveries() {
    return this.recoveryModel
      .find({ status: 'PENDING' })
      .sort({ createdAt: 1 });
  }

  // 9. XỬ LÝ YÊU CẦU (Admin)
  async processRecovery(
    requestId: string,
    dto: ProcessRecoveryDto,
    actorId: string,
    ip: string = 'Unknown',
    userAgent: string = 'Unknown',
  ) {
    const request = await this.recoveryModel.findById(requestId);
    if (!request) throw new NotFoundException('Yêu cầu không tồn tại');
    if (request.status !== 'PENDING')
      throw new BadRequestException('Yêu cầu này đã được xử lý trước đó.');

    const adminUser = await this.userModel.findById(actorId);
    const adminCode = (adminUser as any)?.employee_code;
    const adminEmail = adminUser?.email;

    let responseMessage = '';
    let actionType = '';

    if (dto.status === 'REJECTED') {
      if (!dto.rejection_reason)
        throw new BadRequestException('Vui lòng nhập lý do từ chối.');

      request.status = 'REJECTED';
      request.rejection_reason = dto.rejection_reason;
      request.processed_by = actorId as any;
      request.processed_at = new Date();
      await request.save();

      await this.emailService.sendRaw(
        request.contact_email,
        '[H&N Odyssey] Phản hồi yêu cầu khôi phục',
        `<p>Yêu cầu của bạn đã bị từ chối.</p><p>Lý do: <b>${dto.rejection_reason}</b></p>`,
      );

      responseMessage = 'Đã từ chối yêu cầu.';
      actionType = 'REJECT_RECOVERY_REQUEST';
    } else if (dto.status === 'APPROVED') {
      const user = await this.userModel.findOne({
        $or: [
          { email: request.target_account },
          { phone: request.target_account },
        ],
      });

      if (!user)
        throw new BadRequestException(
          'Không tìm thấy tài khoản gốc trong hệ thống.',
        );

      const resetToken = this.generateRandomString(32);
      const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await this.verificationModel.create({
        account: request.contact_email,
        code: resetToken,
        type: 'ADMIN_RESET_PASSWORD',
        expired_at: expiredAt,
        linked_user_id: { userId: user._id },
      });

      request.status = 'APPROVED';
      request.processed_by = actorId as any;
      request.processed_at = new Date();
      await request.save();

      const link = `https://hn-odyssey.com/recovery-reset?token=${resetToken}&email=${request.contact_email}`;
      await this.emailService.sendResetPasswordLink(
        request.contact_email,
        link,
      );

      responseMessage =
        'Đã duyệt yêu cầu và gửi link khôi phục đến email liên hệ.';
      actionType = 'APPROVE_RECOVERY_REQUEST';
    }

    if (actionType) {
      this.auditLogsService.log({
        action: actionType,
        collection_name: 'recovery_requests',
        actor_id: actorId,
        actor_email: adminEmail,
        actor_employee_code: adminCode,
        target_id: requestId,
        detail: {
          target_account: request.target_account,
          reason: dto.rejection_reason || 'Approved',
        },
        ip: ip,
        user_agent: userAgent,
      });
    }

    return { message: responseMessage };
  }

  private generateRandomString(length: number): string {
    return randomBytes(Math.ceil(length / 2))
      .toString('hex') // Chuyển sang chuỗi hex (0-9, a-f)
      .slice(0, length); // Cắt đúng độ dài yêu cầu (phòng trường hợp length là số lẻ)
  }

  //10. QUÊN MẬT KHẨU
  async forgotPassword(account: string, ip: string, userAgent: string) {
    if (!account.includes('@')) {
      account = this.normalizePhoneNumber(account);
    }
    this.auditLogsService.log({
      action: 'FORGOT_PASSWORD_REQUEST',
      collection_name: 'users',
      actor_id: null,
      detail: { account: account },
      ip: ip,
      user_agent: userAgent,
    });

    const user = await this.userModel.findOne({
      $or: [{ email: account }, { phone: account }],
    });

    if (!user) {
      await new Promise((r) => setTimeout(r, 1000));
      return {
        message: 'Nếu tài khoản tồn tại, chúng tôi đã gửi hướng dẫn khôi phục.',
      };
    }

    const expiredAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.verificationModel.deleteMany({
      account: account,
      type: 'RESET_PASSWORD',
    });

    const isEmail = account.includes('@');
    let code = '';

    if (isEmail) {
      code = this.generateRandomString(32);
      const link = `https://hn-odyssey.com/reset-password?token=${code}&email=${account}`;
      this.emailService
        .sendResetPasswordLink(account, link)
        .catch((e) => this.logger.error(e));
    } else {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      this.smsService.sendOtp(account, code).catch((e) => this.logger.error(e));
    }

    await this.verificationModel.create({
      account: account,
      code: code,
      type: 'RESET_PASSWORD',
      expired_at: expiredAt,
    });

    return {
      message: 'Nếu tài khoản tồn tại, chúng tôi đã gửi hướng dẫn khôi phục.',
    };
  }

  // 11. ĐẶT LẠI MẬT KHẨU
  async resetPassword(
    dto: ResetPasswordDto,
    ip: string,
    userAgent: string = 'Unknown',
  ) {
    if (dto.newPassword !== dto.confirmNewPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp.');
    }

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

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(dto.newPassword, salt);
    user.status = UserStatus.ACTIVE;

    await user.save();
    await verifyRecord.deleteOne();

    this.auditLogsService.log({
      action: 'RESET_PASSWORD_SUCCESS',
      collection_name: 'users',
      actor_id: user._id,
      actor_email: user.email,
      target_id: user._id,
      detail: { account: dto.account },
      ip: ip,
      user_agent: userAgent,
    });
    return { message: 'Đặt lại mật khẩu thành công.' };
  }

  //12. KHÔI PHỤC TÀI KHOẢN (Admin Link)
  async recoverAccount(
    dto: RecoverAccountDto,
    ip: string,
    userAgent: string = 'Unknown',
  ) {
    if (dto.newPassword !== dto.confirmNewPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp.');
    }

    const verifyRecord = await this.verificationModel.findOne({
      account: dto.account,
      code: dto.code,
      type: 'ADMIN_RESET_PASSWORD',
    });

    if (!verifyRecord)
      throw new BadRequestException('Liên kết khôi phục không hợp lệ.');
    if (verifyRecord.expired_at < new Date())
      throw new BadRequestException('Liên kết đã hết hạn.');

    const userId = verifyRecord.linked_user_id?.['userId'];
    const user = await this.userModel.findById(userId);

    if (!user) throw new NotFoundException('Tài khoản gốc không tồn tại.');

    if (dto.newEmail !== user.email) {
      const duplicate = await this.userModel.findOne({ email: dto.newEmail });
      if (duplicate)
        throw new ConflictException(`Email ${dto.newEmail} đã được sử dụng.`);
      user.email = dto.newEmail;
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(dto.newPassword, salt);
    user.lock_until = null;
    user.login_attempts = 0;
    user.status = UserStatus.ACTIVE;

    await user.save();
    await verifyRecord.deleteOne();

    this.auditLogsService.log({
      action: 'ACCOUNT_RECOVERY_SUCCESS',
      collection_name: 'users',
      actor_id: user._id,
      actor_email: user.email,
      target_id: user._id,
      detail: { old_email: verifyRecord.account, new_email: dto.newEmail },
      ip: ip,
      user_agent: userAgent,
    });

    return { message: 'Khôi phục tài khoản thành công.' };
  }
}
