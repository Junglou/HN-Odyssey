import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
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
import { ResendOtpDto } from '../auth/dto/resend-otp.dto.ts';
import { CreateRecoveryDto } from './dto/create-recovery.dto';
import { ProcessRecoveryDto } from './dto/process-recovery.dto';
import { RecoveryRequest } from './schema/recovery-request.schema';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/user.Service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Customer.name) private readonly customerModel: Model<Customer>,
    @InjectModel(Verification.name)
    private readonly verificationModel: Model<Verification>,
    @InjectConnection() private readonly connection: Connection,
    private readonly jwtService: JwtService,
    // private readonly mailService: MailService, // Sau này sẽ inject để gửi mail thật
    @InjectModel(RecoveryRequest.name)
    private recoveryModel: Model<RecoveryRequest>,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  //1. ĐĂNG KÝ TÀI KHOẢN (US.01)
  async register(dto: RegisterDto) {
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

    // BẮT ĐẦU TRANSACTION (Để đảm bảo tạo User và OTP cùng thành công)
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // AC7: Tạo Customer mới (Status mặc định false do schema set)
      const newCustomer = new this.customerModel({
        full_name: dto.fullName,
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

      // Lưu OTP vào DB
      const verification = new this.verificationModel({
        target: dto.email,
        code: otpCode,
        type: 'REGISTER',
        expired_at: expiredAt,
      });
      await verification.save({ session });

      // TODO: Gọi MailService để gửi email thật (AC9)
      // await this.mailService.sendOtp(dto.email, otpCode);
      console.log(`[MOCK EMAIL] Gửi OTP ${otpCode} tới ${dto.email}`);

      await session.commitTransaction();
      return {
        message: 'Đăng ký thành công. Vui lòng kiểm tra Email để nhập OTP.',
        target: dto.email,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  //2. XÁC THỰC OTP (AC13)
  async verifyOtp(dto: VerifyOtpDto) {
    // Tìm bản ghi OTP
    const record = await this.verificationModel.findOne({
      target: dto.target,
      type: dto.type,
    });

    // AC5: Báo lỗi nếu không tìm thấy hoặc sai mã
    if (!record) {
      throw new BadRequestException(
        'Mã xác thực không tồn tại hoặc đã hết hạn.',
      );
    }
    if (record.code !== dto.code) {
      // AC11: (Nâng cao) Tại đây có thể tăng biến đếm sai, nếu sai > 5 lần thì khóa.
      throw new BadRequestException('Mã xác thực không đúng.');
    }

    // AC10: Check hết hạn (Dù DB có TTL nhưng code vẫn nên check kỹ)
    if (new Date() > record.expired_at) {
      throw new BadRequestException('Mã xác thực đã hết hạn.');
    }

    if (dto.type === 'REGISTER') {
      const user = await this.userModel.findOneAndUpdate(
        { email: dto.target },
        { is_active: true },
        { new: true },
      );

      if (!user) throw new NotFoundException('Không tìm thấy tài khoản.');

      // Xóa OTP sau khi dùng xong
      await record.deleteOne();

      // AC14: Tự động đăng nhập (Cấp Token)
      const accessToken = await this.generateAccessToken(user);
      const refreshToken = await this.generateRefreshToken(user);

      // (Tùy chọn) Ghi AuditLog tại đây (US.55)

      return {
        message: 'Xác thực thành công. Tài khoản đã được kích hoạt.',
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          _id: user._id,
          email: user.email,
          full_name: user.full_name,
          roles: user.roles,
        },
      };
    }
  }

  //3. GỬI LẠI OTP (AC12)
  async resendOtp(dto: ResendOtpDto) {
    const user = await this.userModel.findOne({ email: dto.target });
    if (!user) throw new NotFoundException('Tài khoản không tồn tại.');

    // Kiểm tra xem có OTP nào vừa gửi trong 1 phút qua không (Rate Limit)
    const lastOtp = await this.verificationModel.findOne({
      target: dto.target,
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
      target: dto.target,
      type: dto.type,
    });

    // Tạo mã mới
    const otpCode = this.generateOtpCode();
    const expiredAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.verificationModel.create({
      target: dto.target,
      code: otpCode,
      type: dto.type,
      expired_at: expiredAt,
    });

    // TODO: Gửi mail lại
    console.log(`[MOCK RESEND] Gửi lại OTP ${otpCode} tới ${dto.target}`);

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
      await this.usersService.increaseFailedAttempt(user.id);
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không chính xác',
      );
    }

    await this.usersService.resetFailedAttempt(user.id);

    return user;
  }

  //5. LOGIN (Tạo Token)
  //Xử lý AC6, AC12, AC13, AC14
  private async generateAccessToken(user: any): Promise<string> {
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

  private async generateRefreshToken(user: any): Promise<string> {
    const payload = {
      sub: user._id,
      email: user.email,
      roles: user.roles,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES') ||
        '7d') as any,
    });
  }

  async login(user: any) {
    const accessToken = await this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);

    // Hash refresh token
    const hashed = await bcrypt.hash(refreshToken, 10);

    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { refresh_token: hashed } },
    );

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
    const newRefreshToken = await this.generateRefreshToken(user);
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

  //6. XỬ LÝ LOGIN OAUTH (Google/Facebook)
  //Xử lý AC2, AC3, AC4, AC8, AC9, AC10
  async validateOAuthLogin(profile: any, provider: 'google' | 'facebook') {
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
    let finalName = displayName;
    // Nếu displayName rỗng, thử lấy biến name
    if (!finalName || finalName === 'undefined undefined') {
      finalName = name;
    }
    // Nếu vẫn rỗng, thử ghép firstName + lastName
    if (
      !finalName ||
      finalName.trim() === '' ||
      finalName === 'undefined undefined'
    ) {
      const f = firstName || '';
      const l = lastName || '';
      // Chỉ ghép nếu ít nhất 1 trong 2 có dữ liệu
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

    console.log('[DEBUG] Tên cuối cùng lưu vào DB:', finalName);

    // AC8: Check xem tài khoản MXH này đã liên kết với User nào khác chưa?
    const querySocial = {};
    querySocial[`social_auth.${provider}_id`] = id;
    const existingSocialUser = await this.userModel.findOne(querySocial);

    if (existingSocialUser) {
      // AC4: Check xem có bị khóa không
      this.checkUserBanStatus(existingSocialUser);
      // Nếu đã tồn tại liên kết -> Đăng nhập luôn
      return this.login(existingSocialUser);
    }

    // AC2: Nếu chưa có liên kết -> Tìm theo Email
    const existingEmailUser = await this.userModel.findOne({ email });

    if (existingEmailUser) {
      // AC4: Check ban
      this.checkUserBanStatus(existingEmailUser);

      // AC10: Logic phức tạp về xung đột (Giản lược cho MVP)
      // Nếu user cũ đăng ký bằng SĐT và chưa verify email này -> Cần xác thực (TODO: Phase 2)
      // Hiện tại theo AC2: Tự động liên kết (Auto Merge)

      const updateData = {};
      updateData[`social_auth.${provider}_id`] = id;

      // Update Avatar nếu user cũ chưa có
      // if (!existingEmailUser.avatar) updateData['avatar'] = picture;

      await this.userModel.updateOne(
        { _id: existingEmailUser._id },
        { $set: updateData },
      );

      // Fetch lại user mới nhất
      const updatedUser = await this.userModel.findById(existingEmailUser._id);
      return this.login(updatedUser);
    }

    // AC2 (Vế 2): Email chưa tồn tại -> Tạo tài khoản mới
    // AC3: Không yêu cầu mật khẩu
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const newUser = new this.customerModel({
        email: email,
        full_name: finalName,
        phone: null,
        is_active: true,
        roles: ['CUSTOMER'],
        type: 'Customer',
        social_auth: {
          [provider + '_id']: id,
        },
        password: null, // AC3
      });

      if (!newUser.phone) {
        newUser.set('phone', undefined);
      }

      await newUser.save({ session });

      // AC7: Ghi Audit Log
      console.log(`[AUDIT] Created new user via ${provider}: ${email}`);

      await session.commitTransaction();
      return this.login(newUser);
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

  //9. XỬ LÝ YÊU CẦU (Admin - AC4, AC5, AC6, AC7)
  async processRecovery(
    requestId: string,
    dto: ProcessRecoveryDto,
    adminId: string,
  ) {
    const request = await this.recoveryModel.findById(requestId);
    if (!request) throw new NotFoundException('Yêu cầu không tồn tại');
    if (request.status !== 'PENDING')
      throw new BadRequestException('Yêu cầu này đã được xử lý trước đó.');

    // Logic TỪ CHỐI (AC5)
    if (dto.status === 'REJECTED') {
      if (!dto.rejection_reason)
        throw new BadRequestException('Vui lòng nhập lý do từ chối.');

      request.status = 'REJECTED';
      request.rejection_reason = dto.rejection_reason;
      request.processed_by = adminId as any;
      request.processed_at = new Date();
      await request.save();

      // TODO: Gửi Email báo từ chối tới request.contact_email
      console.log(
        `[MAIL] Gửi mail TỪ CHỐI tới ${request.contact_email}. Lý do: ${dto.rejection_reason}`,
      );

      return { message: 'Đã từ chối yêu cầu.' };
    }

    // Logic CHẤP THUẬN (AC4)
    if (dto.status === 'APPROVED') {
      // 1. Tìm User gốc để lấy ID
      const user = await this.userModel.findOne({
        $or: [
          { email: request.target_account },
          { phone: request.target_account },
        ],
      });

      if (!user) {
        throw new BadRequestException(
          'Không tìm thấy tài khoản gốc trong hệ thống khớp với thông tin yêu cầu.',
        );
      }

      // 2. Tạo Token đặc biệt (AC6)
      // Token này phải khác loại với OTP Register. Ta dùng loại 'ADMIN_RESET'
      const resetToken = this.generateRandomString(32);

      // AC6: Hết hạn sau 24 giờ
      const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await this.verificationModel.create({
        target: request.contact_email,
        code: resetToken,
        type: 'ADMIN_RESET_PASSWORD',
        expired_at: expiredAt,
        metadata: { userId: user._id },
      });

      // 3. Cập nhật trạng thái Request
      request.status = 'APPROVED';
      request.processed_by = adminId as any;
      request.processed_at = new Date();
      await request.save();

      // 4. Gửi Email chứa Link (AC4)
      const link = `https://hn-odyssey.com/reset-password?token=${resetToken}`;
      console.log(
        `[MAIL] Gửi Link Reset đặc biệt tới ${request.contact_email}: ${link}`,
      );

      return { message: 'Đã duyệt yêu cầu và gửi link khôi phục.' };
    }
  }

  // Helper
  private generateRandomString(length: number) {
    // Logic tạo chuỗi ngẫu nhiên (hoặc dùng thư viện uuid/crypto)
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
