import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseFilePipeBuilder,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify.dto';
import { ResendOtpDto } from './dto/resend-otp.dto.ts';
import { Public } from '../../common/decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreateRecoveryDto } from './dto/create-recovery.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { ProcessRecoveryDto } from './dto/process-recovery.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RecoverAccountDto } from './dto/recover-account.dto';
import { UserAgent } from 'src/common/decorators/user-agent.decorator';
import { PermissionsGuard } from 'src/common/guards/permissions.guard';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';

@ApiTags('Auth (Xác thực)')
@Controller('auth')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  //1. ĐĂNG KÝ (US.01)
  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Đăng ký tài khoản khách hàng mới' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công, chờ OTP.' })
  @ApiResponse({ status: 409, description: 'Email/SĐT đã tồn tại.' })
  async register(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    return this.authService.register(dto, ip, userAgent);
  }

  //2. XÁC THỰC OTP (AC13)
  @Post('verify-otp')
  @Public()
  @HttpCode(HttpStatus.OK) // Trả về 200 thay vì 201 mặc định
  @ApiOperation({ summary: 'Xác thực OTP để kích hoạt tài khoản' })
  @ApiResponse({
    status: 200,
    description: 'Kích hoạt thành công, trả về Token.',
  })
  @ApiResponse({ status: 400, description: 'Mã OTP sai hoặc hết hạn.' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    // Truyền ip và userAgent xuống Service
    return this.authService.verifyOtp(dto, ip as string, userAgent);
  }

  //3. GỬI LẠI OTP (AC12)
  @Post('resend-otp')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Yêu cầu gửi lại mã OTP (có giới hạn 60s)' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  //4. ĐĂNG NHẬP (US.02)
  @Post('login')
  @Public() // Login thì không cần Token
  // Ở đây gọi service trực tiếp để dễ debug logic Brute-force.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập hệ thống (AC1 -> AC14)' })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công, trả về Access/Refresh Token.',
  })
  @ApiResponse({
    status: 400,
    description: 'Sai mật khẩu, tài khoản bị khóa, chưa active.',
  })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    // 1. Validate User (Check pass, status, brute-force)
    const user = await this.authService.validateUser(
      dto.account,
      dto.password,
      ip,
      userAgent,
    );

    // 2. Generate Token (AC6, AC14)
    return this.authService.login(user, dto.rememberMe || false, ip, userAgent);
  }

  //5. GOOGLE LOGIN (AC1)
  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: any) {}

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google')) // AC5: Nếu cancel, Guard sẽ tự xử lý hoặc throw Unauthorized
  async googleAuthRedirect(@Req() req: any, @Res() res: any) {
    try {
      const ip =
        req.headers['x-forwarded-for'] ||
        req.socket?.remoteAddress ||
        'Unknown';
      const userAgent = req.headers['user-agent'] || 'Unknown';
      // Gọi Service xử lý logic AC2 -> AC10
      const result = await this.authService.validateOAuthLogin(
        req.user,
        'google',
        ip as string,
        userAgent,
      );

      // AC7: Redirect về Frontend kèm Token
      // Lưu ý: Không nên trả json trực tiếp vì đây là redirect từ browser
      // Cách an toàn: Redirect về trang xử lý login của FE kèm token trên URL (hoặc set cookie)
      /*res.redirect(
        `${process.env.FRONTEND_URL}/auth/callback?token=${result.access_token}`,
      );*/

      return res.json({
        message: 'Login Google thành công!',
        user: req.user,
        accessToken: result.access_token,
      });
    } catch (error) {
      // AC6: Xử lý lỗi kết nối hoặc logic (AC9, AC4)
      const message = encodeURIComponent(error.message);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=${message}`);
    }
  }

  //6. FACEBOOK LOGIN (AC1)
  @Get('facebook')
  @Public()
  @UseGuards(AuthGuard('facebook'))
  async facebookAuth(@Req() req: any) {}

  @Get('facebook/callback')
  @Public()
  @UseGuards(AuthGuard('facebook'))
  async facebookAuthRedirect(@Req() req: any, @Res() res: any) {
    try {
      const ip =
        req.headers['x-forwarded-for'] ||
        req.socket?.remoteAddress ||
        'Unknown';
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const result = await this.authService.validateOAuthLogin(
        req.user,
        'facebook',
        ip as string,
        userAgent,
      );

      return res.json({
        message: 'Login Facebook thành công!',
        user: req.user,
        accessToken: result.access_token,
      });

      /*res.redirect(
        `${process.env.FRONTEND_URL}/auth/callback?token=${result.access_token}`,
      );*/
    } catch (error) {
      const message = encodeURIComponent(error.message);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=${message}`);
    }
  }

  //7. GỬI YÊU CẦU KHÔI PHỤC (Public)
  //AC1, AC2: Upload ảnh
  @Post('recovery-request')
  @Public()
  @UseInterceptors(FilesInterceptor('images', 3))
  @ApiOperation({ summary: 'Gửi yêu cầu khôi phục tài khoản (kèm ảnh)' })
  async requestRecovery(
    @Body() dto: CreateRecoveryDto,
    @UploadedFiles(
      // [NEW] Validate trực tiếp tại Controller
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: /(jpg|jpeg|png)$/, // Chỉ cho phép ảnh
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 5, // Tối đa 5MB (AC2)
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    files: Array<Express.Multer.File>,
  ) {
    // Logic giả lập lưu file
    const filePaths = files.map((f) => `uploads/${f.originalname}`);
    return this.authService.requestRecovery(dto, filePaths);
  }

  //8. ADMIN: LẤY DANH SÁCH YÊU CẦU (AC3)
  @Get('admin/recovery-requests')
  @Roles(Role.MANAGER, Role.SUPER_ADMIN)
  @RequirePermissions(Resource.USERS, Action.READ)
  async getPendingRecoveries() {
    return this.authService.getPendingRecoveries();
  }

  //9. ADMIN: DUYỆT/TỪ CHỐI (AC4, AC5)
  @Post('admin/recovery-requests/process/:id')
  @Roles(Role.MANAGER, Role.SUPER_ADMIN)
  @RequirePermissions(Resource.USERS, Action.UPDATE)
  async processRecovery(
    @Param('id') id: string,
    @Body() dto: ProcessRecoveryDto,
    @Req() req: any, // req.user đã có dữ liệu nhờ JwtAuthGuard
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    // [FIX] Lấy trực tiếp từ req.user, bỏ đoạn decode thủ công
    const adminId = req.user.userId;

    return this.authService.processRecovery(id, dto, adminId, ip, userAgent);
  }

  //10. REFRESH TOKEN — LẤY ACCESS TOKEN MỚI (PUBLIC  )
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy Access Token mới bằng Refresh Token' })
  @ApiResponse({
    status: 200,
    description: 'Trả về Access Token mới và Refresh Token mới (Rotation).',
  })
  async refreshToken(@Body('refresh_token') refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Thiếu refresh_token trong body.');
    }
    return this.authService.refreshTokens(refreshToken);
  }

  //12. QUÊN MẬT KHẨU (AC1 -> AC3)
  @Post('forgot-password')
  @Public() // Khách chưa login mới dùng được
  @ApiOperation({ summary: 'Yêu cầu OTP/Link để reset mật khẩu' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Ip() ip: string, // Lấy IP tự động
    @UserAgent() userAgent: string,
  ) {
    return this.authService.forgotPassword(dto.account, ip, userAgent);
  }

  //12. ĐẶT LẠI MẬT KHẨU (AC5)
  @Post('reset-password')
  @Public()
  @ApiOperation({ summary: 'Submit mật khẩu mới kèm OTP/Token' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    return this.authService.resetPassword(dto, ip, userAgent);
  }

  //13. KHÔI PHỤC TÀI KHOẢN (Cho link Admin cấp)
  @Post('recover-account')
  @Public()
  @ApiOperation({ summary: 'Submit mật khẩu và email mới (Link từ Admin)' })
  async recoverAccount(
    @Body() dto: RecoverAccountDto,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    // DTO này bắt buộc có newEmail
    return this.authService.recoverAccount(dto, ip, userAgent);
  }

  //14. ĐĂNG XUẤT (US.02 - AC14, US.06 - AC10)
  @Post('logout')
  // Không dùng @Public() -> Mặc định dùng JwtAuthGuard để chặn guest
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất (Xóa Refresh Token)' })
  @ApiResponse({
    status: 200,
    description: 'Đăng xuất thành công, Refresh Token đã bị hủy.',
  })
  async logout(
    @Req() req: any,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    // req.user được gán từ JwtStrategy sau khi qua Guard
    const userId = req.user.userId;
    return this.authService.logout(userId, ip, userAgent);
  }
}
