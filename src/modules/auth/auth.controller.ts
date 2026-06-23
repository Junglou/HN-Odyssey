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
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify.dto';
import { ResendOtpDto } from './dto/resend-otp.dto.ts';
import { Public } from '../../common/decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreateRecoveryDto } from './dto/create-recovery.dto';
import { ProcessRecoveryDto } from './dto/process-recovery.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RecoverAccountDto } from './dto/recover-account.dto';
import { UserAgent } from 'src/common/decorators/user-agent.decorator';
import { RequirePermissions } from 'src/common/decorators/permissions.decorator';
import { Action, Resource } from 'src/common/enums/resource.enum';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type {
  IUser,
  RequestWithUser,
} from 'src/common/interfaces/user.interface';
import { OAuthProfile } from 'src/common/interfaces/OAuthProfile';
import { SecurityMonitorInterceptor } from 'src/common/interceptors/security-monitor.interceptor';

@ApiTags('Auth (Xác thực)')
@Controller('auth')
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
  @HttpCode(HttpStatus.OK)
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
    return this.authService.verifyOtp(dto, ip, userAgent);
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
  @Public()
  @UseInterceptors(SecurityMonitorInterceptor)
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
    const user = await this.authService.validateUser(
      dto.account,
      dto.password,
      ip,
      userAgent,
    );
    return this.authService.login(user, dto.rememberMe || false, ip, userAgent);
  }

  //5. GOOGLE LOGIN (AC1)
  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  async googleAuth() {} // Xóa req để fix lỗi unused var

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: RequestWithUser, @Res() res: Response) {
    try {
      const ip = (
        req.headers['x-forwarded-for'] ||
        req.socket.remoteAddress ||
        'Unknown'
      ).toString();
      const userAgent = (req.headers['user-agent'] || 'Unknown').toString();

      const result = await this.authService.validateOAuthLogin(
        req.user as unknown as OAuthProfile,
        'google',
        ip,
        userAgent,
      );

      // return res.json({
      //   message: 'Login Google thành công!',
      //   user: req.user,
      //   accessToken: result.access_token,
      // });

      // Lấy URL của React Frontend (Nhớ sửa port nếu React của bạn chạy port khác)
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const userPayload = encodeURIComponent(JSON.stringify(result.user));

      // Dùng lệnh REDIRECT để đẩy trình duyệt bay ngược về React, kẹp thêm token
      return res.redirect(
        `${frontendUrl}/login?accessToken=${result.access_token}&refreshToken=${result.refresh_token}&user=${userPayload}`,
      );
    } catch (error) {
      const err = error as Error;
      const message = encodeURIComponent(err.message);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=${message}`);
    }
  }

  //6. FACEBOOK LOGIN (AC1)
  @Get('facebook')
  @Public()
  @UseGuards(AuthGuard('facebook'))
  async facebookAuth() {}

  @Get('facebook/callback')
  @Public()
  @UseGuards(AuthGuard('facebook'))
  async facebookAuthRedirect(
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    try {
      const ip = (
        req.headers['x-forwarded-for'] ||
        req.socket.remoteAddress ||
        'Unknown'
      ).toString();
      const userAgent = (req.headers['user-agent'] || 'Unknown').toString();

      const result = await this.authService.validateOAuthLogin(
        req.user as unknown as OAuthProfile,
        'facebook',
        ip,
        userAgent,
      );

      // return res.json({
      //   message: 'Login Facebook thành công!',
      //   user: req.user,
      //   accessToken: result.access_token,
      // });

      // Lấy URL của React Frontend (Nhớ sửa port nếu React của bạn chạy port khác)
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

      // Dùng lệnh REDIRECT để đẩy trình duyệt bay ngược về React, kẹp thêm token
      return res.redirect(
        `${frontendUrl}/login?accessToken=${result.access_token}`,
      );
    } catch (error) {
      const err = error as Error;
      const message = encodeURIComponent(err.message);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=${message}`);
    }
  }

  //7. GỬI YÊU CẦU KHÔI PHỤC (Public)
  @Post('recovery-request')
  @Public()
  @UseInterceptors(FilesInterceptor('images', 3))
  @ApiOperation({ summary: 'Gửi yêu cầu khôi phục tài khoản (kèm ảnh)' })
  async requestRecovery(
    @Body() dto: CreateRecoveryDto,
    @UploadedFiles(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          // Sửa regex ở đây để bắt đúng cấu trúc mimetype của file ảnh
          fileType: 'image',
        })
        .addMaxSizeValidator({
          maxSize: 1024 * 1024 * 5, // 5MB
        })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        }),
    )
    files: Array<Express.Multer.File>,
  ) {
    const filePaths = files.map((f) => `uploads/${f.originalname}`);
    return this.authService.requestRecovery(dto, filePaths);
  }

  //8. ADMIN: LẤY DANH SÁCH YÊU CẦU (AC3)
  @Get('admin/recovery-requests')
  @RequirePermissions(Resource.USERS, Action.READ)
  async getPendingRecoveries() {
    return this.authService.getPendingRecoveries();
  }

  //9. ADMIN: DUYỆT/TỪ CHỐI (AC4, AC5)
  @Post('admin/recovery-requests/process/:id')
  @RequirePermissions(Resource.USERS, Action.UPDATE)
  async processRecovery(
    @Param('id') id: string,
    @Body() dto: ProcessRecoveryDto,
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    return this.authService.processRecovery(id, dto, user._id, ip, userAgent);
  }

  //10. REFRESH TOKEN
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy Access Token mới bằng Refresh Token' })
  async refreshToken(@Body('refresh_token') refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Thiếu refresh_token trong body.');
    }
    return this.authService.refreshTokens(refreshToken);
  }

  //12. QUÊN MẬT KHẨU
  @Post('forgot-password')
  @Public()
  @ApiOperation({ summary: 'Yêu cầu OTP/Link để reset mật khẩu' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    return this.authService.forgotPassword(dto.account, ip, userAgent);
  }

  //12. ĐẶT LẠI MẬT KHẨU
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

  //13. KHÔI PHỤC TÀI KHOẢN
  @Post('recover-account')
  @Public()
  @ApiOperation({ summary: 'Submit mật khẩu và email mới (Link từ Admin)' })
  async recoverAccount(
    @Body() dto: RecoverAccountDto,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    return this.authService.recoverAccount(dto, ip, userAgent);
  }

  //14. ĐĂNG XUẤT
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất (Xóa Refresh Token)' })
  async logout(
    @CurrentUser() user: IUser,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    return this.authService.logout(user._id, ip, userAgent);
  }
}
