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
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import {
  ChangeVariantDto,
  RemoveCartItemDto,
  UpdateCartItemDto,
} from './dto/update-cart.dto';
import { UserAgent } from '../../../common/decorators/user-agent.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { IUser } from '../../../common/interfaces/user.interface';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-auth.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // 1. LẤY GIỎ HÀNG
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async getCart(
    @CurrentUser() user: IUser | null,
    @Query('guestSessionId') guestSessionId: string,
  ) {
    const userId = user ? user._id : null;
    if (!userId && !guestSessionId) {
      return { items: [], summary: { subtotal: 0 } };
    }
    return this.cartService.getCart(userId, guestSessionId);
  }

  // 2. THÊM VÀO GIỎ 
  @UseGuards(OptionalJwtAuthGuard)
  @Post('add')
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
  @UseGuards(OptionalJwtAuthGuard)
  @Patch('update')
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
  @UseGuards(OptionalJwtAuthGuard)
  @Delete('remove')
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
  @UseGuards(OptionalJwtAuthGuard)
  @Delete('clear')
  async clearCart(
    @CurrentUser() user: IUser | null,
    @Query('guestSessionId') guestSessionId: string,
  ) {
    const userId = user ? user._id : null;
    return this.cartService.clearCart(userId, guestSessionId);
  }

  // 6. ĐỔI BIẾN THỂ
  @UseGuards(OptionalJwtAuthGuard)
  @Patch('change-variant')
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

  // 7. GỘP GIỎ HÀNG
  @Post('merge')
  @UseGuards(JwtAuthGuard)
  async mergeCart(
    @CurrentUser() user: IUser,
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
