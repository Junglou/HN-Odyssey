import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
  Ip,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import {
  ChangeVariantDto,
  RemoveCartItemDto,
  UpdateCartItemDto,
} from './dto/update-cart.dto';

// Interfaces & Decorators
import { UserAgent } from '../../../common/decorators/user-agent.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { IUser } from '../../../common/interfaces/user.interface';
import { CartResponse } from 'src/common/interfaces/cart-response.interface';
import { Public } from 'src/common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-auth.guard';

@ApiTags('Cart (Giỏ hàng)')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // 1. LẤY GIỎ HÀNG (Hybrid: Guest hoặc User đều xem được)
  @Get()
  @Public() // <--- QUAN TRỌNG: Mở cửa cho Guest
  @UseGuards(OptionalJwtAuthGuard) // <--- QUAN TRỌNG: Kiểm tra xem có phải User không
  @ApiOperation({ summary: 'Lấy thông tin giỏ hàng (Hỗ trợ cả Guest & User)' })
  async getCart(
    @CurrentUser() user: IUser | null,
    @Query('guestSessionId') guestSessionId: string,
  ): Promise<CartResponse> {
    const userId = user ? user._id : null;
    return this.cartService.getCart(userId, guestSessionId);
  }

  // 2. THÊM VÀO GIỎ
  @Post('add')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Thêm sản phẩm vào giỏ' })
  async addToCart(
    @Body() dto: AddToCartDto,
    @CurrentUser() user: IUser | null,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    const userId = user ? user._id : null;
    return this.cartService.addToCart(userId, dto, ip, userAgent);
  }

  // 3. CẬP NHẬT SỐ LƯỢNG
  @Patch('update')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Cập nhật số lượng item' })
  async updateItem(
    @Body() dto: UpdateCartItemDto,
    @CurrentUser() user: IUser | null,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    const userId = user ? user._id : null;
    const payload = {
      ...dto,
      guestSessionId: userId ? undefined : dto.guestSessionId,
    };
    return this.cartService.updateItem(userId, payload, ip, userAgent);
  }

  // 4. XÓA SẢN PHẨM
  @Delete('remove')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Xóa item khỏi giỏ' })
  async removeItem(
    @Body() dto: RemoveCartItemDto,
    @CurrentUser() user: IUser | null,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    const userId = user ? user._id : null;
    const payload = {
      ...dto,
      guestSessionId: userId ? undefined : dto.guestSessionId,
    };
    return this.cartService.removeItem(userId, payload, ip, userAgent);
  }

  // 5. XÓA TẤT CẢ GIỎ HÀNG
  @Delete('clear')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Làm trống giỏ hàng' })
  async clearCart(
    @CurrentUser() user: IUser | null,
    @Query('guestSessionId') guestSessionId: string,
  ) {
    const userId = user ? user._id : null;
    return this.cartService.clearCart(userId, guestSessionId);
  }

  // 6. ĐỔI BIẾN THỂ (SIZE/MÀU)
  @Patch('change-variant')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Đổi biến thể sản phẩm trong giỏ' })
  async changeVariant(
    @Body() dto: ChangeVariantDto,
    @CurrentUser() user: IUser | null,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    const userId = user ? user._id : null;
    const payload = {
      ...dto,
      guestSessionId: userId ? undefined : dto.guestSessionId,
    };
    return this.cartService.changeVariant(userId, payload, ip, userAgent);
  }

  // 7. GỘP GIỎ HÀNG (Chỉ User mới làm được -> Giữ nguyên bảo mật)
  @Post('merge')
  // Không có @Public -> Global JwtAuthGuard sẽ chặn nếu chưa login (Chuẩn)
  @ApiOperation({ summary: 'Gộp giỏ hàng Guest vào User khi đăng nhập' })
  async mergeCart(
    @CurrentUser() user: IUser, // User chắc chắn tồn tại ở đây
    @Body('guestSessionId') guestSessionId: string,
    @Ip() ip: string,
    @UserAgent() userAgent: string,
  ) {
    if (user && guestSessionId) {
      return this.cartService.mergeGuestCart(
        user._id,
        guestSessionId,
        ip,
        userAgent,
      );
    }
    return { message: 'Nothing to merge' };
  }
}
