import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
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
import { JwtService } from '@nestjs/jwt';

@ApiTags('Auth (Xác thực)')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  //1. ĐĂNG KÝ (US.01)
  @Post('register')
  @Public() // API này ai cũng gọi được, không cần token
  @ApiOperation({ summary: 'Đăng ký tài khoản khách hàng mới' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công, chờ OTP.' })
  @ApiResponse({ status: 409, description: 'Email/SĐT đã tồn tại.' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  //2. XÁC THỰC OTP (AC13)
  @Post('verify')
  @Public()
  @HttpCode(HttpStatus.OK) // Trả về 200 thay vì 201 mặc định
  @ApiOperation({ summary: 'Xác thực OTP để kích hoạt tài khoản' })
  @ApiResponse({
    status: 200,
    description: 'Kích hoạt thành công, trả về Token.',
  })
  @ApiResponse({ status: 400, description: 'Mã OTP sai hoặc hết hạn.' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
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
  // @UseGuards(AuthGuard('local')) // Cách 1: Dùng Guard Local (Trả về 401 nếu sai)
  // Tuy nhiên, để custom error message (AC3, AC5) tốt hơn, ta gọi service trực tiếp hoặc custom filter.
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
  async login(@Body() dto: LoginDto) {
    // 1. Validate User (Check pass, status, brute-force)
    const user = await this.authService.validateUser(dto.account, dto.password);

    // 2. Generate Token (AC6, AC14)
    return this.authService.login(user);
  }

  //5. GOOGLE LOGIN (AC1)
  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {}

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google')) // AC5: Nếu cancel, Guard sẽ tự xử lý hoặc throw Unauthorized
  async googleAuthRedirect(@Req() req, @Res() res) {
    try {
      // Gọi Service xử lý logic AC2 -> AC10
      const result = await this.authService.validateOAuthLogin(
        req.user,
        'google',
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
  async facebookAuth(@Req() req) {}

  @Get('facebook/callback')
  @Public()
  @UseGuards(AuthGuard('facebook'))
  async facebookAuthRedirect(@Req() req, @Res() res) {
    try {
      const result = await this.authService.validateOAuthLogin(
        req.user,
        'facebook',
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
  @UseInterceptors(FilesInterceptor('images', 3)) // Tối đa 3 ảnh
  @ApiOperation({ summary: 'Gửi yêu cầu khôi phục tài khoản (kèm ảnh)' })
  async requestRecovery(
    @Body() dto: CreateRecoveryDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException(
        'Vui lòng tải lên hình ảnh minh chứng (AC2).',
      );
    }
    // Giả lập lưu file và lấy đường dẫn. Thực tế cần upload lên S3/Cloudinary.
    const filePaths = files.map((f) => `uploads/${f.originalname}`);

    return this.authService.requestRecovery(dto, filePaths);
  }

  //8. ADMIN: LẤY DANH SÁCH YÊU CẦU (AC3)
  @Get('admin/recovery-requests')
  @Roles(Role.ADMIN)
  // @UseGuards(JwtAuthGuard, RolesGuard)
  async getPendingRecoveries() {
    return this.authService.getPendingRecoveries();
  }

  //9. ADMIN: DUYỆT/TỪ CHỐI (AC4, AC5)
  @Post('admin/recovery-requests/process/:id')
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async processRecovery(
    @Param('id') id: string,
    @Body() dto: ProcessRecoveryDto,
    @Req() req,
  ) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Thiếu Token xác thực.');
    }
    const token = authHeader.substring(7);

    const decodedToken = await this.jwtService.decode(token);

    const adminId = decodedToken.sub;

    if (!adminId) {
      throw new BadRequestException('Token không chứa ID người dùng.');
    }

    return this.authService.processRecovery(id, dto, adminId);
  }

  //10. REFRESH TOKEN — LẤY ACCESS TOKEN MỚI (PUBLIC)
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
}
