import {
  Body,
  Controller,
  Delete,
  Patch,
  Post,
  UseGuards,
  Ip,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { RemoveCartItemDto, UpdateCartItemDto } from './dto/update-cart.dto';
import { Public } from '../../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { UserAgent } from '../../../common/decorators/user-agent.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { IUser } from '../../../common/interfaces/user.interface';
import { OptionalJwtAuthGuard } from 'src/common/guards/optional-auth.guard';

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

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

  @Public()
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
      guestSessionId: userId ? null : dto['guestSessionId'],
    };

    return this.cartService.updateItem(userId, payload, ip, userAgent);
  }

  @Public()
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
      guestSessionId: userId ? null : dto['guestSessionId'],
    };

    return this.cartService.removeItem(userId, payload, ip, userAgent);
  }

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
