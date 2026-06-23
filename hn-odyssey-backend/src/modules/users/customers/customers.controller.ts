import {
  Body,
  Controller,
  Post,
  Get,
  Patch,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  RequestChangeContactDto,
  VerifyContactChangeDto,
} from './dto/change-contact.dto';
import { GetMyOrdersDto } from './dto/get-my-orders.dto';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/enums/role.enum';
import { ContentService } from 'src/modules/marketing/content/content.service';

// Interface hỗ trợ ép kiểu an toàn cho kết quả upload
interface IUploadResult {
  url: string;
}

@ApiTags('Customers (Khách hàng)')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
@Controller('users/customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly contentService: ContentService,
  ) {}

  // TRANG CÁ NHÂN
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AC1: Lấy thông tin cá nhân hiện tại' })
  async getProfile(@CurrentUser('_id') userId: string) {
    return this.customersService.getProfile(userId);
  }

  @Patch('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AC2: Cập nhật thông tin cơ bản' })
  async updateProfile(
    @CurrentUser('_id') userId: string,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.customersService.updateProfile(userId, updateProfileDto);
  }

  // CÁC CHỨC NĂNG KHÁC
  @Post('convert-guest')
  @Public()
  @ApiOperation({ summary: 'Chuyển đổi Guest thành Member từ đơn hàng' })
  async convertGuestToMember(
    @Body() body: { orderId: string; password: string },
  ) {
    return this.customersService.convertGuestToMember(
      body.orderId,
      body.password,
    );
  }

  @Patch('avatar')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'AC3, AC15: Tải lên ảnh đại diện' })
  @UseInterceptors(FileInterceptor('avatar')) // Tên field trong form-data là 'avatar'
  async updateAvatar(
    @CurrentUser('_id') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          // AC3: Chỉ chấp nhận JPG, PNG
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg)' }),
          // AC3: Dung lượng tối đa 5MB (5 * 1024 * 1024 bytes)
          new MaxFileSizeValidator({ maxSize: 5242880 }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.contentService.processAndSaveFiles([file], {
      subFolder: 'avatars',
      generateThumbnail: false,
    });

    // Ép kiểu an toàn (Safe Cast) qua unknown để vượt qua ESLint Strict Mode
    const typedResult = result as unknown as IUploadResult[];
    const avatarUrl = typedResult[0]?.url;

    if (!avatarUrl) {
      throw new BadRequestException(
        'Lỗi hệ thống: Không thể trích xuất đường dẫn ảnh sau khi tải lên.',
      );
    }

    return this.customersService.updateAvatar(userId, avatarUrl);
  }

  @Patch('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AC6 -> AC10: Đổi mật khẩu' })
  async changePassword(
    @CurrentUser('_id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.customersService.changePassword(userId, dto);
  }

  @Post('request-change-contact')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'AC4, AC11, AC12, AC13: Yêu cầu đổi Email/SĐT (Gửi OTP/Link)',
  })
  async requestChangeContact(
    @CurrentUser('_id') userId: string,
    @Body() dto: RequestChangeContactDto,
  ) {
    return this.customersService.requestChangeContact(userId, dto);
  }

  @Post('verify-change-contact')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'AC5, AC14: Xác nhận mã OTP để hoàn tất đổi Email/SĐT',
  })
  async verifyChangeContact(
    @CurrentUser('_id') userId: string,
    @Body() dto: VerifyContactChangeDto,
  ) {
    return this.customersService.verifyChangeContact(userId, dto);
  }

  @Get('orders')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'AC3 -> AC9: Xem Lịch sử đơn hàng (Phân trang, Lọc, Tìm kiếm)',
  })
  async getMyOrders(
    @CurrentUser('_id') userId: string,
    @Query() dto: GetMyOrdersDto,
  ) {
    // AC2: Nếu kết quả trả về data: [] rỗng, Front-end sẽ hiện giao diện "Chưa có đơn hàng nào"
    return this.customersService.getMyOrders(userId, dto);
  }

  @Get('orders/:orderId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'AC2 -> AC6: Xem Chi tiết đơn hàng & Theo dõi Timeline',
  })
  async getMyOrderDetail(
    @CurrentUser('_id') userId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.customersService.getMyOrderDetail(userId, orderId);
  }

  // THÊM MỚI: Route để Frontend lưu trạng thái tìm kiếm (Gọi ẩn dưới background)
  @Patch('search-preferences')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'AC15: Lưu trạng thái bộ lọc và sắp xếp của phiên làm việc',
  })
  async saveSearchPreferences(
    @CurrentUser('_id') userId: string,
    @Body() body: { filters?: Record<string, unknown>; sort?: string },
  ) {
    return this.customersService.saveSearchPreferences(
      userId,
      body.filters,
      body.sort,
    );
  }
}
